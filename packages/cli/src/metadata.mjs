/**
 * IPTC / EXIF / XMP metadata construction and writing.
 *
 * Everything here is derived from the project's own config. The package ships
 * no location or identity of its own, so an unconfigured run writes nothing.
 */

/** ExifTool takes signed decimal degrees plus an explicit hemisphere ref. */
function gpsTags(location) {
    const { latitude, longitude, altitude } = location;
    const tags = {
        GPSLatitude: Math.abs(latitude),
        GPSLatitudeRef: latitude >= 0 ? 'N' : 'S',
        GPSLongitude: Math.abs(longitude),
        GPSLongitudeRef: longitude >= 0 ? 'E' : 'W',
    };
    if (typeof altitude === 'number') {
        tags.GPSAltitude = Math.abs(altitude);
        // 0 = above sea level, 1 = below.
        tags.GPSAltitudeRef = altitude >= 0 ? 0 : 1;
    }
    return tags;
}

function locationTags(location) {
    const tags = {};
    if (location.city) {
        tags.City = location.city;
        tags.CreatorCity = location.city;
    }
    if (location.street) {
        tags['Sub-location'] = location.street;
        tags.CreatorAddress = location.street;
    }
    if (location.region) tags['Province-State'] = location.region;
    if (location.country) {
        tags.Country = location.country;
        tags['Country-PrimaryLocationName'] = location.country;
        tags.CreatorCountry = location.country;
    }
    if (location.countryCode) tags.CountryCode = location.countryCode;
    if (location.postalCode) {
        tags.PostalCode = location.postalCode;
        tags.CreatorPostalCode = location.postalCode;
    }
    return tags;
}

function brandTags(brand) {
    const tags = {
        Artist: brand.name,
        Byline: brand.name,
        Credit: brand.name,
        Creator: brand.creator || brand.name,
        Copyright: brand.copyright || `© ${new Date().getFullYear()} ${brand.name}`,
    };
    if (brand.url) {
        tags.Source = brand.url;
        tags.CreatorWorkURL = brand.url;
    }
    if (brand.email) tags.CreatorWorkEmail = brand.email;
    if (brand.phone) tags.CreatorWorkTelephone = brand.phone;
    return tags;
}

/**
 * @param {object}   params
 * @param {object}   params.config    Loaded pipeline config.
 * @param {string}   params.title     Short human title (ObjectName / Title).
 * @param {string}   params.description Alt-text-grade description.
 * @param {string[]} params.keywords  Searchable keywords.
 */
export function buildMetadata({ config, title, description, keywords = [] }) {
    const { location, brand } = config;
    const tags = {};

    if (location) {
        Object.assign(tags, gpsTags(location), locationTags(location));
    }
    if (brand) {
        Object.assign(tags, brandTags(brand));
    }

    if (title) {
        tags.Title = title;
        tags.ObjectName = title;
        tags.Headline = title;
    }

    if (description) {
        // Written across all three standards - different consumers read different ones.
        tags.Description = description;
        tags.ImageDescription = description;
        tags['Caption-Abstract'] = description;
    }

    const allKeywords = [...keywords, ...(brand?.keywords ?? [])]
        .map((k) => String(k).trim())
        .filter(Boolean);

    if (allKeywords.length) {
        const unique = [...new Set(allKeywords)];
        tags.Keywords = unique;
        tags.Subject = unique;
    }

    return tags;
}

/**
 * Write tags with ExifTool. `-overwrite_original` avoids leaving _original
 * sidecar copies next to every processed asset.
 */
export async function writeMetadata(exiftool, filePath, tags) {
    if (!tags || Object.keys(tags).length === 0) return false;
    // exiftool-vendored takes extra args as a plain string[] third parameter.
    await exiftool.write(filePath, tags, ['-overwrite_original']);
    return true;
}

/**
 * Identity and location fields that a source image may already carry.
 *
 * A stock photo, a client hand-off, or a previously branded asset arrives with
 * someone else's copyright, contact details and location baked in. Those fields
 * are not all overwritten by the tag set we write, so without clearing them the
 * output would claim the wrong owner or the wrong place. Cleared only when this
 * project supplies its own values to replace them with.
 */
const IDENTITY_TAGS = [
    'Rights', 'Copyright', 'Artist', 'Byline', 'BylineTitle', 'Credit', 'Creator',
    'CreatorContactInfo', 'CreatorAddress', 'CreatorCity', 'CreatorCountry',
    'CreatorPostalCode', 'CreatorRegion', 'CreatorWorkEmail', 'CreatorWorkTelephone',
    'CreatorWorkURL', 'Contact', 'Source', 'OwnerName', 'XPAuthor',
];

const LOCATION_TAGS = [
    'LocationShown', 'LocationCreated', 'City', 'Sub-location', 'Province-State',
    'Country', 'Country-PrimaryLocationName', 'CountryCode', 'PostalCode',
    'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef',
    'GPSAltitude', 'GPSAltitudeRef', 'GPSPosition', 'GPSCoordinates',
];

/**
 * Strip inherited ownership/location before stamping our own.
 * `-TAG=` with an empty value deletes the tag in ExifTool.
 */
export async function clearInheritedMetadata(exiftool, filePath, { brand, location }) {
    const args = ['-overwrite_original'];

    // Wipe the whole IPTC IIM block rather than naming individual tags. IIM uses
    // different spellings from XMP/EXIF for the same concept - `By-line` vs
    // `Creator`, `CopyrightNotice` vs `Rights` - and guessing that list is how a
    // previous owner's name survives. Everything we need is rewritten straight
    // after, so clearing wholesale is both safer and complete.
    if (brand || location) args.push('-IPTC:all=');

    if (brand) args.push(...IDENTITY_TAGS.map((tag) => `-${tag}=`));
    if (location) args.push(...LOCATION_TAGS.map((tag) => `-${tag}=`));

    if (args.length === 1) return false;
    await exiftool.write(filePath, {}, args);
    return true;
}

/**
 * Copy every tag from a source file, carrying metadata across a format change.
 *
 * Opt-in: it also copies ownership and location, so pair it with
 * `clearInheritedMetadata` unless the source is genuinely your own.
 */
export async function copyMetadata(exiftool, sourcePath, targetPath) {
    await exiftool.write(targetPath, {}, [
        '-overwrite_original',
        '-TagsFromFile',
        sourcePath,
        '-all:all',
    ]);
}
