"""Every claim on RegCheck's About page, tested end to end.

About (gui/src/About.jsx) tells students what RegCheck checks and what it doesn't. Each test here
runs the whole validator, the way the site does, on the real Spring 2027 catalog the site loads
(gui/public/catalog.json), the real department rules and a real parsed STARS report, and proves
one claim: that a "checks" item fires when it should and stays quiet when it shouldn't, or that
a "doesn't check" item really isn't checked. about_claims.json maps each claim to its tests, and
About.test.js fails if a claim on the page has none.
"""
import copy
import inspect
import json
import sys
from dataclasses import asdict
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_next_semester import _field_groups, validate_next_semester  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CATALOG = json.loads((REPO / "gui" / "public" / "catalog.json").read_text())
FALL_CATALOG = json.loads((REPO / "data" / "fall2026_catalog.json").read_text())
RULES = json.loads((REPO / "analytics" / "data" / "dept_clearance.json").read_text())
CLAIMS = json.loads((Path(__file__).parent / "about_claims.json").read_text())
# A CSCI junior: CSCI 103, 104, 170, 201, 270, MATH 125, 126, 225 and WRIT 150 done; CSCI 350,
# 356 and WRIT 340 in progress; GPA 3.42.
JUNIOR = json.loads((REPO / "fixtures" / "stars" / "mock_stars_report.json").read_text())


# ---- helpers -----------------------------------------------------------------

def student(base=JUNIOR, **fields):
    stars = copy.deepcopy(base)
    stars.update(fields)
    return stars


def without(stars, *codes):
    """The student never took these."""
    stars = copy.deepcopy(stars)
    stars["completedCourses"] = [c for c in stars["completedCourses"] if c["code"] not in codes]
    stars["inProgressCourses"] = [c for c in stars["inProgressCourses"] if c["code"] not in codes]
    return stars


def taking(stars, code):
    """The student is taking this now instead of having finished it."""
    stars = without(stars, code)
    stars["inProgressCourses"].append({"term": "20263", "code": code, "units": 4, "source": "usc"})
    return stars


def finished(stars, code, grade="B", passed=True):
    stars = without(stars, code)
    stars["completedCourses"].append({"term": "20253", "code": code, "units": 4, "grade": grade, "source": "usc", "passed": passed})
    return stars


def picks(course, lecture=0):
    """A set of sections WebReg would take: a lecture plus the lab and discussion the course
    needs, tied to it by link code and not overlapping it."""
    entry = CATALOG[course]
    groups = entry["sections"]
    lec = groups["lectures"][lecture]
    chosen = [lec]
    for group, needed in (("labs", entry.get("has_lab")), ("discussions", entry.get("has_discussion"))):
        if not needed:
            continue
        options = [s for s in groups.get(group, []) if not s.get("link_code") or s["link_code"] == lec.get("link_code")]
        chosen.append(next(s for s in options if not overlaps(s, lec)))
    return [s["section_id"] for s in chosen]


def overlaps(a, b):
    if not (set(a.get("days") or []) & set(b.get("days") or [])):
        return False
    try:
        return a["start_time"] < b["end_time"] and b["start_time"] < a["end_time"]
    except TypeError:
        return False


def plan(*courses):
    """[("CSCI 360", None)] picks sections; [("CSCI 270", ["30009", ...])] uses the given ones."""
    return [{"course": c, "sections": s or picks(c)} for c, s in courses]


def check(planned, stars=JUNIOR, catalog=CATALOG):
    result = validate_next_semester(planned, stars, catalog, RULES)
    return result, {r.course: r for r in result.course_results}


def text(course_result):
    return " ".join(course_result.reasons)


# ---- the registry --------------------------------------------------------------

def test_every_claim_has_a_test_and_every_test_exists():
    names = {n for n, f in globals().items() if n.startswith("test_") and callable(f)}
    for section in ("checks", "does_not_check"):
        for claim, refs in CLAIMS[section].items():
            python = [r.split(":", 1)[1] for r in refs if r.startswith("python:")]
            assert refs, f"no test for About's claim: {claim}"
            for name in python:
                assert name in names, f"{claim!r} names a test that doesn't exist: {name}"


