// Turns dept_clearance.json's prose into something readable on the D-clearance
// page: a long field becomes a list of points, and the emails, web addresses
// and phone numbers written into it become links.

// Abbreviations a sentence can't end on, so "(e.g. MATH 245)" stays whole.
const NOT_AN_END = /(?:\be\.g|\bi\.e|\betc|\bvs|\bapprox|\bNo|\bSt|\bProf|\bDr)\.$/i;

export const sentences = (text) => {
  const out = [];
  for (const piece of text.split(/(?<=[.!?])\s+(?=[A-Z(])/)) {
    if (out.length && NOT_AN_END.test(out[out.length - 1])) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out;
};

// { intro, points }: "Process depends on the course: (1) … (2) …" keeps the
// lead-in as `intro` and makes each numbered case a point; "a | b | c" makes
// each part a point; anything else is split into sentences.
export function toPoints(text) {
  const t = (text ?? "").trim();
  if (!t) return { intro: null, points: [] };
  if (/\(1\)\s/.test(t) && /\(2\)\s/.test(t)) {
    const [head, ...cases] = t.split(/\s*\(\d+\)\s+/);
    return { intro: head.trim() || null, points: cases.map((c) => c.trim()).filter(Boolean) };
  }
  if (t.includes(" | ")) {
    const [first, ...rest] = t.split(" | ");
    // "Each section has its own contact — email the professor: WRIT 320 (…): a@usc.edu"
    const m = first.match(/^(.*?:)\s+(.+)$/);
    return m ? { intro: m[1], points: [m[2], ...rest].map((p) => p.trim()) } : { intro: null, points: [first, ...rest].map((p) => p.trim()) };
  }
  return { intro: null, points: sentences(t) };
}

// "Declared CSCI majors: submit …" -> ["Declared CSCI majors:", "submit …"],
// so a point's case can be shown in bold. Only a short lead-in counts.
export function splitLabel(point) {
  const m = point.match(/^([^:.]{2,90}):\s+(.+)$/s);
  return m && !/https?$|@/.test(m[1]) ? [`${m[1]}:`, m[2]] : [null, point];
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const URL_ = /https?:\/\/[^\s<>()"]+|\b(?:[a-z0-9-]+\.)+(?:usc\.edu|google\.com|gle|org)(?:\/[^\s<>()",;]*)?/i;
const PHONE = /\(?\b\d{3}\)?[-\s]\d{3}-\d{4}\b/;
const TOKEN = new RegExp(`(${EMAIL.source})|(${URL_.source})|(${PHONE.source})`, "gi");

// [{ text }, { text, href }, …] for a string, with emails, web addresses and
// phone numbers as links. Sentence punctuation after an address stays text.
export function linkify(text) {
  const out = [];
  let last = 0;
  for (const m of (text ?? "").matchAll(TOKEN)) {
    let [match] = m;
    const trail = match.match(/[.,;:]+$/)?.[0] ?? "";
    match = match.slice(0, match.length - trail.length);
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const href = m[1] ? `mailto:${match}` : m[2] ? (/^https?:/i.test(match) ? match : `https://${match}`) : `tel:${match.replace(/\D/g, "")}`;
    out.push({ text: match, href });
    if (trail) out.push({ text: trail });
    last = m.index + m[0].length;
  }
  if (last < (text ?? "").length) out.push({ text: text.slice(last) });
  return out;
}

// A long address shown in full would run off a phone, so its path is cut short.
// Google Drive and Forms links are opaque ids, so they're named instead.
export const shortUrl = (text) => {
  if (/^(?:https?:\/\/)?drive\.google\.com\//i.test(text)) return "Google Drive file";
  if (/^(?:https?:\/\/)?(?:docs\.google\.com\/forms|forms\.gle)\//i.test(text)) return "Google Form";
  const bare = text.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [host, ...path] = bare.split("/");
  const rest = path.join("/");
  return rest.length > 28 ? `${host}/…` : bare;
};

// A long comma-separated list ("ACAD 176 (…), ACAD 177 (…), …") as its items,
// split only outside parentheses; null when the text isn't one.
export function listItems(text) {
  if (text.length < 300) return null;
  const items = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && text.startsWith(", ", i)) { items.push(text.slice(start, i)); start = i + 2; }
  }
  items.push(text.slice(start));
  const clean = items.map((s) => s.replace(/^(?:and|or)\s+/, "").replace(/\.$/, "").trim()).filter(Boolean);
  return clean.length >= 5 ? clean : null;
}
