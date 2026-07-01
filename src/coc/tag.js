/**
 * Normalises a CoC player/clan tag: trimmed, uppercased, with exactly one
 * leading '#'.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normaliseTag(raw) {
    return `#${raw.trim().toUpperCase().replace(/^#+/, "")}`;
}
