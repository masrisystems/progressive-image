/**
 * SEO filename generation.
 *
 * Convention: <prefix>-<segments...>-<keyword>-<suffix>.<ext>
 * e.g. acme-backend-process-automation-berlin.webp
 *
 * Descriptive, keyword-bearing filenames are one of the few image-SEO signals
 * that survive a CDN rewrite, so this runs before anything is uploaded.
 */

const DIACRITICS = /[̀-ͯ]/g;

/** Transliterations Unicode NFD does not decompose on its own. */
const SPECIAL_CASES = {
    ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
    å: 'a', æ: 'ae', ø: 'o', ð: 'd', þ: 'th',
    ł: 'l', đ: 'd', ħ: 'h', ı: 'i', œ: 'oe',
};

export function slugify(input, { separator = '-', lowercase = true } = {}) {
    if (!input) return '';

    let text = String(input);
    if (lowercase) text = text.toLowerCase();

    text = text.replace(/[äöüßåæøðþłđħıœ]/g, (ch) => SPECIAL_CASES[ch] ?? ch);
    text = text.normalize('NFD').replace(DIACRITICS, '');
    text = text.replace(/[^a-zA-Z0-9]+/g, separator);

    const escaped = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text
        .replace(new RegExp(`${escaped}{2,}`, 'g'), separator)
        .replace(new RegExp(`^${escaped}|${escaped}$`, 'g'), '');
}

/**
 * Truncate on a separator boundary so a clipped name never ends mid-word.
 */
function truncate(slug, maxLength, separator) {
    if (slug.length <= maxLength) return slug;
    const clipped = slug.slice(0, maxLength);
    const lastBoundary = clipped.lastIndexOf(separator);
    return lastBoundary > maxLength * 0.5 ? clipped.slice(0, lastBoundary) : clipped;
}

export function buildFilename({ keyword, segments = [], extension, config = {} }) {
    const { prefix = '', suffix = '', separator = '-', lowercase = true, maxLength = 120 } = config;

    const parts = [prefix, ...segments, keyword, suffix]
        .filter(Boolean)
        .map((part) => slugify(part, { separator, lowercase }))
        .filter(Boolean);

    if (parts.length === 0) throw new Error('buildFilename needs at least one non-empty part.');

    // Collapse repeats so `prefix: 'acme'` plus a keyword already containing
    // "acme" does not produce acme-acme-....
    const deduped = parts.filter((part, i) => part !== parts[i - 1]);

    const ext = String(extension || '').replace(/^\./, '').toLowerCase();
    const stem = truncate(deduped.join(separator), maxLength, separator);

    return ext ? `${stem}.${ext}` : stem;
}