# ======================================================================================
# What RegCheck checks
# ======================================================================================

# ---- "Prerequisites, counting courses you've finished and ones you're taking now" ----

def test_prereqs_met_by_finished_courses_pass():
    # CSCI 360: (CSCI 104 or CSCI 114) and CSCI 170. The junior finished both.
    _, by = check(plan(("CSCI 360", None)))
    assert by["CSCI 360"].status == "pass", by["CSCI 360"].reasons


def test_a_missing_prereq_blocks():
    _, by = check(plan(("CSCI 360", None)), without(JUNIOR, "CSCI 170"))
    assert by["CSCI 360"].status == "fail"
    assert "CSCI 360 is missing prerequisite(s): CSCI 170." in by["CSCI 360"].reasons


def test_a_prereq_taken_now_counts_and_says_so():
    _, by = check(plan(("CSCI 360", None)), taking(JUNIOR, "CSCI 170"))
    assert by["CSCI 360"].status == "pass"
    assert "CSCI 170 is in progress, which counts toward CSCI 360's prerequisites. You'll need to pass it." in by["CSCI 360"].reasons


def test_any_one_alternative_meets_an_or_group():
    stars = finished(without(JUNIOR, "CSCI 104"), "CSCI 114")
    _, by = check(plan(("CSCI 360", None)), stars)
    assert by["CSCI 360"].status == "pass", by["CSCI 360"].reasons
    _, by = check(plan(("CSCI 360", None)), without(JUNIOR, "CSCI 104"))
    assert "CSCI 360 is missing prerequisite(s): one of CSCI 104 or CSCI 114." in by["CSCI 360"].reasons


def test_courses_taken_together_count_only_as_a_pair():
    # ARCH 406: ARCH 304 or ARCH 214a + ARCH 214b.
    assert CATALOG["ARCH 406"]["prereqs"] == "ARCH 304 or ARCH 214a + ARCH 214b"
    _, by = check(plan(("ARCH 406", None)), finished(JUNIOR, "ARCH 214A"))
    assert "ARCH 406 is missing prerequisite(s): one of ARCH 304 or ARCH 214A + ARCH 214B." in by["ARCH 406"].reasons
    _, by = check(plan(("ARCH 406", None)), finished(finished(JUNIOR, "ARCH 214A"), "ARCH 214B"))
    assert "missing prerequisite" not in text(by["ARCH 406"])


def test_a_failed_or_withdrawn_prereq_doesnt_count():
    for grade in ("F", "W"):
        _, by = check(plan(("CSCI 360", None)), finished(JUNIOR, "CSCI 170", grade=grade, passed=False))
        assert by["CSCI 360"].status == "fail", grade


# The catalog moved prerequisites out of course descriptions into a `prereqs` field, and the
# validator only read descriptions: on the site, CSCI 201 without CSCI 104 passed, along with
# about 1,300 other courses' prerequisites.
def test_prereqs_are_read_from_the_catalogs_prereq_field():
    assert "prereq" not in CATALOG["CSCI 201"]["description"].lower()
    _, by = check(plan(("CSCI 201", None)), without(JUNIOR, "CSCI 104", "CSCI 201", "CSCI 270"))
    assert "CSCI 201 is missing prerequisite(s): one of CSCI 104 or CSCI 114." in by["CSCI 201"].reasons


def test_every_prereq_field_in_the_catalog_can_be_read():
    fields = {e["prereqs"] for e in CATALOG.values() if e.get("prereqs")}
    assert len(fields) > 1000
    assert [f for f in fields if _field_groups(f) is None] == []


# ---- "GPA minimums, when your GPA is on your report or you add it" ----------------

GPA_COURSE = "MATH 596"  # "... must have a minimum 3.0 GPA" (CPT internships)


def test_a_gpa_under_the_minimum_blocks():
    _, by = check(plan((GPA_COURSE, None)), student(gpa=2.8))
    assert by[GPA_COURSE].status == "fail"
    assert f"{GPA_COURSE} requires a 3.0 GPA minimum (yours: 2.8)." in by[GPA_COURSE].reasons


