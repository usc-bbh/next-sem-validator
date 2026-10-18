import React, { useState, useMemo, useEffect, useRef } from "react";
import { parseStarsReport } from "../stars-parser";
import StarsReview, { GraduateNotice } from "./StarsReview";
import { EMPTY_REPORT } from "./emptyReport";

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

// Demo fallback only — used before a real STARS PDF is uploaded. The
// validator reads rows without passed/source/origin as passed USC courses,
// so this minimal shape still works.
const DEMO_STARS = {
  completedCourses: [{ code: "CSCI103", grade: "A" }, { code: "MATH225", grade: "B+" }, { code: "WRIT150", grade: "A-" }],
  inProgressCourses: [],
  classLevel: "Junior",
};

const toMin = (t) => {
  if (!t || t === "TBA") return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, "0")}${ampm}`;
};

// ─────────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const SPAN = DAY_END - DAY_START;
// Course accent colors — chosen to stay legible on a white background,
// anchored by USC cardinal for the first course.
const PALETTE = ["#990000", "#1a7f37", "#1d4ed8", "#9a6a00", "#6f42c1", "#0e7490", "#b3006b"];

// Seat-availability colours for the calendar. Matches the same fullness
// test the validator uses (is_full OR zero open seats), so a block can't
// read "open" while the validator fails it for being full.
const SEAT_OPEN = "#1a7f37";
const SEAT_FULL = "#c1121f";
const isOpen = (s) => !s.is_full && s.open_seats !== 0;

function Calendar({ blocks }) {
  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(h);

  return (
    <div style={{ border: "1px solid #dcdce0", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "46px repeat(5, 1fr)", background: "linear-gradient(180deg, #990000, #7d0000)" }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }} />
        {DAYS.map((d) => (
          <div key={d} style={{ padding: "11px 0", textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffcc00", borderBottom: "1px solid rgba(255,255,255,0.15)", borderLeft: "1px solid rgba(255,255,255,0.12)" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "46px repeat(5, 1fr)", position: "relative", height: 470 }}>
        {/* hour gutter */}
        <div style={{ position: "relative" }}>
          {hours.map((h) => (
            <div key={h} style={{ position: "absolute", top: `${((h * 60 - DAY_START) / SPAN) * 100}%`, right: 8, transform: "translateY(-50%)", fontSize: 9.5, color: "#9a9aa0", fontFamily: "'DM Mono', monospace" }}>
              {h % 12 || 12}{h < 12 ? "a" : "p"}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} style={{ position: "relative", borderLeft: "1px solid #ededf0" }}>
            {hours.map((h) => (
              <div key={h} style={{ position: "absolute", top: `${((h * 60 - DAY_START) / SPAN) * 100}%`, left: 0, right: 0, borderTop: "1px solid #f2f2f4" }} />
            ))}
            {blocks.filter((b) => b.days.includes(day)).map((b) => {
              const top = ((toMin(b.start_time) - DAY_START) / SPAN) * 100;
              const height = ((toMin(b.end_time) - toMin(b.start_time)) / SPAN) * 100;
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
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────
const STATUS = {
  fail: { bg: "#fdecea", border: "#f2b8b3", dot: "#c1121f", label: "Blocker", icon: "!" },
  warning: { bg: "#fff8e1", border: "#ffd54f", dot: "#a06a00", label: "Heads-up", icon: "!" },
  pass: { bg: "#eaf7ef", border: "#a7dcb8", dot: "#1a7f37", label: "OK", icon: "✓" },
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
const VALIDATOR_PY_URL = "./validator/validate_next_semester.py";

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

  // Fetch Tanzil's validator source
  const resp = await fetch(VALIDATOR_PY_URL);
  if (!resp.ok) throw new Error(`Fetch validator failed: ${resp.status}`);
  let src = await resp.text();

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

  return pyodide;
}

// Mock dept_clearance data — trimmed to departments relevant to demo.
// Real file (from Tanzil's repo) has ~90 entries; this is a subset for demo
// purposes. Once static hosting is set up, fetch the real dept_clearance.json
// instead of using this constant.
const MOCK_DEPT_CLEARANCE = {
  _schema_version: "1.4",
  _lookup_logic: "Match on dept_code (course prefix) first. If no match, fall back to entries where type='school_fallback' and school matches the course's school.",
  departments: [
    {
      dept_code: "ACCT",
      dept_name: "Accounting (Leventhal School of Accounting)",
      school: "Marshall",
      clearance_required_for: "ACCT 370 and ACCT 371 are D-clearance at all times. Most other ACCT courses switch to D-clearance at the end of Week 2.",
      how_to_get_clearance: "Contact your Leventhal academic advisor or email leventhalug@marshall.usc.edu.",
      contact_email: "leventhalug@marshall.usc.edu",
      contact_office: "Leventhal School of Accounting, ACC 101",
      contact_phone: "(213) 740-4838",
      typical_turnaround: "2-3 business days",
      verified: true,
    },
    {
      dept_code: "BUCO",
      dept_name: "Business Communication (Marshall General)",
      also_covers_prefixes: ["FBE", "DSO", "MOR", "MKT"],
      school: "Marshall",
      clearance_required_for: "BUCO electives switch to D-clearance at the end of Week 1. Directed research, internships, and honors courses are D-clearance at all times.",
      how_to_get_clearance: "Email undergrad.advising@marshall.usc.edu with your full name, USC ID, USC email, course number, major, and graduating semester.",
      contact_email: "undergrad.advising@marshall.usc.edu",
      contact_office: "Jill and Frank Fertitta Hall (JFF) 201",
      contact_phone: "213-740-0690",
      typical_turnaround: "2-3 business days",
      verified: true,
    },
  ],
};

export default function App() {
  const { catalog, catalogError, catalogLoading } = useCatalog();

  const [expanded, setExpanded] = useState([]);   // course names shown in picker
  const [picked, setPicked] = useState({});        // section_id -> {course_name, ...section}
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [validating, setValidating] = useState(false);

  // ── STARS upload state ──
  // starsReport starts as the demo fallback. An uploaded report goes through
  // the review screen (StarsReview) first, and only the version the student
  // confirms reaches the validator (STARS_PARSER_DESIGN.md §9).
  const [starsReport, setStarsReport] = useState(DEMO_STARS);
  const [starsSource, setStarsSource] = useState("demo"); // "demo" | "parsing" | "review" | "confirmed" | "graduate"
  const [starsStatusMsg, setStarsStatusMsg] = useState("");
  const [review, setReview] = useState(null); // { mode: "parsed" | "failed", initial, failure }
  // Where Cancel on the review screen returns to: the demo, or the report
  // the student confirmed before.
  const sourceBeforeReview = useRef("demo");
  const fileInputRef = useRef(null);

  const openReview = (next) => {
    setReview(next);
    setStarsSource("review");
  };

  const handleStarsUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again re-triggers this
    if (!file) return;

    sourceBeforeReview.current = starsSource;
    setStarsSource("parsing");
    setStarsStatusMsg("Reading file…");
    setResult(null);

    let failure = null;
    const parsed = await parseStarsReport(file, {
      onStatus: (msg) => setStarsStatusMsg(msg),
      onFailure: (err) => { failure = err; },
    });

    if (parsed) {
      openReview({ mode: "parsed", initial: parsed, failure: null });
    } else if (failure?.check === "graduate") {
      setStarsSource("graduate");
    } else {
      // A failed parse opens the same screen, empty, with the reason.
      openReview({ mode: "failed", initial: EMPTY_REPORT, failure });
    }
  };

  const confirmReview = (confirmed) => {
    setStarsReport(confirmed);
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

  useEffect(() => {
    let cancelled = false;
    loadPyodideValidator()
      .then((pyodide) => {
        if (cancelled) return;
        pyodideRef.current = pyodide;
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

  const addCourse = (c) => { setExpanded((e) => [...e, c]); setQuery(""); setResult(null); };
  const removeCourse = (c) => {
    setExpanded((e) => e.filter((x) => x !== c));
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([, s]) => s.course_name !== c)));
    setResult(null);
  };
  const toggleSection = (courseName, section) => {
    setResult(null);
    setPicked((p) => {
      const n = { ...p };
      if (n[section.section_id]) delete n[section.section_id];
      else n[section.section_id] = { ...section, course_name: courseName };
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
    .filter((s) => s.start_time && s.days?.length)
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
  // An uploaded report must be confirmed on the review screen first, so no
  // one validates against a course list they never saw.
  const starsReady = starsSource === "demo" || starsSource === "confirmed";
  const canValidate = expanded.length > 0 && needSections.length === 0 && !validating && !!catalog && checkerReady && starsReady;

  const runValidate = async () => {
    if (!checkerReady) return;
    setValidating(true);
    try {
      // Tanzil's Python validator, via Pyodide.
      const bridge = pyodideRef.current.globals.get("_bridge_validate");
      const resultJson = bridge(
        JSON.stringify(payload),
        JSON.stringify(starsReport),
        JSON.stringify(catalog),
        JSON.stringify(MOCK_DEPT_CLEARANCE)
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
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f4f4f5" }}>
        <div style={{ textAlign: "center", color: "#7a7a80" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Loading course catalog...</div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>4,648 courses from Fall 2026 scrape</div>
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f4f4f5" }}>
        <div style={{ textAlign: "center", color: "#c1121f", maxWidth: 400 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Failed to load course catalog</div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#7a7a80" }}>{catalogError}</div>
          <div style={{ fontSize: 12, marginTop: 12, color: "#7a7a80" }}>Make sure <code>public/catalog.json</code> exists.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f4f4f5", color: "#1a1a1a", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@600;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'DM Mono', monospace; }
        .serif { font-family: 'Playfair Display', Georgia, serif; }
        button { transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .18s ease, transform .1s ease; }
        button:focus-visible { outline: 2px solid #990000; outline-offset: 2px; }
        input:focus { outline: none; border-color: #990000; box-shadow: 0 0 0 3px rgba(153,0,0,0.14); }
        .chip:hover { background: rgba(255,255,255,0.28) !important; }
        .course-card { transition: border-color .18s ease, box-shadow .18s ease; }
        .course-card:hover { border-color: #cfcfd4; box-shadow: 0 8px 22px rgba(0,0,0,0.09); }
        .suggestion:hover { background: rgba(153,0,0,0.06) !important; }
        .section-row:hover { background: #f7f7f8 !important; border-color: #e2e2e6 !important; }
        .remove-btn:hover { color: #c1121f !important; background: rgba(193,18,31,0.1) !important; }
        .validate-btn:not(:disabled):hover { box-shadow: 0 8px 22px rgba(153,0,0,0.32); transform: translateY(-1px); }
        .validate-btn:not(:disabled):active { transform: translateY(0); box-shadow: 0 3px 10px rgba(153,0,0,0.28); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); background-clip: padding-box; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div style={{ borderBottom: "3px solid #ffcc00", background: "linear-gradient(180deg, #990000, #7d0000)", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 700, color: "#990000", background: "#ffcc00", boxShadow: "0 3px 10px rgba(0,0,0,0.25)" }}>{"✓"}</div>
          <div>
            <div className="serif" style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", lineHeight: 1.1 }}>RegCheck</div>
            <a href="https://usc-bbh.github.io/bbh-website/" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", marginTop: 3, display: "block", textDecoration: "none" }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}>
              Tools by Students, for Students
            </a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleStarsUpload} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()}
            className="mono chip"
            style={{ fontSize: 11.5, color: starsSource === "confirmed" ? "#eafaef" : "#fff",
              background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            {starsSource === "parsing" ? (starsStatusMsg || "Parsing…")
              : starsSource === "confirmed" ? `✓ STARS checked · ${starsReport.classLevel} · ${starsReport.completedCourses.length} completed · upload another`
              : starsSource === "review" ? "Reviewing your STARS report…"
              : `STARS · ${starsReport.classLevel} (demo) · ${starsReport.completedCourses.length} completed · click to upload your PDF`}
          </button>
          {starsSource === "confirmed" && (
            <button onClick={() => { sourceBeforeReview.current = "confirmed"; openReview({ mode: "parsed", initial: starsReport, failure: null }); }} className="mono chip"
              style={{ fontSize: 11.5, color: "#fff", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              Edit
            </button>
          )}
          <div className="mono" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 5, color: "#fff",
            background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pyodideStatus === "ready" ? "#6ee7a0" : pyodideStatus === "loading" ? "#ffcc00" : "#ff8a80", boxShadow: "0 0 6px currentColor" }} />
            {pyodideStatus === "ready" ? "Python" : pyodideStatus === "loading" ? "Loading Pyodide…" : "Checker unavailable"}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
            {courseNames.length.toLocaleString()} courses
          </div>
        </div>
      </div>

      {review && (
        <StarsReview key={review.mode + (review.failure?.check ?? "")} initial={review.initial} mode={review.mode}
          failure={review.failure} onConfirm={confirmReview} onCancel={cancelReview} />
      )}
      {starsSource === "graduate" && (
        <GraduateNotice onClose={() => setStarsSource(sourceBeforeReview.current)} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 430px) 1fr", gap: 24, padding: 28, alignItems: "start" }}>

        {/* LEFT — pick courses + sections */}
        <div>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a course — search any of 4,648 Fall 2026 courses…"
              style={{ width: "100%", background: "#fff", border: "1px solid #d3d3d8", borderRadius: 10, padding: "12px 15px", color: "#1a1a1a", fontSize: 13.5, fontFamily: "inherit", transition: "border-color .15s ease, box-shadow .15s ease" }} />
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d3d3d8", borderRadius: 10, marginTop: 6, zIndex: 20, overflow: "hidden", boxShadow: "0 14px 34px rgba(0,0,0,0.16)" }}>
                {suggestions.map((c) => {
                  const entry = catalog[c];
                  const instructors = entry ? getInstructors(entry) : [];
                  const desc = entry?.description || "";
                  // Show first ~60 chars of description
                  const shortDesc = desc.length > 65 ? desc.slice(0, 62) + "..." : desc;
                  return (
                    <button key={c} onClick={() => addCourse(c)} className="suggestion"
                      style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #eeeef0", background: "transparent", color: "#1a1a1a", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                      <span style={{ minWidth: 0 }}>
                        <span><b>{c}</b> <span style={{ color: "#7a7a80" }}>{entry?.units ?? "?"} units</span></span>
                        {(instructors.length > 0 || shortDesc) && (
                          <span style={{ display: "block", fontSize: 11, color: "#7a7a80", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {instructors.length > 0 && <span style={{ color: "#5a5a60" }}>{instructors.join(", ")}</span>}
                            {instructors.length > 0 && shortDesc && " · "}
                            {shortDesc}
                          </span>
                        )}
                      </span>
                      <span style={{ color: "#990000", fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>+</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {expanded.length === 0 && (
            <div style={{ color: "#7a7a80", fontSize: 13, padding: "32px 20px", textAlign: "center", border: "1px dashed #cfcfd4", borderRadius: 12, background: "#fafafb" }}>
              <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.55 }}>🔍</div>
              No courses yet. Search above to start building.
            </div>
          )}

          {expanded.map((courseName) => {
            const entry = catalog[courseName];
            if (!entry) return null;
            const color = colorFor(courseName);
            return (
              <div key={courseName} className="course-card" style={{ border: "1px solid #e2e2e6", borderRadius: 12, marginBottom: 13, overflow: "hidden", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "12px 15px", background: "#f6f6f7", borderBottom: "1px solid #eaeaee", borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{courseName}</span>
                    <span style={{ color: "#7a7a80", fontSize: 12, marginLeft: 8 }}>{entry.units} units</span>
                  </div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {entry.has_d_clearance && <Tag c="#a06a00">D-clear</Tag>}
                    {entry.has_restrictions && <Tag c="#6f42c1">Restricted</Tag>}
                    {entry.has_lab && <Tag c="#1a7f37">Lab req</Tag>}
                    {entry.has_discussion && <Tag c="#1a7f37">Disc req</Tag>}
                    <button onClick={() => removeCourse(courseName)} className="remove-btn" style={{ background: "none", border: "none", color: "#9a9aa0", cursor: "pointer", fontSize: 16, padding: "1px 5px", borderRadius: 6, lineHeight: 1 }}>×</button>
                  </div>
                  </div>
                  {entry.description && (
                    <div style={{ fontSize: 11.5, color: "#6b6b72", marginTop: 6, lineHeight: 1.45 }}>{entry.description}</div>
                  )}
                </div>
                <div style={{ padding: "6px 9px 9px" }}>
                  {Object.entries(entry.sections).map(([group, secs]) => (
                    <div key={group}>
                      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9a9aa0", padding: "8px 5px 4px", fontWeight: 700 }}>{group}</div>
                      {secs.map((s) => {
                        const on = !!picked[s.section_id];
                        return (
                          <button key={s.section_id} onClick={() => toggleSection(courseName, s)}
                            className={on ? undefined : "section-row"}
                            style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                              background: on ? `${color}14` : "transparent", border: `1px solid ${on ? color + "80" : "#ededf0"}`,
                              borderRadius: 9, padding: "8px 10px", margin: "3px 0", color: "#1a1a1a", fontFamily: "inherit" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span className="mono" style={{ fontSize: 11, color: on ? color : "#9a9aa0", width: 44, flexShrink: 0, fontWeight: 500 }}>{s.section_id}</span>
                              <span className="mono" style={{ fontSize: 11.5, color: "#6b6b72", whiteSpace: "nowrap" }}>
                                {s.days.join("/")} {fmt(s.start_time)}–{fmt(s.end_time)}
                              </span>
                              {s.instructor && s.instructor !== "TBD" && (
                                <span style={{ fontSize: 11, color: "#5a5a60", whiteSpace: "nowrap" }}>{s.instructor}</span>
                              )}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                              {s.has_d_clearance && <span style={{ fontSize: 9.5, color: "#a06a00", fontWeight: 700, border: "1px solid #ffd54f", background: "#fff8e1", borderRadius: 4, padding: "1px 4px" }}>D</span>}
                              <span style={{ fontSize: 11, fontWeight: 600, color: s.is_full ? "#c1121f" : "#1a7f37" }}>{s.is_full ? "Full" : `${s.open_seats} open`}</span>
                              <span style={{ fontSize: 14, color: on ? color : "#c2c2c8", lineHeight: 1 }}>{on ? "✓" : "+"}</span>
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

        {/* RIGHT — calendar + validate + results */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="serif" style={{ fontSize: 18, fontWeight: 700, color: "#990000" }}>Your week</span>
            <span className="mono" style={{ fontSize: 12, color: totalUnits > 18 ? "#c1121f" : "#5a5a60", background: "#fff", border: "1px solid #e2e2e6", borderRadius: 20, padding: "4px 11px" }}>{totalUnits} units · {pickedList.length} sections</span>
          </div>

          {result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "13px 15px", borderRadius: 12,
                background: result.overall_status === "valid" ? "#eaf7ef" : result.overall_status === "warning" ? "#fff8e1" : "#fdecea",
                border: `1px solid ${result.overall_status === "valid" ? "#a7dcb8" : result.overall_status === "warning" ? "#ffd54f" : "#f2b8b3"}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0,
                  background: result.overall_status === "valid" ? "#1a7f37" : result.overall_status === "warning" ? "#a06a00" : "#c1121f",
                  boxShadow: `0 2px 8px ${result.overall_status === "valid" ? "rgba(26,127,55,0.4)" : result.overall_status === "warning" ? "rgba(160,106,0,0.4)" : "rgba(193,18,31,0.4)"}` }}>
                  {result.overall_status === "valid" ? "✓" : "!"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "#1a1a1a" }}>
                    {result.overall_status === "valid" ? "Schedule looks good" : result.overall_status === "warning" ? "Worth reviewing" : "Schedule has problems"}
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: "#5a5a60", marginTop: 2 }}>
                    {result.summary.total_units} units{result.summary.warnings.map((w, i) => <span key={i}> · {w}</span>)}
                  </div>
                </div>
              </div>

              {result.course_results.map((cr, i) => {
                const s = STATUS[cr.status];
                return (
                  <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.dot, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{s.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a1a" }}>{cr.course}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: s.dot, marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</span>
                    </div>
                    {cr.reasons.map((r, j) => (
                      <div key={j} style={{ fontSize: 12.5, color: "#44444a", lineHeight: 1.5, paddingLeft: 27, marginTop: 4 }}>{r}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <Calendar blocks={blocks} />

          <button onClick={runValidate} disabled={!canValidate} className="validate-btn"
            style={{ width: "100%", marginTop: 16, padding: "13px", borderRadius: 10, border: "none",
              cursor: canValidate ? "pointer" : "not-allowed",
              background: canValidate ? "linear-gradient(135deg, #b3131a, #990000)" : "#e6e6e9",
              color: canValidate ? "#fff" : "#a0a0a6", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
              boxShadow: canValidate ? "0 4px 14px rgba(153,0,0,0.26)" : "none", letterSpacing: "0.01em" }}>
            {validating ? "Validating…" : "Validate schedule"}
          </button>
          {pyodideStatus === "failed" && (
            <div style={{ marginTop: 9, fontSize: 12, color: "#c1121f", textAlign: "center" }}>
              Couldn't load the checker. Check your connection and refresh the page to try again.
            </div>
          )}
          {pyodideStatus === "loading" && (
            <div style={{ marginTop: 9, fontSize: 12, color: "#7a7a80", textAlign: "center" }}>
              Loading the checker…
            </div>
          )}
          {!starsReady && starsSource !== "parsing" && (
            <div style={{ marginTop: 9, fontSize: 12, color: "#7a7a80", textAlign: "center" }}>
              Confirm your STARS details to validate.
            </div>
          )}
          {needSections.length > 0 && (
            <div style={{ marginTop: 9, fontSize: 12, color: "#7a7a80", textAlign: "center" }}>
              Pick at least one section for {needSections.join(", ")} to validate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, c }) {
  return <span style={{ fontSize: 9.5, color: c, border: `1px solid ${c}4d`, background: `${c}1f`, borderRadius: 6, padding: "2px 7px", fontWeight: 600, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>{children}</span>;
}
