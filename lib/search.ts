/**
 * What "matching" means when someone types into a search box here.
 *
 * Every word has to appear somewhere in the thing being searched — the project
 * name or any of its file names — so "summa about" finds the About page in
 * Summa Planning Group, and the order the words are typed in does not matter.
 * Nobody searching a list of five projects wants ranking; they want the two
 * that are relevant and the rest out of the way.
 */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesSearch(terms: string[], ...fields: (string | string[] | null | undefined)[]): boolean {
  if (terms.length === 0) return true;
  const haystack = fields
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.every((t) => haystack.includes(t));
}
