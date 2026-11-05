import React, { useState, useMemo, useEffect, useRef } from "react";
import { parseStarsReport } from "../stars-parser";
import StarsReview, { GraduateNotice, StarsSideBySide } from "./StarsReview";
import Tour from "./Tour";
import About, { ResultsDisclaimer } from "./About";
import { pageFromHash, hashForPage } from "./route";
import { calendarRange, hasTime, toMin } from "./calendarRange";
import { INITIAL_STARS, hasUsableReport, canValidate as validateAllowed, reportHint } from "./validateGate";
import { C, HEAD, BODY, SHADOW, eyebrow, card, primaryButton, secondaryButton } from "./theme";
import { EMPTY_REPORT } from "./emptyReport";
import { VALIDATOR_ASSETS } from "./validatorAssets";

// ─────────────────────────────────────────────────────────────
// Catalog loader — fetches the full scraped catalog from public/catalog.json.
// The file is shaped as a flat object keyed by course name, each value
// matching the v6 course schema (course_name, units, sections, etc.).
// ─────────────────────────────────────────────────────────────
function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("./catalog.json", { credentials: "omit", cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Catalog fetch failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return { catalog, catalogError: error, catalogLoading: !catalog && !error };
}

// One-time notices and the tour remember they've been seen in this browser.
// Storage can be blocked (private windows); they then just show again.
const seen = (key) => {
  try { return localStorage.getItem(`regcheck.${key}`) === "1"; } catch { return false; }
};
const markSeen = (key) => {
  try { localStorage.setItem(`regcheck.${key}`, "1"); } catch { /* blocked: shows again next visit */ }
};

const fmt = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, "0")}${ampm}`;
};

// ─────────────────────────────────────────────────────────────
// Calendar — widens for weekend, early and late classes (calendarRange.js)
// ─────────────────────────────────────────────────────────────
// Course accent colors — chosen to stay legible on a white background,
// anchored by USC cardinal for the first course.
const PALETTE = ["#990000", "#16A34A", "#1d4ed8", "#A16207", "#6f42c1", "#0e7490", "#b3006b"];

// Seat-availability colours for the calendar. Matches the same fullness
// test the validator uses (is_full OR zero open seats), so a block can't
// read "open" while the validator fails it for being full.
const SEAT_OPEN = C.ok;
const SEAT_FULL = C.bad;
const isOpen = (s) => !s.is_full && s.open_seats !== 0;

const CAL_PAD = 10; // px above the first hour line and below the last

function Calendar({ blocks }) {
  const { days, dayStart, dayEnd } = calendarRange(blocks);
  const span = dayEnd - dayStart;

  const hours = [];
  for (let h = dayStart / 60; h <= dayEnd / 60; h++) hours.push(h);

  // Scale height: ~36 px per hour, minimum 400
  const calHeight = Math.max(400, Math.round((span / 60) * 36));

  return (
    <div style={{ ...card, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `46px repeat(${days.length}, 1fr)`, background: "#FAFAF9", borderBottom: `1px solid ${C.line}` }}>
        <div />
        {days.map((d) => (
          <div key={d} style={{ ...eyebrow, padding: "12px 0", textAlign: "center", borderLeft: `1px solid ${C.line}` }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `46px repeat(${days.length}, 1fr)`, position: "relative", height: calHeight + 2 * CAL_PAD }}>
        {/* hour gutter. Each column's hours sit CAL_PAD in from the top and bottom, so
            the first and last labels, centred on their lines, aren't cut off. */}
        <div style={{ position: "absolute", inset: `${CAL_PAD}px auto ${CAL_PAD}px 0`, width: 46 }}>
          {hours.map((h) => (
            <div key={h} style={{ position: "absolute", top: `${((h * 60 - dayStart) / span) * 100}%`, right: 8, transform: "translateY(-50%)", fontSize: 10, color: C.faint, fontFamily: HEAD }}>
              {h % 12 || 12}{h < 12 ? "a" : "p"}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} style={{ position: "relative", borderLeft: "1px solid #ededf0", gridColumn: days.indexOf(day) + 2 }}>
            <div style={{ position: "absolute", inset: `${CAL_PAD}px 0` }}>
            {hours.map((h) => (
              <div key={h} style={{ position: "absolute", top: `${((h * 60 - dayStart) / span) * 100}%`, left: 0, right: 0, borderTop: "1px solid #f2f2f4" }} />
            ))}
            {blocks.filter((b) => b.days.includes(day)).map((b) => {
              const top = ((toMin(b.start_time) - dayStart) / span) * 100;
              const height = ((toMin(b.end_time) - toMin(b.start_time)) / span) * 100;
              return (
                <div key={`${b.section_id}-${day}`} title={`${b.course_name} ${b.section_id}`}
                  style={{ position: "absolute", top: `${top}%`, height: `${height}%`, left: 3, right: 3,
                    background: `${b.color}14`, borderLeft: `3px solid ${b.color}`, borderRadius: 7,
                    padding: "4px 7px", overflow: "hidden", fontSize: 10, lineHeight: 1.3, boxShadow: `0 2px 6px ${b.color}1f` }}>
                  <div style={{ fontWeight: 700, color: b.color, whiteSpace: "nowrap" }}>{b.course_name}</div>
                  <div style={{ color: "#6b6b72", whiteSpace: "nowrap" }}>{b.section_type.replace(/s$/, "")} · {b.section_id}</div>
                </div>
              );
            })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────
const STATUS = {
  fail: { bg: "#FDF2F2", border: "rgba(193,18,31,0.25)", dot: C.bad, label: "Blocker", icon: "!" },
  warning: { bg: "#FEFAEC", border: C.goldLine, dot: C.warn, label: "Heads-up", icon: "!" },
  pass: { bg: "#F0FAF3", border: "rgba(22,163,74,0.3)", dot: C.ok, label: "OK", icon: "✓" },
};

// ─────────────────────────────────────────────────────────────
// Pyodide integration layer.
//
// On mount, loads Pyodide + Tanzil's validator. All validation runs in
// Python, the single source of truth. There is deliberately no JS
// fallback: if Pyodide fails to load (no network, CDN down, served from
// file://), the page says the checker couldn't load and the Validate
// button stays disabled, rather than showing results from a second,
// unmaintained copy of the rules.
//
// To run it locally:
//   1. Serve the app from a local dev server (not file://)
//   2. npm run dev / build copies ../analytics/validate_next_semester.py
//      to public/validator/ (the sync:validator script)
//   3. Pyodide CDN loads automatically
// ─────────────────────────────────────────────────────────────
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const BRIDGE_PY = `
import json
from dataclasses import asdict