def test_a_gpa_at_or_over_the_minimum_passes():
    for gpa in (3.0, 3.42):
        _, by = check(plan((GPA_COURSE, None)), student(gpa=gpa))
        assert f"{GPA_COURSE} requires a 3.0 GPA minimum (yours: {gpa})." in by[GPA_COURSE].reasons
        assert "GPA minimum" in text(by[GPA_COURSE]) and by[GPA_COURSE].status != "fail"


def test_a_gpa_missing_from_the_report_is_flagged_not_failed():
    # A redacted report has no GPA until the student adds it on the review screen.
    _, by = check(plan((GPA_COURSE, None)), student(gpa=None))
    assert by[GPA_COURSE].status == "warning"
    assert "Your GPA isn't on your report, so this wasn't checked." in text(by[GPA_COURSE])


def test_a_non_major_gpa_minimum_only_warns():
    # PR 209: "Non-majors ... must have a 2.5 GPA". The report can't say whether you're a major.
    _, by = check(plan(("PR 209", None)), student(gpa=2.1))
    assert by["PR 209"].status == "warning"
    assert "requires non-majors to have a 2.5 GPA minimum (yours: 2.1)" in text(by["PR 209"])


# ---- "Time conflicts between your picked sections" --------------------------------

def test_overlapping_sections_of_two_courses_block_both():
    # CSCI 270's lecture and ECON 352's 26367 both meet Mon/Wed 3:30-4:50.
    _, by = check(plan(("CSCI 270", None), ("ECON 352", ["26367"])))
    assert "CSCI 270 conflicts with ECON 352." in by["CSCI 270"].reasons
    assert "ECON 352 conflicts with CSCI 270." in by["ECON 352"].reasons
    assert by["CSCI 270"].status == by["ECON 352"].status == "fail"


def test_back_to_back_sections_dont_conflict():
    # ECON 352's 26365 ends at 3:20, ten minutes before CSCI 270 starts.
    _, by = check(plan(("CSCI 270", None), ("ECON 352", ["26365"])))
    assert "conflicts with" not in text(by["CSCI 270"]) + text(by["ECON 352"])


def test_one_courses_own_sections_overlapping_block():
    lec = CATALOG["MATH 226"]["sections"]["lectures"][0]  # Mon/Wed/Fri 9:00
    entry = copy.deepcopy(CATALOG["MATH 226"])
    entry["sections"]["discussions"].append({**entry["sections"]["discussions"][0], "section_id": "99999", "days": ["Mon"],
                                             "start_time": "09:00", "end_time": "09:50", "link_code": lec["link_code"]})
    _, by = check(plan(("MATH 226", [lec["section_id"], "99999"])), catalog={**CATALOG, "MATH 226": entry})
    assert "meet at the same time" in text(by["MATH 226"]) and by["MATH 226"].status == "fail"


def test_a_section_with_no_set_time_is_flagged_as_unchecked():
    _, by = check(plan(("ECON 596", ["26305"])))  # TBD
    assert "TBA/unlisted meeting time and couldn't be checked for time conflicts" in text(by["ECON 596"])


# ---- "Missing labs or discussions a course needs" ---------------------------------

def test_a_missing_discussion_blocks():
    lec = CATALOG["MATH 226"]["sections"]["lectures"][0]["section_id"]
    _, by = check(plan(("MATH 226", [lec])))
    assert by["MATH 226"].status == "fail"
    assert "MATH 226 requires a discussion section, but none was selected." in by["MATH 226"].reasons


def test_a_missing_lab_blocks():
    lec = CATALOG["CSCI 201"]["sections"]["lectures"][0]["section_id"]
    _, by = check(plan(("CSCI 201", [lec])))
    assert "CSCI 201 requires a lab section, but none was selected." in by["CSCI 201"].reasons


def test_a_lecture_and_its_discussion_pass():
    _, by = check(plan(("MATH 226", None)))
    assert "requires a" not in text(by["MATH 226"]) and "link code" not in text(by["MATH 226"])


