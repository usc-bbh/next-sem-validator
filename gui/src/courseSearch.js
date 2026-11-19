// The course search box: which courses match what the student typed, how many
// the dropdown can show, and whether to say "nothing found".

export const MAX_SUGGESTIONS = 8;

// Every unique instructor name for a course, skipping TBD.
export function getInstructors(entry) {
  if (!entry?.sections) return [];
  const names = new Set();
  for (const secs of Object.values(entry.sections)) {
    for (const s of secs) {
      if (s.instructor && s.instructor !== "TBD") names.add(s.instructor);
    }
  }
  return [...names];
}

const squash = (s) => s.toLowerCase().replace(/[\s-]/g, "");

/**
 * Matches the query against course code, description and instructor names.
 * Returns:
 *   shown    - up to `limit` courses not yet added, for the dropdown
 *   more     - how many further matches the dropdown can't fit
 *   notFound - true when nothing in the catalog matches at all
 *   allAdded - true when matches exist but every one is already in the schedule
 */
export function searchCourses(catalog, query, added = [], limit = MAX_SUGGESTIONS) {
  const empty = { shown: [], more: 0, notFound: false, allAdded: false };
  if (!catalog || !query.trim()) return empty;
  const q = squash(query);

  const matches = Object.keys(catalog).filter((c) => {
    if (squash(c).includes(q)) return true;
    const entry = catalog[c];
    if (!entry) return false;
    if (entry.description && squash(entry.description).includes(q)) return true;
    return getInstructors(entry).some((name) => squash(name).includes(q));
  });

  const open = matches.filter((c) => !added.includes(c));
  return {
    shown: open.slice(0, limit),
    more: Math.max(0, open.length - limit),
    notFound: matches.length === 0,
    allAdded: matches.length > 0 && open.length === 0,
  };
}
