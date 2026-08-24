/**
 * Canonical artist identity.
 *
 * This must be the ONLY place an artist id is derived. Upload previously built
 * ids with hyphens (`artist_daft-punk`) while the artist index built them with
 * underscores (`artist_daft_punk`), so the same artist existed under two ids and
 * anything keyed on artistId silently split in half.
 */
export function slugifyArtistId(artistName: string): string {
  const slug = (artistName || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritics so "Beyoncé" == "Beyonce"
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return 'artist_' + (slug || 'unknown');
}