def test_a_discussion_tied_to_another_lecture_blocks():
    groups = CATALOG["MATH 226"]["sections"]
    lec = groups["lectures"][0]
    other = next(s for s in groups["discussions"] if s["link_code"] != lec["link_code"])
    _, by = check(plan(("MATH 226", [lec["section_id"], other["section_id"]])))
    assert "MATH 226's selected discussion section doesn't share a link code with the selected lecture." in by["MATH 226"].reasons


def test_a_lab_without_its_lecture_blocks():
    lab = CATALOG["CSCI 201"]["sections"]["labs"][0]["section_id"]
    _, by = check(plan(("CSCI 201", [lab])))
    assert "CSCI 201 requires a lecture section, but none was selected." in by["CSCI 201"].reasons


# ---- "Courses that aren't offered next semester" ----------------------------------

def test_a_course_not_offered_next_semester_is_flagged():
    # CSCI 426 is in Fall 2026's catalog and not Spring 2027's.
    assert "CSCI 426" in FALL_CATALOG and "CSCI 426" not in CATALOG
    result, by = check([{"course": "CSCI 426", "sections": ["12345"]}])
    assert "CSCI 426 was not found in the course catalog for this term." in by["CSCI 426"].reasons
    assert any("not found in the catalog: CSCI 426" in w for w in result.summary["warnings"])


def test_an_offered_course_isnt_flagged():
    _, by = check(plan(("CSCI 360", None)))
    assert "not found in the course catalog" not in text(by["CSCI 360"])


# ---- "Unit totals under 12 or over 18" (under 12 is the page's: resultSummary.test.js) --

def test_over_18_units_is_flagged():
    courses = [("CSCI 360", None), ("MATH 226", None), ("CSCI 201", None), ("ECON 352", ["26369"]), ("PR 209", None)]
    result, _ = check(plan(*courses))
    assert result.summary["total_units"] > 18
    assert f"Planned load is {result.summary['total_units']} units, above the recommended max of 18." in result.summary["warnings"]


def test_18_units_is_not_flagged():
    courses = [("CSCI 360", None), ("MATH 226", None), ("CSCI 201", None), ("PR 209", None)]
    result, _ = check(plan(*courses))
    units = result.summary["total_units"]
    assert units <= 18, units
    assert not any("recommended max" in w for w in result.summary["warnings"])


# ---- "D-clearance sections, with how that department gives clearance" -------------

def _d_section():
    """An undergrad lecture that needs D-clearance, in a department with steps on file."""
    prefixes = {d["dept_code"] for d in RULES["departments"]} | {p for d in RULES["departments"] for p in d.get("also_covers_prefixes", [])}
    for name, entry in CATALOG.items():
        prefix, number = name.split()[0], name.split()[1]
        if prefix in prefixes and number[:3].isdigit() and int(number[:3]) < 500 and not entry.get("has_lab") and not entry.get("has_discussion"):
            lectures = entry["sections"].get("lectures", [])
            if any(s["has_d_clearance"] for s in lectures) and any(not s["has_d_clearance"] for s in lectures):
                return name, next(s for s in lectures if s["has_d_clearance"]), next(s for s in lectures if not s["has_d_clearance"])
    pytest.fail("no undergrad course with both a D and an open lecture in the catalog")


def test_a_d_clearance_section_gets_the_departments_steps():
    course, d, _ = _d_section()
    result, by = check(plan((course, [d["section_id"]])))
    r = by[course]
    assert f"{course} section {d['section_id']} needs D-clearance from the department." in r.reasons
    prefix = course.split()[0]
    dept = next(x for x in RULES["departments"] if x["dept_code"] == prefix or prefix in x.get("also_covers_prefixes", []))
    assert dept["summary"] in r.reasons  # how that department gives clearance
    assert r.d_clearance and r.clearance_dept == dept["dept_code"]  # the page links to its full steps
    assert asdict(r)["clearance_dept"] == dept["dept_code"]  # and the GUI gets it


def test_the_open_section_of_the_same_course_needs_no_clearance():
    course, _, open_ = _d_section()
    _, by = check(plan((course, [open_["section_id"]])))
    assert "D-clearance" not in text(by[course]) and not by[course].d_clearance


