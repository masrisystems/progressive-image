#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DEFAULT_CONFIG, loadConfig, validateConfig } from '../src/config.mjs';
import { buildFilename } from '../src/naming.mjs';
import { findImages, processImage } from '../src/process.mjs';

const HELP = `
image-pipeline - optimize, geotag, rename and publish images

Usage
  image-pipeline <command> [options]

Commands
  optimize <path>    Build WebP + JPEG variants and an LQIP thumbnail
  thumbnails <path>  Build only the LQIP thumbnails
  upload [path]      Mirror processed images to S3-compatible storage
  name               Print the filename a keyword would produce
  init               Write image-pipeline.config.js into the current directory
  doctor             Report resolved config and any problems

Options
  -c, --config <p>   Config file path (default: image-pipeline.config.js)
  -k, --keyword <s>  Primary keyword; drives the SEO filename
  -s, --segment <s>  Path segment for the filename; repeatable
  -t, --title <s>    IPTC title
  -d, --description  IPTC description / alt text
      --keywords <s> Comma-separated IPTC keywords
  -o, --out <dir>    Override the output directory
      --force        Overwrite existing outputs
      --dry-run      Report what would happen, write nothing
  -h, --help         Show this message

Examples
  image-pipeline optimize ./raw/office.png -k "web design berlin" -s backend
  image-pipeline optimize ./public/images --dry-run
  image-pipeline upload public/images --force
`;

function parseArgs(argv) {
    const opts = { segments: [], _: [] };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => argv[++i];

        switch (arg) {
            case '-c': case '--config': opts.config = next(); break;
            case '-k': case '--keyword': opts.keyword = next(); break;
            case '-s': case '--segment': opts.segments.push(next()); break;
            case '-t': case '--title': opts.title = next(); break;
            case '-d': case '--description': opts.description = next(); break;
            case '--keywords': opts.keywords = next(); break;
            case '-o': case '--out': opts.out = next(); break;
            case '--force': opts.force = true; break;
            case '--dry-run': opts.dryRun = true; break;
            case '-h': case '--help': opts.help = true; break;
            default:
                if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
                opts._.push(arg);
        }
    }
    return opts;
}

const say = (msg = '') => process.stdout.write(`${msg}\n`);
const warn = (msg) => process.stderr.write(`${msg}\n`);

async function withExiftool(fn) {
    const { exiftool } = await import('exiftool-vendored');
    try {
        return await fn(exiftool);
    } finally {
        // Leaks a stayopen child process for the life of the shell otherwise.
        await exiftool.end();
    }
}

async function cmdOptimize(opts, config, { thumbnailsOnly = false } = {}) {
    const target = opts._[1] || config.inputDir;
    const files = findImages(target);

    if (files.length === 0) {
        warn(`No images found at: ${target}`);
        return 1;
    }
    if (opts.keyword && files.length > 1) {
        warn(`--keyword names a single image, but ${files.length} were matched.`);
        warn('Run per-file, or drop --keyword to keep existing filenames.');
        return 1;
    }

    const effective = thumbnailsOnly
        ? { ...config, formats: { webp: { enabled: false }, jpeg: { enabled: false } } }
        : config;

    say(`Processing ${files.length} image(s)${opts.dryRun ? ' (dry run)' : ''}\n`);

    let failures = 0;
    await withExiftool(async (exiftool) => {
        for (const file of files) {
            try {
                const { outputs } = await processImage(file, {
                    config: effective,
                    exiftool,
                    keyword: opts.keyword,
                    segments: opts.segments,
                    title: opts.title,
                    description: opts.description,
                    keywords: opts.keywords ? opts.keywords.split(',').map((k) => k.trim()) : [],
                    outputDir: opts.out,
                    dryRun: opts.dryRun,
                    force: opts.force,
                });

                say(path.relative(process.cwd(), file));
                for (const out of outputs) {
                    const rel = path.relative(process.cwd(), out.path);
                    if (out.skipped) say(`  - ${out.format}: skipped (${out.reason})`);
                    else if (out.dryRun) say(`  + ${out.format}: ${rel} (dry run)`);
                    else if (out.sourceKb) {
                        const saved = (100 - (out.outputKb / out.sourceKb) * 100).toFixed(0);
                        say(`  + ${out.format}: ${rel}  ${out.sourceKb}KB -> ${out.outputKb}KB (${saved}% smaller)`);
                    } else say(`  + ${out.format}: ${rel}  ${out.outputKb}KB`);
                }
            } catch (error) {
                failures++;
                warn(`FAILED ${file}: ${error.message}`);
            }
        }
    });

    say(failures ? `\nDone with ${failures} failure(s).` : '\nDone.');
    return failures ? 1 : 0;
}

