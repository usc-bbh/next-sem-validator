// Design tokens shared with the BBH website (usc-bbh/bbh-website), so RegCheck
// looks like one of its tools: warm off-white page, white cards, USC cardinal
// as the accent, muted gold used sparingly, Space Grotesk for headings and
// labels, Inter for body text.
export const C = {
  page: "#F7F7F5",
  card: "#FFFFFF",
  ink: "#1C1C1F",
  body: "#52525B",
  muted: "#5B5B63",
  faint: "#71717A",
  line: "rgba(0,0,0,0.08)",
  lineStrong: "rgba(0,0,0,0.15)",
  cardinal: "#990000",
  cardinalTint: "rgba(153,0,0,0.1)",
  gold: "#B8952E",
  goldLine: "rgba(212,175,55,0.4)",
  ok: "#16A34A",
  warn: "#A16207",
  bad: "#C1121F",
};

export const HEAD = "'Space Grotesk', sans-serif";
export const BODY = "'Inter', sans-serif";

export const SHADOW = "0 18px 40px -24px rgba(28,28,31,0.25)";

// Small letter-spaced uppercase label, the BBH site's section eyebrow.
export const eyebrow = { fontSize: 10.5, letterSpacing: 2, color: C.muted, fontFamily: HEAD, fontWeight: 600, textTransform: "uppercase" };

export const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: SHADOW };

export const primaryButton = { padding: "10px 22px", background: C.cardinal, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: HEAD, letterSpacing: 0.5, cursor: "pointer" };

export const secondaryButton = { padding: "9px 16px", background: C.card, color: C.ink, border: `1px solid ${C.lineStrong}`, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: HEAD, letterSpacing: 0.3, cursor: "pointer" };