# The scrape predated registration and still said ENGL 174 needed D-clearance; USC lifted it.
# If this fails after a rescrape, run data/refresh_d_clearance.py (and check classes.usc.edu).
def test_engl_174_doesnt_need_d_clearance_in_spring_2027():
    _, by = check(plan(("ENGL 174", None)))
    assert "D-clearance" not in text(by["ENGL 174"])


# ---- "Sections reserved for certain majors or programs" ---------------------------

def test_a_restricted_course_is_flagged():
    _, by = check(plan(("DSO 599", ["16335"])))
    assert CATALOG["DSO 599"]["has_restrictions"]
    assert "DSO 599 has registration restrictions — check section notes on WebReg to confirm eligibility." in by["DSO 599"].reasons


def test_an_unrestricted_course_isnt():
    _, by = check(plan(("CSCI 360", None)))
    assert "restriction" not in text(by["CSCI 360"]).lower()


def _with_note(note):
    entry = copy.deepcopy(CATALOG["CSCI 360"])
    entry["has_restrictions"] = True
    for s in entry["sections"]["lectures"]:
        s["notes"] = note
    return {**CATALOG, "CSCI 360": entry}


def test_a_section_reserved_for_your_major_passes_and_another_major_is_flagged():
    catalog = _with_note("Reserved for Computer Science majors")
    _, by = check(plan(("CSCI 360", None)), catalog=catalog)
    assert "reserved for" not in text(by["CSCI 360"])
    _, by = check(plan(("CSCI 360", None)), student(major="Economics"), catalog=catalog)
    assert "CSCI 360 is reserved for: Computer Science majors." in text(by["CSCI 360"])
    assert by["CSCI 360"].status == "warning"


def test_a_section_closed_to_your_major_blocks():
    _, by = check(plan(("CSCI 360", None)), catalog=_with_note("Not available for Computer Science majors"))
    assert "CSCI 360 is not available for Computer Science majors." in by["CSCI 360"].reasons
    assert by["CSCI 360"].status == "fail"


def test_a_graduate_only_section_blocks_an_undergrad():
    _, by = check(plan(("CSCI 360", None)), catalog=_with_note("Only open to graduate students"))
    assert "CSCI 360 is only open to graduate students." in by["CSCI 360"].reasons


# The scrape dropped every section's notes, so RegCheck can only say a course is restricted,
# not who it's reserved for. When the notes come back this passes; then drop the xfail.
@pytest.mark.xfail(strict=True, reason="the Spring 2027 scrape has no section notes")
def test_the_catalog_carries_section_notes():
    assert any(s.get("notes") for e in CATALOG.values() for g in e["sections"].values() for s in g)


# ---- "Courses you've already taken (repeatable ones only warn)" ---------------------

def test_a_course_you_finished_blocks():
    _, by = check(plan(("CSCI 270", None)))
    assert by["CSCI 270"].status == "fail"
    assert "CSCI 270 is already completed." in by["CSCI 270"].reasons


def test_a_repeatable_course_you_finished_only_warns():
    # DSO 599: "May be repeated only if topic is different."
    _, by = check(plan(("DSO 599", ["16335"])), finished(JUNIOR, "DSO 599"))
    assert by["DSO 599"].status == "warning"
    assert "You've already completed DSO 599, but the catalog says \"May be repeated only if topic is different\"" in text(by["DSO 599"])


def test_a_course_youre_taking_now_warns():
    sections = [s["section_id"] for s in CATALOG["WRIT 340"]["sections"]["lectures"][:1]]
    _, by = check(plan(("WRIT 340", sections)))
    assert "WRIT 340 is already in progress this term." in by["WRIT 340"].reasons


def test_a_course_you_failed_or_withdrew_from_isnt_taken():
    _, by = check(plan(("CSCI 360", None)), finished(JUNIOR, "CSCI 360", grade="W", passed=False))
    assert "already completed" not in text(by["CSCI 360"])


# ---- "Whether your class standing fits 400-level courses" -------------------------