async function cmdUpload(opts, config) {
    if (!config.upload?.enabled) {
        warn('upload.enabled is false. Enable it in your config first.');
        return 1;
    }

    const { uploadFiles } = await import('../src/upload.mjs');
    const baseDir = opts._[1] || config.outputDir;
    const files = findImages(baseDir, { recursive: true });

    if (files.length === 0) {
        warn(`No images found at: ${baseDir}`);
        return 1;
    }

    say(`Uploading ${files.length} file(s) to ${config.upload.bucket}${opts.dryRun ? ' (dry run)' : ''}\n`);

    const results = await uploadFiles(files, {
        config,
        baseDir,
        force: opts.force,
        dryRun: opts.dryRun,
    });

    for (const item of results.uploaded) say(`  + ${item.key}${item.url ? `  ${item.url}` : ''}`);
    if (results.skipped.length) say(`  - ${results.skipped.length} already present`);
    for (const item of results.failed) warn(`  ! ${item.key}: ${item.error}`);

    say(`\nUploaded ${results.uploaded.length}, skipped ${results.skipped.length}, failed ${results.failed.length}.`);
    return results.failed.length ? 1 : 0;
}

function cmdName(opts, config) {
    if (!opts.keyword) {
        warn('name requires --keyword.');
        return 1;
    }
    for (const ext of ['webp', 'jpg']) {
        say(buildFilename({ keyword: opts.keyword, segments: opts.segments, extension: ext, config: config.naming }));
    }
    return 0;
}

function cmdInit() {
    const target = path.join(process.cwd(), 'image-pipeline.config.js');
    if (fs.existsSync(target)) {
        warn(`${target} already exists; not overwriting.`);
        return 1;
    }

    const template = path.join(
        path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
        '..',
        'image-pipeline.config.example.js',
    );

    fs.copyFileSync(template, target);
    say(`Created ${target}`);
    say('Fill in brand and location, then run: image-pipeline doctor');
    say('\nThis file will hold your address and phone number. Keep it out of git');
    say('if your repository is public.');
    return 0;
}

function cmdDoctor(config, configPath) {
    say(`Config: ${configPath ?? 'none found (using defaults)'}`);
    say(`Input:      ${config.inputDir}`);
    say(`Output:     ${config.outputDir}`);
    say(`Thumbnails: ${config.thumbnailDir}`);
    say(`Formats:    webp=${!!config.formats?.webp?.enabled} jpeg=${!!config.formats?.jpeg?.enabled}`);
    say(`Geotagging: ${config.location ? `on (${config.location.latitude}, ${config.location.longitude})` : 'off - no location configured'}`);
    say(`Branding:   ${config.brand ? `on (${config.brand.name})` : 'off - no brand configured'}`);
    say(`Upload:     ${config.upload?.enabled ? `on -> ${config.upload.bucket}` : 'off'}`);

    const errors = validateConfig(config);
    if (errors.length) {
        say('\nProblems:');
        for (const error of errors) say(`  - ${error}`);
        return 1;
    }
    say('\nNo problems found.');
    return 0;
}

async function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (error) {
        warn(error.message);
        process.exit(1);
    }

    const command = opts._[0];
    if (opts.help || !command) {
        say(HELP.trim());
        process.exit(command ? 0 : 1);
    }

    if (command === 'init') process.exit(cmdInit());

    const { config, configPath } = await loadConfig({ configPath: opts.config });

    if (command === 'doctor') process.exit(cmdDoctor(config, configPath));

    const errors = validateConfig(config);
    if (errors.length) {
        warn('Configuration problems:');
        for (const error of errors) warn(`  - ${error}`);
        warn('\nRun: image-pipeline doctor');
        process.exit(1);
    }

    switch (command) {
        case 'optimize':   process.exit(await cmdOptimize(opts, config)); break;
        case 'thumbnails': process.exit(await cmdOptimize(opts, config, { thumbnailsOnly: true })); break;
        case 'upload':     process.exit(await cmdUpload(opts, config)); break;
        case 'name':       process.exit(cmdName(opts, config)); break;
        default:
            warn(`Unknown command: ${command}`);
            say(HELP.trim());
            process.exit(1);
    }
}

main().catch((error) => {
    warn(error.stack || error.message);
    process.exit(1);
});

export { DEFAULT_CONFIG };