def _bridge_validate(planned_json, stars_json, catalog_json, clearance_json):
    planned = json.loads(planned_json)
    stars = json.loads(stars_json)
    catalog = json.loads(catalog_json)
    clearance = json.loads(clearance_json)
    result = validate_next_semester(planned, stars, catalog, clearance)
    return json.dumps(asdict(result))
`;

async function loadPyodideValidator() {
  // Dynamically load the Pyodide script if not already present
  if (typeof globalThis.loadPyodide === "undefined") {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${PYODIDE_CDN}pyodide.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Pyodide CDN script failed to load"));
      document.head.appendChild(s);
    });
  }

  const pyodide = await globalThis.loadPyodide({ indexURL: PYODIDE_CDN });

  // Fetch Tanzil's validator source and the D-clearance rules it checks against.
  // Without the rules there's no D-clearance check, so a failed fetch fails the checker.
  const [resp, clearanceResp] = await Promise.all([
    fetch(VALIDATOR_ASSETS.source.url),
    fetch(VALIDATOR_ASSETS.deptClearance.url),
  ]);
  if (!resp.ok) throw new Error(`Fetch validator failed: ${resp.status}`);
  if (!clearanceResp.ok) throw new Error(`Fetch D-clearance rules failed: ${clearanceResp.status}`);
  let src = await resp.text();
  const deptClearanceJson = await clearanceResp.text();

  // Strip the if __name__ == "__main__" block — it tries to read
  // fixture files from disk which don't exist in the browser.
  src = src.replace(/if\s+__name__\s*==\s*["']__main__["'][\s\S]*/, "");

  // Strip the REPO_ROOT line — it uses __file__, which doesn't exist
  // when code runs via exec() inside Pyodide (no real file on disk).
  // Safe to remove: the only other use of REPO_ROOT is inside the
  // __main__ block already stripped above. dept_clearance is passed
  // in as a parameter, not read from this path, in the real function.
  src = src.replace(/^REPO_ROOT\s*=.*$/m, "REPO_ROOT = None  # patched for Pyodide — __file__ unavailable");

  await pyodide.runPythonAsync(src);
  await pyodide.runPythonAsync(BRIDGE_PY);

  return { pyodide, deptClearanceJson };
}

export default function App() {
  const { catalog, catalogError, catalogLoading } = useCatalog();

  const [expanded, setExpanded] = useState([]);   // course names shown in picker
  const [picked, setPicked] = useState({});        // section_id -> {course_name, ...section}
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [validating, setValidating] = useState(false);
  // "home" or "about", kept in the URL hash so the back button moves between them.
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  useEffect(() => {
    const onPop = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goTo = (next) => {
    if (next !== page) window.history.pushState(null, "", hashForPage(next) || window.location.pathname + window.location.search);
    setPage(next);
    window.scrollTo(0, 0);
  };

  // ── STARS upload state ──
  // There's no report until the student uploads one. A parsed report is used as read
  // ("parsed") and the student is pointed at the review screen rather than
  // dropped into it; saving there makes it "confirmed". A failed parse opens
  // the review screen, since there's nothing to use (STARS_PARSER_DESIGN.md §9).
  const [starsReport, setStarsReport] = useState(INITIAL_STARS.report);
  const [starsSource, setStarsSource] = useState(INITIAL_STARS.source);
  const [starsStatusMsg, setStarsStatusMsg] = useState("");
  const [review, setReview] = useState(null); // { mode: "parsed" | "failed", initial, failure, pdfUrl, view: "dialog" | "side" }
  // Where Cancel on the review screen returns to: no report, or the report
  // the student had before.
  const sourceBeforeReview = useRef("none");
  const fileInputRef = useRef(null);
  // The PDF behind the report in use, for the side-by-side view. A review
  // carries its own, adopted on save. Never leaves the browser.
  const [pdfUrl, setPdfUrl] = useState(null);
  // Whether the student has opened their details since this upload.
  const [looked, setLooked] = useState(false);
  const [showUploadNotice, setShowUploadNotice] = useState(false);
  const [validateWarning, setValidateWarning] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Before a report there's only the upload step to show. Someone who
  // finishes that gets the rest of the tour once their report loads.
  const [tourFrom, setTourFrom] = useState(null);
  const [resumeTour, setResumeTour] = useState(false);

  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  const openReview = (next) => {
    if (starsSource !== "review") sourceBeforeReview.current = starsSource;
    setReview({ view: "dialog", ...next });
    setStarsSource("review");
    setLooked(true);
    setValidateWarning(false);
  };
  // Details open beside the PDF when there is one; the student can pop them out.
  const openCurrentReport = () => openReview({ mode: "parsed", initial: starsReport, failure: null, pdfUrl, view: pdfUrl ? "side" : "dialog" });

  const handleStarsUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again re-triggers this
    if (!file) return;

    sourceBeforeReview.current = starsSource;
    setStarsSource("parsing");
    setStarsStatusMsg("Reading file…");
    setResult(null);
    setLooked(false);
    setValidateWarning(false);

    const fileUrl = URL.createObjectURL(file);
    let failure = null;
    const parsed = await parseStarsReport(file, {
      onStatus: (msg) => setStarsStatusMsg(msg),
      onFailure: (err) => { failure = err; },
    });

    if (parsed) {
      setStarsReport(parsed);
      setPdfUrl(fileUrl);
      setStarsSource("parsed");
      if (!seen("uploadNotice")) setShowUploadNotice(true);
    } else if (failure?.check === "graduate") {
      URL.revokeObjectURL(fileUrl);
      setStarsSource("graduate");
    } else {
      // A failed parse opens the same screen, empty, with the reason.
      openReview({ mode: "failed", initial: EMPTY_REPORT, failure, pdfUrl: fileUrl });
    }
  };

  const dismissUploadNotice = () => {
    markSeen("uploadNotice");
    setShowUploadNotice(false);
  };

  // The tour spotlights the main page, so it starts from there.
  const startTour = () => {
    goTo("home");
    setTourFrom(null);
    setShowTour(true);
  };

  const closeTour = (finished) => {
    markSeen("tourDone");
    setShowTour(false);
    setResumeTour(finished && !starsReport);
  };

  useEffect(() => {
    if (resumeTour && starsReport && !review) {
      setResumeTour(false);
      setTourFrom("search");
      setShowTour(true);
    }
  }, [resumeTour, starsReport, review]);

  const confirmReview = (confirmed) => {
    setStarsReport(confirmed);
    setPdfUrl(review.pdfUrl);
    setStarsSource("confirmed");
    setReview(null);
    setResult(null);
  };

  const cancelReview = () => {
    setReview(null);
    setStarsSource(sourceBeforeReview.current);
  };

  // Pyodide state
  const [pyodideStatus, setPyodideStatus] = useState("loading"); // "loading" | "ready" | "failed"
  const pyodideRef = useRef(null);
  const deptClearanceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPyodideValidator()
      .then(({ pyodide, deptClearanceJson }) => {
        if (cancelled) return;
        pyodideRef.current = pyodide;
        deptClearanceRef.current = deptClearanceJson;
        setPyodideStatus("ready");
        console.log("[validator] Pyodide loaded — using Python validator.");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[validator] Couldn't load the checker:", err.message);
        setPyodideStatus("failed");
      });
    return () => { cancelled = true; };
  }, []);

  const courseNames = useMemo(() => catalog ? Object.keys(catalog) : [], [catalog]);

  // Detect whether registration has opened yet. When every section in the
  // catalog has registered_seats === 0, registration hasn't started and the
  // "N open" seat counts are meaningless (everything would say "open").
  const registrationOpen = useMemo(() => {
    if (!catalog) return true; // assume open until proven otherwise
    for (const entry of Object.values(catalog)) {
      for (const secs of Object.values(entry.sections || {})) {
        for (const s of secs) {
          if (s.registered_seats > 0) return true;
        }
      }
    }
    return false;
  }, [catalog]);

  // Helper: collect all unique instructor names for a course (skipping TBD)
  const getInstructors = (entry) => {
    if (!entry?.sections) return [];
    const names = new Set();
    for (const secs of Object.values(entry.sections)) {
      for (const s of secs) {
        if (s.instructor && s.instructor !== "TBD") names.add(s.instructor);
      }
    }
    return [...names];
  };

  const suggestions = useMemo(() => {
    if (!query.trim() || !catalog) return [];
    const q = query.toLowerCase().replace(/[\s-]/g, "");
    return courseNames.filter((c) => {
      if (expanded.includes(c)) return false;
      // Match on course code
      if (c.replace(/\s/g, "").toLowerCase().includes(q)) return true;
      const entry = catalog[c];
      if (!entry) return false;
      // Match on description
      if (entry.description?.toLowerCase().replace(/[\s-]/g, "").includes(q)) return true;
      // Match on instructor name
      const instructors = getInstructors(entry);
      if (instructors.some((name) => name.toLowerCase().replace(/[\s-]/g, "").includes(q))) return true;
      return false;
    }).slice(0, 8);
  }, [query, expanded, courseNames, catalog]);

  const colorFor = (courseName) => PALETTE[expanded.indexOf(courseName) % PALETTE.length];

  const addCourse = (c) => {
    if (expanded.includes(c)) return; // prevent duplicates
    setExpanded((e) => [...e, c]); setQuery(""); setResult(null);
  };
  const removeCourse = (c) => {
    setExpanded((e) => e.filter((x) => x !== c));
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([, s]) => s.course_name !== c)));
    setResult(null);
  };
  const toggleSection = (courseName, section) => {
    setResult(null);
    setPicked((p) => {
      const n = { ...p };
      if (n[section.section_id]) {
        // Deselecting
        delete n[section.section_id];
      } else {
        // Selecting — deselect any other section of the same type for this
        // course first (e.g. swap lectures, don't stack two lectures).
        for (const [id, s] of Object.entries(n)) {
          if (s.course_name === courseName && s.section_type === section.section_type) {
            delete n[id];
          }
        }
        n[section.section_id] = { ...section, course_name: courseName };
      }
      return n;
    });
  };

  const pickedList = Object.values(picked);
  // Calendar blocks are coloured by seat availability, not by course:
  // green = seats open, cardinal = full. Same two colours the section
  // picker already uses for its "N open" / "Full" label, so the two
  // views agree. Per-course accent colours (colorFor) still drive the
  // course cards in the left column.
  const blocks = pickedList
    .filter(hasTime)
    .map((s) => ({ ...s, color: isOpen(s) ? SEAT_OPEN : SEAT_FULL }));

  // Build the section-aware payload we agreed with Tanzil:
  //   [{ course: "CSCI 104", sections: ["29903", "30119"] }]
  const payload = expanded.map((c) => ({
    course: c,
    sections: pickedList.filter((s) => s.course_name === c).map((s) => s.section_id),
  }));

  const totalUnits = expanded.reduce((sum, c) => sum + (catalog?.[c]?.units || 0), 0);

  // Sections are required on every entry, so the GUI enforces it rather than
  // letting an invalid payload reach the validator.
  const needSections = payload.filter((p) => !p.sections.length).map((p) => p.course);
  const checkerReady = pyodideStatus === "ready"; // set only after pyodideRef is populated
  // Validation needs a report: prerequisites and already-taken courses are
  // checked against it.
  const hasReport = hasUsableReport(starsSource);
  const canValidate = validateAllowed({
    source: starsSource, courseCount: expanded.length, needSections, catalogReady: !!catalog, checkerReady, validating,
  });
  const starsHint = reportHint(starsSource);

  // The first time someone validates a report they never opened, say so once.
  const onValidateClick = () => {
    if (starsSource === "parsed" && !looked && !seen("validateWarning")) {
      markSeen("validateWarning");
      setValidateWarning(true);
      return;
    }
    runValidate();
  };

  const runValidate = async () => {
    if (!checkerReady) return;
    setValidateWarning(false);
    setValidating(true);
    try {
      // Tanzil's Python validator, via Pyodide.
      const bridge = pyodideRef.current.globals.get("_bridge_validate");
      const resultJson = bridge(
        JSON.stringify(payload),
        JSON.stringify(starsReport),
        JSON.stringify(catalog),
        deptClearanceRef.current
      );
      setResult(JSON.parse(resultJson));
    } catch (err) {
      console.error("[validator] Validation error:", err);
      setResult({
        overall_status: "invalid",
        course_results: [{ course: "System", status: "fail", reasons: [`Validation error: ${err.message}`] }],
        summary: { total_units: totalUnits, warnings: [] },
      });
    }
    setValidating(false);
  };

  // ── Loading / error states ──
  if (catalogLoading) {
    return (
      <div style={{ fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.page }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ ...eyebrow, color: C.cardinal, letterSpacing: 4, marginBottom: 10 }}>RegCheck</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontFamily: HEAD }}>Loading course catalog…</div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>Spring 2027</div>
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div style={{ fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.page }}>
        <div style={{ textAlign: "center", color: C.bad, maxWidth: 400 }}>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: HEAD }}>Failed to load course catalog</div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: C.muted }}>{catalogError}</div>
          <div style={{ fontSize: 12, marginTop: 12, color: C.muted }}>Make sure <code>public/catalog.json</code> exists.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY, background: C.page, color: C.ink, minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: rgba(153,0,0,0.2); color: #1C1C1F; }
        .mono { font-family: 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; }
        .serif { font-family: 'Space Grotesk', sans-serif; }
        .outline-btn:hover { border-color: #990000 !important; color: #990000 !important; }
        .layout { display: grid; grid-template-columns: minmax(340px, 430px) 1fr; gap: 28px; align-items: start; }
        .sticky-col { position: sticky; top: 84px; }
        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .sticky-col { position: static; }
        }
        @media (max-width: 640px) { .step-arrow { display: none; } }
        button { transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .18s ease, transform .1s ease; }
        button:focus-visible { outline: 2px solid #990000; outline-offset: 2px; }
        input:focus { outline: none; border-color: #990000; box-shadow: 0 0 0 3px rgba(153,0,0,0.14); }
        .course-card { transition: border-color .18s ease, box-shadow .18s ease; }
        .course-card:hover { border-color: rgba(0,0,0,0.14); box-shadow: 0 22px 44px -24px rgba(28,28,31,0.35); }
        .suggestion:hover { background: rgba(153,0,0,0.06) !important; }
        .section-row:hover { background: #FAFAF9 !important; border-color: rgba(0,0,0,0.12) !important; }
        .remove-btn:hover { color: #c1121f !important; background: rgba(193,18,31,0.1) !important; }
        .validate-btn:not(:disabled):hover { background: #7d0000 !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #F7F7F5; }
        ::-webkit-scrollbar-thumb { background: rgba(153,0,0,0.3); border-radius: 3px; }
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 40, height: 64, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="https://usc-bbh.github.io/bbh-website/" target="_blank" rel="noopener noreferrer" title="BUAI Builder Hub" style={{ display: "flex" }}>
            {/* Same mark as public/favicon.svg; keep the two in step. */}
            <svg width={28} height={28} viewBox="0 0 48 48" role="img" aria-label="RegCheck" style={{ display: "block" }}>
              <defs>
                <linearGradient id="regcheck-mark-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#A30000" />
                  <stop offset="1" stopColor="#7A0000" />
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="12" fill="url(#regcheck-mark-grad)" />
              <path d="M13 22 L20.5 29.5 L35 15" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="13" y="35" width="22" height="3.5" rx="1.75" fill="#D4AF37" />
            </svg>
          </a>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: HEAD, color: C.cardinal, letterSpacing: 0.5 }}>RegCheck</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={startTour}
            style={{ fontSize: 12, letterSpacing: 0.3, fontFamily: HEAD, fontWeight: 600, borderRadius: 6, padding: "6px 12px",
              color: C.cardinal, border: `1px solid ${C.cardinal}`, background: C.cardinalTint, cursor: "pointer" }}>
            Take the tour
          </button>
          <button onClick={() => goTo("about")} aria-current={page === "about" ? "page" : undefined}
            style={{ fontSize: 10.5, letterSpacing: 1, fontFamily: HEAD, fontWeight: 600, borderRadius: 5, padding: "4px 9px",
              color: page === "about" ? C.ink : C.muted, border: `1px solid ${page === "about" ? C.lineStrong : C.line}`, background: page === "about" ? "#FAFAF9" : "transparent", cursor: "pointer" }}>
            About
          </button>
        </div>
      </nav>

      {page === "about" ? <About onBack={() => goTo("home")} onTour={startTour} /> : (<>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "36px 28px 0" }}>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", fontFamily: HEAD, fontWeight: 700, color: C.ink, lineHeight: 1.05, margin: 0 }}>
          Reg<span style={{ color: C.cardinal }}>Check</span>
        </h1>
        <p style={{ fontSize: "clamp(18px, 2.4vw, 22px)", fontFamily: HEAD, fontWeight: 600, color: C.ink, lineHeight: 1.3, maxWidth: 680, margin: "12px 0 0" }}>
          Find out what will block your registration before WebReg does.
        </p>
        <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, maxWidth: 680, margin: "8px 0 0" }}>
          RegCheck flags missing prerequisites,
          D-clearance, time conflicts, missing labs or discussions, and courses you've already taken, so you can fix
          them before your registration window opens.
        </p>

        <Steps current={!hasReport ? 1 : pickedList.length === 0 ? 2 : 3} />

        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleStarsUpload} style={{ display: "none" }} />
        {/* Until there's a report, the upload card is the one thing to do, so it's outlined in cardinal. */}
        <div data-tour="stars" style={{ ...card, marginTop: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          ...(!hasReport && { border: `1.5px solid ${C.cardinal}`, boxShadow: `0 0 0 4px ${C.cardinalTint}` }) }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ ...eyebrow, marginBottom: 4, ...(!hasReport && { color: C.cardinal }) }}>{hasReport ? "Your STARS report" : "Start here"}</div>
            <div style={{ fontSize: 14, color: C.ink }}>
              {starsSource === "parsing" ? (starsStatusMsg || "Reading your report…")
                : starsSource === "review" ? "Check what we read from your report…"
                : hasReport ? <>
                    <span style={{ color: C.ok, fontWeight: 600 }}>{starsSource === "confirmed" ? "✓ Checked" : "✓ Read"}</span> · {starsReport.classLevel ?? "No class level"} · {starsReport.completedCourses.length} completed courses
                  </>
                : <>Upload your report, printed to PDF from experience.usc.edu. It stays on your device and is never sent to a server.</>}
            </div>
          </div>
          {hasReport && <button onClick={openCurrentReport} className="outline-btn" style={secondaryButton}>View details</button>}
          <button onClick={() => fileInputRef.current?.click()} disabled={starsSource === "parsing"}
            className={hasReport ? "outline-btn" : undefined}
            style={hasReport ? secondaryButton : primaryButton}>
            {hasReport ? "Replace STARS PDF" : "Upload STARS PDF"}
          </button>
        </div>

        {showUploadNotice && starsSource === "parsed" && (
          <div role="status" style={{ marginTop: 10, padding: "12px 16px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 10, fontSize: 13, color: C.body, lineHeight: 1.6, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.warn, fontWeight: 700, marginBottom: 2 }}>Before you rely on this</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>We read your courses straight from the PDF, and the reader can get things wrong. <button onClick={openCurrentReport} style={linkButton}>Check your details</button>.</li>
                <li>Your report stays on your device. It's never sent to a server or saved.</li>
                {(starsReport.meta?.redacted || starsReport.gpa === null) && (
                  <li>{starsReport.meta?.redacted ? "Your report is redacted, so grades show as hidden and your GPA isn't on it." : "Your GPA isn't on your report."} Add it in your details if you want GPA minimums checked.</li>
                )}
              </ul>
            </div>
            <button onClick={dismissUploadNotice} className="outline-btn" style={{ ...secondaryButton, padding: "6px 12px", flexShrink: 0 }}>Got it</button>
          </div>
        )}
      </div>

      {review?.view === "dialog" && (
        <StarsReview key={review.mode + (review.failure?.check ?? "")} initial={review.initial} mode={review.mode}
          failure={review.failure} onConfirm={confirmReview} onCancel={cancelReview}
          onSideBySide={review.pdfUrl ? (draft) => setReview({ ...review, initial: draft, view: "side" }) : undefined} />
      )}
      {review?.view === "side" && (
        <StarsSideBySide initial={review.initial} mode={review.mode} failure={review.failure} pdfUrl={review.pdfUrl}
          onConfirm={confirmReview} onCancel={cancelReview}
          onExpand={(draft) => setReview({ ...review, initial: draft, view: "dialog" })} />
      )}
      {showTour && !review && starsSource !== "graduate" && <Tour from={tourFrom} onClose={closeTour} />}
      {starsSource === "graduate" && (
        <GraduateNotice onClose={() => setStarsSource(sourceBeforeReview.current)} />
      )}

      {/* Courses and the calendar come after the report: upload is step one. */}
      {starsReport && (
        <div className="layout" style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 28px 0" }}>

          {/* LEFT — pick courses + sections */}
          <div>
            <div data-tour="search" style={{ position: "relative", marginBottom: 18 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Add a course…"
                style={{ width: "100%", background: "#fff", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "13px 16px", color: C.ink, fontSize: 14, fontFamily: "inherit", boxShadow: SHADOW, transition: "border-color .15s ease, box-shadow .15s ease" }} />
              {suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, marginTop: 6, zIndex: 20, overflow: "hidden", boxShadow: "0 14px 34px rgba(0,0,0,0.16)" }}>
                  {suggestions.map((c) => {
                    const entry = catalog[c];
                    const instructors = entry ? getInstructors(entry) : [];
                    const desc = entry?.description || "";
                    // Show first ~60 chars of description
                    const shortDesc = desc.length > 65 ? desc.slice(0, 62) + "..." : desc;
                    const prereq = entry?.prereqs;
                    return (
                      <button key={c} onClick={() => addCourse(c)} className="suggestion"
                        style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "transparent", color: C.ink, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                        <span style={{ minWidth: 0 }}>
                          <span><b>{c}</b> <span style={{ color: C.muted }}>{entry?.units ?? "?"} units</span></span>
                          {prereq && (
                            <span style={{ display: "block", fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                              <span style={{ fontWeight: 600 }}>Prereqs:</span> {prereq.length > 70 ? prereq.slice(0, 67) + "…" : prereq}
                            </span>
                          )}
                          {(instructors.length > 0 || shortDesc) && (
                            <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {instructors.length > 0 && <span style={{ color: C.body }}>{instructors.join(", ")}</span>}
                              {instructors.length > 0 && shortDesc && " · "}
                              {shortDesc}
                            </span>
                          )}
                        </span>
                        <span style={{ color: C.cardinal, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>+</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div data-tour="courses">
            {!registrationOpen && expanded.length > 0 && (
              <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 8, fontSize: 12, color: C.body, lineHeight: 1.5 }}>
                <span style={{ color: C.warn, fontWeight: 700 }}>Registration not yet open.</span>{" "}
                Seat counts show capacity only — no live availability data yet.
              </div>
            )}

            {expanded.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13.5, padding: "32px 20px", textAlign: "center", border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 14, background: "#FFFFFF" }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>No courses yet</div>
                Search above to start building your schedule.
              </div>
            )}

            {expanded.map((courseName) => {
              const entry = catalog[courseName];
              if (!entry) return null;
              const color = colorFor(courseName);
              return (
                <div key={courseName} className="course-card" style={{ ...card, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "12px 15px", background: "#FAFAF9", borderBottom: "1px solid rgba(0,0,0,0.06)", borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.ink, fontFamily: HEAD }}>{courseName}</span>
                      <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{entry.units} units</span>
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {entry.has_d_clearance && <Tag c={C.warn}>D-clear</Tag>}
                      {entry.has_restrictions && <Tag c="#6f42c1">Restricted</Tag>}
                      {entry.has_lab && <Tag c={C.ok}>Lab req</Tag>}
                      {entry.has_discussion && <Tag c={C.ok}>Disc req</Tag>}
                      <button onClick={() => removeCourse(courseName)} className="remove-btn" style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 16, padding: "1px 5px", borderRadius: 6, lineHeight: 1 }}>×</button>
                    </div>
                    </div>
                    {entry.prereqs && (
                      <div style={{ fontSize: 11, color: C.body, marginTop: 6, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: C.muted }}>Prereqs:</span> {entry.prereqs}
                        {entry.coreqs && <> · <span style={{ fontWeight: 600, color: C.muted }}>Coreqs:</span> {entry.coreqs}</>}
                      </div>
                    )}
                    {!entry.prereqs && entry.coreqs && (
                      <div style={{ fontSize: 11, color: C.body, marginTop: 6, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: C.muted }}>Coreqs:</span> {entry.coreqs}
                      </div>
                    )}
                    {entry.description && (
                      <div style={{ fontSize: 11.5, color: C.body, marginTop: 4, lineHeight: 1.45 }}>{entry.description}</div>
                    )}
                  </div>
                  <div style={{ padding: "6px 9px 9px" }}>
                    {Object.entries(entry.sections).map(([group, secs]) => (
                      <div key={group}>
                        <div style={{ ...eyebrow, fontSize: 9.5, padding: "9px 5px 4px" }}>{group}</div>
                        {secs.map((s) => {
                          const on = !!picked[s.section_id];
                          return (
                            <button key={s.section_id} onClick={() => toggleSection(courseName, s)}
                              className={on ? undefined : "section-row"}
                              style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                                background: on ? `${color}14` : "transparent", border: `1px solid ${on ? color + "80" : "rgba(0,0,0,0.06)"}`,
                                borderRadius: 9, padding: "8px 10px", margin: "3px 0", color: C.ink, fontFamily: "inherit" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <span className="mono" style={{ fontSize: 11, color: on ? color : C.faint, width: 44, flexShrink: 0, fontWeight: 500 }}>{s.section_id}</span>
                                <span className="mono" style={{ fontSize: 11.5, color: C.body, whiteSpace: "nowrap" }}>
                                  {s.days.join("/")} {fmt(s.start_time)}–{fmt(s.end_time)}
                                </span>
                                {s.instructor && s.instructor !== "TBD" && (
                                  <span style={{ fontSize: 11, color: C.body, whiteSpace: "nowrap" }}>{s.instructor}</span>
                                )}
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                                {s.has_d_clearance && <span style={{ fontSize: 9.5, color: C.gold, fontWeight: 700, fontFamily: HEAD, border: `1px solid ${C.goldLine}`, borderRadius: 4, padding: "1px 4px" }}>D</span>}
                                <span style={{ fontSize: 11, fontWeight: 600, color: !registrationOpen ? C.muted : s.is_full ? C.bad : C.ok }}>
                                  {!registrationOpen ? `${s.total_seats} seats` : s.is_full ? "Full" : `${s.open_seats} open`}
                                </span>
                                <span style={{ fontSize: 14, color: on ? color : "rgba(0,0,0,0.25)", lineHeight: 1 }}>{on ? "✓" : "+"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* RIGHT — calendar + validate + results */}
          <div className="sticky-col">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.ink, fontFamily: HEAD }}>Your week</span>
              <span className="mono" style={{ fontSize: 12, color: totalUnits > 18 ? C.bad : C.body, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 12px" }}>{totalUnits} {totalUnits === 1 ? "unit" : "units"} · {pickedList.length} {pickedList.length === 1 ? "section" : "sections"}</span>
            </div>

            {expanded.length > 0 && totalUnits > 0 && totalUnits < 12 && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 8, fontSize: 12.5, color: C.body, lineHeight: 1.5 }}>
                <span style={{ color: C.warn, fontWeight: 700 }}>Low unit count:</span> {totalUnits} units is below the typical full-time minimum of 12. Most students take 12–18 units. Check with your advisor if this is intentional.
              </div>
            )}

            {result && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "14px 16px",
                  borderLeft: `4px solid ${result.overall_status === "valid" ? C.ok : result.overall_status === "warning" ? C.warn : C.bad}` }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0,
                    background: result.overall_status === "valid" ? C.ok : result.overall_status === "warning" ? C.warn : C.bad }}>
                    {result.overall_status === "valid" ? "✓" : "!"}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, fontFamily: HEAD }}>
                      {result.overall_status === "valid" ? "Schedule looks good" : result.overall_status === "warning" ? "Needs reviewing" : "Schedule has problems"}
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>
                      {result.summary.total_units} units{result.summary.warnings.map((w, i) => <span key={i}> · {w}</span>)}
                    </div>
                  </div>
                </div>

                <ResultsDisclaimer onShowLimits={() => goTo("about")} />

                {result.course_results.map((cr, i) => {
                  const s = STATUS[cr.status];
                  return (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.dot, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{s.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.ink, fontFamily: HEAD }}>{cr.course}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: HEAD, color: s.dot, marginLeft: "auto", textTransform: "uppercase", letterSpacing: 1.5 }}>{s.label}</span>
                      </div>
                      {cr.reasons.map((r, j) => (
                        <div key={j} style={{ fontSize: 12.5, color: C.body, lineHeight: 1.5, paddingLeft: 27, marginTop: 4 }}>{r}</div>
                      ))}
                    </div>
                  );
                })}
                <div style={{ textAlign: "center", marginTop: 4, marginBottom: 4 }}>
                  <a href="https://github.com/usc-bbh/next-sem-validator/issues/new?labels=wrong-result&title=Wrong+result+report"
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11.5, color: C.muted, textDecoration: "none" }}>
                    Something wrong? <span style={{ color: C.cardinal, fontWeight: 600 }}>Report it ↗</span>
                  </a>
                </div>
              </div>
            )}

            <div data-tour="week">
              <Calendar blocks={blocks} />
            </div>


            {validateWarning && (
              <div role="alert" style={{ marginTop: 16, padding: "12px 14px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 10, fontSize: 13, color: C.body, lineHeight: 1.55 }}>
                <div style={{ color: C.warn, fontWeight: 700, marginBottom: 2 }}>You haven't checked your STARS details</div>
                The checker uses what we read from your PDF. If we misread a course, a prerequisite could pass or fail wrongly.
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={openCurrentReport} style={{ ...primaryButton, padding: "8px 14px" }}>Check details</button>
                  <button onClick={runValidate} disabled={!canValidate} className="outline-btn" style={{ ...secondaryButton, padding: "8px 14px" }}>Validate anyway</button>
                </div>
              </div>
            )}

            <button data-tour="validate" onClick={onValidateClick} disabled={!canValidate} className="validate-btn"
              style={{ ...primaryButton, width: "100%", marginTop: 16, padding: "14px", fontSize: 13.5, letterSpacing: 1, textTransform: "uppercase",
                cursor: canValidate ? "pointer" : "not-allowed",
                background: canValidate ? C.cardinal : "#E7E7E4", color: canValidate ? "#fff" : "#A1A1AA" }}>
              {validating ? "Validating…" : "Validate schedule"}
            </button>
            {pyodideStatus === "failed" && (
              <div style={{ marginTop: 9, fontSize: 12, color: C.bad, textAlign: "center" }}>
                Couldn't load the checker. Check your connection and refresh the page to try again.
              </div>
            )}
            {pyodideStatus === "loading" && (
              <div style={{ marginTop: 9, fontSize: 12, color: C.muted, textAlign: "center" }}>
                Loading the checker…
              </div>
            )}
            {starsHint && (
              <div style={{ marginTop: 9, fontSize: 12, color: C.muted, textAlign: "center" }}>
                {starsHint}
              </div>
            )}
            {needSections.length > 0 && (
              <div style={{ marginTop: 9, fontSize: 12, color: C.muted, textAlign: "center" }}>
                Pick at least one section for {needSections.join(", ")} to validate.
              </div>
            )}
          </div>
        </div>
      )}

      </>)}

      <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 48, padding: "32px 24px", textAlign: "center", fontSize: 12, color: C.faint, lineHeight: 1.8 }}>
        RegCheck is a <a href="https://usc-bbh.github.io/bbh-website/" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none", fontWeight: 600 }}>BUAI Builder Hub ↗</a> tool · Tools by Students, for Students
      </footer>
    </div>
  );
}

// The three steps, with the one the student is on filled in. Upload is step one:
// nothing below the report card appears until there's a report.
const STEPS = ["Upload your STARS report", "Pick next semester's sections", "Validate before you register"];

function Steps({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px 14px", flexWrap: "wrap", marginTop: 22, fontSize: 13, fontFamily: HEAD }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const on = n === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && <span aria-hidden="true" className="step-arrow" style={{ color: C.faint }}>→</span>}
            <span aria-current={on ? "step" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: on ? C.ink : C.muted, fontWeight: on ? 700 : 500 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                background: done ? C.ok : on ? C.cardinal : "transparent", color: done || on ? "#fff" : C.faint, border: done || on ? "none" : `1px solid ${C.lineStrong}` }}>
                {done ? "✓" : n}
              </span>
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const linkButton = { background: "none", border: "none", padding: 0, color: C.cardinal, fontWeight: 600, fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" };

function Tag({ children, c }) {
  return <span style={{ fontSize: 9.5, color: c, border: `1px solid ${c}4d`, background: `${c}1f`, borderRadius: 6, padding: "2px 7px", fontWeight: 600, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>{children}</span>;
}