def test_a_400_level_course_warns_a_sophomore():
    _, by = check(plan(("CSCI 401", None)), student(classLevel="Sophomore"))
    assert "Sophomores may not be eligible for some 400+ level courses" in text(by["CSCI 401"])


def test_a_400_level_course_doesnt_warn_a_junior_or_senior():
    for level in ("Junior", "Senior"):
        _, by = check(plan(("CSCI 401", None)), student(classLevel=level))
        assert "400+ level" not in text(by["CSCI 401"]), level


def test_a_300_level_course_doesnt_warn_a_freshman():
    _, by = check(plan(("CSCI 360", None)), student(classLevel="Freshman"))
    assert "400+ level" not in text(by["CSCI 360"])


# ======================================================================================
# What RegCheck doesn't check
# ======================================================================================

def test_any_passing_grade_meets_a_prereq():
    # "Minimum grades in prerequisites (like "C or better"): any passing grade counts"
    _, by = check(plan(("CSCI 360", None)), finished(JUNIOR, "CSCI 170", grade="D-"))
    assert by["CSCI 360"].status == "pass", by["CSCI 360"].reasons


def test_corequisites_arent_checked():
    # ECON 352 lists ECON 351 as a corequisite; the junior has never taken it.
    assert CATALOG["ECON 352"]["coreqs"] == "ECON 351"
    _, by = check(plan(("ECON 352", ["26365"])))
    assert "ECON 351" not in text(by["ECON 352"])
    # CHEM 251's corequisite isn't read as a prerequisite either.
    _, by = check(plan(("CHEM 251", None)))
    assert "CHEM 322B" not in text(by["CHEM 251"]) and "CHEM 322b" not in text(by["CHEM 251"])


def test_a_full_section_isnt_flagged():
    entry = copy.deepcopy(CATALOG["CSCI 360"])
    for s in entry["sections"]["lectures"]:
        s.update(is_full=True, open_seats=0)
    _, by = check(plan(("CSCI 360", None)), catalog={**CATALOG, "CSCI 360": entry})
    assert by["CSCI 360"].status == "pass", by["CSCI 360"].reasons


def test_degree_progress_isnt_checked():
    # A course nowhere near the junior's CS degree raises nothing about the degree.
    result, by = check(plan(("ECON 352", ["26365"])))
    assert by["ECON 352"].status == "pass", by["ECON 352"].reasons
    assert set(result.summary) == {"total_units", "warnings"}
    assert not any(w in json.dumps(asdict(result)).lower() for w in ("graduat", "degree", "major requirement"))


def test_holds_and_registration_appointments_arent_checked():
    stars = student(holds=["Financial hold", "Advisement hold"], registrationAppointment="11/20/26 9:00")
    plain, _ = check(plan(("CSCI 360", None)))
    with_holds, _ = check(plan(("CSCI 360", None)), stars)
    assert asdict(plain) == asdict(with_holds)


def test_only_one_stars_report_is_checked():
    # A double major's second report isn't read: the validator takes one report, and a course
    # that only the other report shows counts as not taken.
    assert [p for p in inspect.signature(validate_next_semester).parameters] == ["planned_courses", "stars_summary", "course_catalog", "dept_clearance"]
    _, by = check(plan(("CSCI 360", None)), without(JUNIOR, "CSCI 170"))
    assert by["CSCI 360"].status == "fail"


# ======================================================================================
# The whole catalog
# ======================================================================================

def test_every_course_in_the_catalog_validates_without_crashing():
    """Every Spring 2027 course, with its first lecture (or first section), runs through the
    validator for the junior without raising and with a status the GUI knows."""
    for name, entry in CATALOG.items():
        groups = entry.get("sections", {})
        first = (groups.get("lectures") or next((v for v in groups.values() if v), [None]))[0]
        if first is None:
            continue
        result = validate_next_semester([{"course": name, "sections": [first["section_id"]]}], JUNIOR, CATALOG, RULES)
        assert result.overall_status in ("valid", "warning", "invalid"), name
        assert result.course_results[0].status in ("pass", "warning", "fail"), name
