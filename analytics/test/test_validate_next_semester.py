import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from validate_next_semester import (
    EXPECTED_DEPT_CLEARANCE_SCHEMA_VERSION,
    _check_already_taken,
    _check_d_clearance,
    _check_in_catalog,
    _check_lab_discussion_pairing,
    _check_major_restrictions,
    _check_gpa,
    _check_prereq,
    _check_seat_availability,
    _check_standing,
    _check_time_conflicts,
    _dept_clearance_by_prefix,
    _normalize_code,
    _parse_planned_entry,
    _to_minutes,
    validate_next_semester,
)


# ---- parse_planned_entry -----------------------------------------------------

def test_parse_planned_entry_extracts_course_and_sections():
    course, sections = _parse_planned_entry({"course": "CSCI 104", "sections": ["29903", "30119"]})
    assert course == "CSCI 104"
    assert sections == {"29903", "30119"}


def test_parse_planned_entry_raises_on_plain_string():
    with pytest.raises(ValueError):
        _parse_planned_entry("CSCI 104")


def test_parse_planned_entry_raises_when_sections_missing():
    with pytest.raises(ValueError):
        _parse_planned_entry({"course": "CSCI 104"})


def test_parse_planned_entry_raises_when_sections_empty():
    with pytest.raises(ValueError):
        _parse_planned_entry({"course": "CSCI 104", "sections": []})


# ---- fixtures -------------------------------------------------------------

FIXTURES = Path(__file__).parent / "fixtures"

# STARS report fixtures are shared with the parser: the same <name>.json is the
# parser's expected output AND the validator's stars_summary input. It lives in
# the repo-root fixtures/stars/ directory, owned by neither module, so a change
# to the parser's output shape breaks a validator test immediately.
REPO_ROOT = Path(__file__).resolve().parents[2]
SHARED_STARS = REPO_ROOT / "fixtures" / "stars"


def load_fixture(name):
    import json

    return json.loads((FIXTURES / name).read_text())


def load_shared_stars(name):
    import json

    return json.loads((SHARED_STARS / name).read_text())


@pytest.fixture
def stars_summary():
    return load_shared_stars("mock_stars_report.json")


@pytest.fixture
def planned_courses():
    return load_fixture("mock_planned_courses.json")["planned_courses"]


@pytest.fixture
def course_catalog():
    return load_fixture("mock_course_catalog.json")


@pytest.fixture
def dept_clearance():
    return load_fixture("../../data/dept_clearance.json")


# ---- normalize_code ---------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("CSCI 104", "CSCI 104"),
        ("CSCI104", "CSCI 104"),
        ("csci 104", "CSCI 104"),
        ("  CSCI   104  ", "CSCI 104"),
        ("CSCI104A", "CSCI 104A"),
    ],
)
def test_normalize_code(raw, expected):
    assert _normalize_code(raw) == expected


# ---- already taken ---------------------------------------------------------

def test_already_taken_fails_for_completed_course(stars_summary):
    result = _check_already_taken("CSCI 104", stars_summary)
    assert result.status == "fail"


def test_already_taken_warns_for_in_progress_course(stars_summary):
    result = _check_already_taken("CSCI 350", stars_summary)
    assert result.status == "warning"


def test_already_taken_none_for_new_course(stars_summary):
    assert _check_already_taken("CSCI 999", stars_summary) is None


# ---- standing --------------------------------------------------------------

def test_standing_warns_for_freshman_taking_400_level():
    result = _check_standing("CSCI 401", {"classLevel": "Freshman"})
    assert result.status == "warning"


def test_standing_none_for_junior_taking_400_level():
    assert _check_standing("CSCI 401", {"classLevel": "Junior"}) is None


def test_standing_none_for_100_level_regardless_of_class_level():
    assert _check_standing("CSCI 103", {"classLevel": "Freshman"}) is None


def test_standing_none_when_class_level_missing():
    assert _check_standing("CSCI 401", {}) is None


# ---- D-clearance -------------------------------------------------------------

def test_d_clearance_warns_with_department_text(dept_clearance):
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    entry = {"has_d_clearance": True}
    result = _check_d_clearance("CSCI 426", entry, by_prefix)
    assert result.status == "warning"
    assert any("myviterbi" in r.lower() for r in result.reasons)


def test_d_clearance_none_when_not_required(dept_clearance):
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    assert _check_d_clearance("CSCI 360", {"has_d_clearance": False}, by_prefix) is None


def test_d_clearance_warns_generically_for_unknown_department(dept_clearance):
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    result = _check_d_clearance("ZZZZ 100", {"has_d_clearance": True}, by_prefix)
    assert result.status == "warning"
    assert len(result.reasons) == 1  # only the generic reason, no dept-specific text found


def test_d_clearance_warns_with_department_text_for_also_covers_prefix(dept_clearance):
    """ECE isn't its own dept_code entry -- it's listed under EE's also_covers_prefixes --
    so this covers the case that used to fall through to the generic warning even though
    department contact info exists for it."""
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    entry = {"has_d_clearance": True}
    result = _check_d_clearance("ECE 201", entry, by_prefix)
    assert result.status == "warning"
    assert any("myviterbi" in r.lower() for r in result.reasons)


def test_d_clearance_schema_version_guard_raises(dept_clearance):
    bad = {**dept_clearance, "_schema_version": "999.0"}
    with pytest.raises(ValueError):
        _dept_clearance_by_prefix(bad)


def test_d_clearance_schema_version_matches_expected(dept_clearance):
    assert dept_clearance["_schema_version"] == EXPECTED_DEPT_CLEARANCE_SCHEMA_VERSION


# ---- prereqs -----------------------------------------------------------------

def test_prereq_fails_when_required_course_not_completed():
    entry = {"description": "Prereq: CSCI 104"}
    result = _check_prereq("CSCI 201", entry, {"completedCourses": []})
    assert result.status == "fail"
    assert "CSCI 104" in result.reasons[0]


def test_prereq_passes_when_required_course_completed():
    entry = {"description": "Prereq: CSCI 104"}
    stars = {"completedCourses": [{"code": "CSCI 104"}]}
    assert _check_prereq("CSCI 201", entry, stars) is None


def test_prereq_falls_back_to_warning_when_unparseable():
    entry = {"description": "Prereq: consent of instructor."}
    result = _check_prereq("AHIS 495A", entry, {"completedCourses": []})
    assert result.status == "warning"


# ---- GPA minimums -------------------------------------------------------------

def test_gpa_fails_when_below_threshold():
    entry = {"description": "prerequisite: 3.5 gpa"}
    result = _check_gpa("ANTH 491", entry, {"gpa": 3.0})
    assert result.status == "fail"


def test_gpa_passes_and_says_so_when_threshold_met():
    entry = {"description": "prerequisite: 3.0 gpa"}
    result = _check_gpa("ANTH 491", entry, {"gpa": 3.4})
    assert result.status == "pass"
    assert "yours: 3.4" in result.reasons[0]


def test_gpa_warns_instead_of_failing_when_gpa_is_unknown():
    # Every redacted report has gpa: null. Not knowing the GPA isn't failing it.
    entry = {"description": "prerequisite: 3.5 gpa"}
    result = _check_gpa("ANTH 491", entry, {"gpa": None})
    assert result.status == "warning"
    assert "wasn't checked" in result.reasons[0]


def test_gpa_checked_when_description_never_says_prerequisite():
    # The catalog's own wording (MATH 596): no "prereq", so the old check never ran.
    entry = {"description": "May not be taken until the student has completed at least one semester "
                            "of enrollment in the graduate program with a cumulative 3.0 GPA."}
    assert _check_gpa("MATH 596", entry, {"gpa": 2.8}).status == "fail"


def test_gpa_minimum_for_non_majors_only_warns():
    # PR 209: the minimum binds non-majors, and the report can't say which the student is.
    entry = {"description": "Non-majors who are interested in enrolling must have at least a 2.5 GPA."}
    assert _check_gpa("PR 209", entry, {"gpa": 2.1}).status == "warning"
    assert _check_gpa("PR 209", entry, {"gpa": 3.0}).status == "pass"


@pytest.mark.parametrize("text", ["a GPA of 3.0", "minimum GPA: 3.0", "a 3.0 overall GPA", "GPA of at least 3.0"])
def test_gpa_minimum_read_from_common_phrasings(text):
    assert _check_gpa("X 100", {"description": f"Requires {text}."}, {"gpa": 2.9}).status == "fail"


def test_gpa_ignores_a_stray_period_before_gpa():
    # The old pattern ([\d.]+) matched the "." alone and crashed float().
    entry = {"description": "Open to all majors. GPA requirements vary by section."}
    assert _check_gpa("X 100", entry, {"gpa": 3.0}) is None


def test_prereq_does_not_call_a_gpa_minimum_unverified():
    entry = {"description": "prerequisite: 3.5 gpa"}
    assert _check_prereq("ANTH 491", entry, {"gpa": 3.0, "completedCourses": []}) is None


def test_gpa_minimum_reaches_the_validator_result():
    catalog = {"PR 209": {"units": 4, "description": "Non-majors must have at least a 2.5 GPA.",
                          "sections": {"Lecture": [{"section_id": "1", "days": [], "start_time": "TBA", "end_time": "TBA"}]}}}
    stars = {"gpa": 3.2, "completedCourses": [], "inProgressCourses": [], "classLevel": "Junior"}
    result = validate_next_semester([{"course": "PR 209", "sections": ["1"]}], stars, catalog, {"_schema_version": EXPECTED_DEPT_CLEARANCE_SCHEMA_VERSION, "departments": []})
    assert any("2.5 GPA" in r for r in result.course_results[0].reasons)


def test_prereq_not_met_by_a_withdrawn_course():
    entry = {"description": "Prereq: MATH 226"}
    stars = {"completedCourses": [{"code": "MATH 226", "grade": "W", "passed": False, "source": "usc"}]}
    assert _check_prereq("MATH 245", entry, stars).status == "fail"


def test_prereq_not_met_by_a_transfer_code_that_looks_like_a_usc_code():
    # ANTH101 on a transfer row is the sending school's code, not USC's ANTH 101.
    entry = {"description": "Prereq: ANTH 101"}
    stars = {"completedCourses": [{"code": "ANTH 101", "grade": "TR", "passed": True, "source": "transfer"}]}
    assert _check_prereq("ANTH 301", entry, stars).status == "fail"


def test_prereq_met_by_a_transfer_through_a_stated_equivalence():
    entry = {"description": "Prereq: CSCI 113"}
    stars = {
        "completedCourses": [{"code": "CMPR 120", "grade": "TR", "passed": True, "source": "transfer"}],
        "equivalents": [{"from": "CMPR 120", "to": "CSCI 113"}],
    }
    assert _check_prereq("CSCI 210", entry, stars) is None


def test_prereq_equivalence_needs_the_transfer_row_to_count():
    entry = {"description": "Prereq: CSCI 113"}
    stars = {
        "completedCourses": [{"code": "CMPR 120", "grade": "TR", "passed": False, "source": "transfer"}],
        "equivalents": [{"from": "CMPR 120", "to": "CSCI 113"}],
    }
    assert _check_prereq("CSCI 210", entry, stars).status == "fail"


def test_prereq_met_only_by_a_student_entered_row_is_a_warning():
    entry = {"description": "Prereq: CSCI 104"}
    stars = {"completedCourses": [{"code": "CSCI 104", "passed": True, "source": "usc", "origin": "student"}]}
    result = _check_prereq("CSCI 201", entry, stars)
    assert result.status == "warning"
    assert "added CSCI 104 yourself" in result.reasons[0]


def test_prereq_met_by_the_report_and_the_student_is_a_pass():
    entry = {"description": "Prereq: CSCI 104"}
    stars = {
        "completedCourses": [
            {"code": "CSCI 104", "passed": True, "source": "usc", "origin": "student"},
            {"code": "CSCI 104", "passed": True, "source": "usc", "origin": "parsed"},
        ]
    }
    assert _check_prereq("CSCI 201", entry, stars) is None


def test_prereq_met_only_by_a_waiver_is_a_warning():
    entry = {"description": "Prereq: DSCI 281"}
    stars = {"completedCourses": [], "waivedCourses": ["DSCI 281"]}
    assert _check_prereq("DSCI 351", entry, stars).status == "warning"


def test_already_taken_ignores_withdrawn_and_transfer_rows():
    stars = {
        "completedCourses": [
            {"code": "MATH 226", "grade": "W", "passed": False, "source": "usc"},
            {"code": "ANTH 101", "grade": "TR", "passed": True, "source": "transfer"},
        ]
    }
    assert _check_already_taken("MATH 226", stars) is None
    assert _check_already_taken("ANTH 101", stars) is None


def test_already_taken_counts_an_equivalence():
    stars = {
        "completedCourses": [{"code": "CMPR 120", "grade": "TR", "passed": True, "source": "transfer"}],
        "equivalents": [{"from": "CMPR 120", "to": "CSCI 113"}],
    }
    assert _check_already_taken("CSCI 113", stars).status == "fail"


def test_prereq_none_when_no_prereq_keyword():
    entry = {"description": "Intro to widgets."}
    assert _check_prereq("CSCI 999", entry, {"completedCourses": []}) is None


# ---- in catalog ----------------------------------------------------------

def test_in_catalog_warns_when_course_missing():
    result = _check_in_catalog("CSCI 999", {})
    assert result.status == "warning"


def test_in_catalog_none_when_present():
    assert _check_in_catalog("CSCI 104", {"CSCI 104": {}}) is None


# ---- seat availability -----------------------------------------------------

def test_seat_availability_fails_for_selected_full_section():
    entry = {
        "sections": {
            "lectures": [
                {"section_id": "1", "is_full": True, "is_cancelled": False},
                {"section_id": "2", "is_full": False, "is_cancelled": False},
            ]
        }
    }
    result = _check_seat_availability("CSCI 401", entry, {"1"})
    assert result.status == "fail"


def test_seat_availability_none_for_selected_open_section():
    entry = {
        "sections": {
            "lectures": [
                {"section_id": "1", "is_full": True, "is_cancelled": False},
                {"section_id": "2", "is_full": False, "is_cancelled": False},
            ]
        }
    }
    assert _check_seat_availability("CSCI 401", entry, {"2"}) is None


# ---- lab/discussion pairing -------------------------------------------------

def test_lab_pairing_none_when_link_codes_match():
    entry = {
        "has_lab": True,
        "has_discussion": False,
        "sections": {
            "lectures": [{"section_id": "L1", "link_code": "A"}],
            "labs": [{"section_id": "B1", "link_code": "A"}],
        },
    }
    assert _check_lab_discussion_pairing("CSCI 104", entry, {"L1", "B1"}) is None


def test_lab_pairing_fails_when_link_codes_mismatch():
    entry = {
        "has_lab": False,
        "has_discussion": True,
        "sections": {
            "lectures": [{"section_id": "L1", "link_code": "A"}],
            "discussions": [{"section_id": "D1", "link_code": "B"}],
        },
    }
    result = _check_lab_discussion_pairing("MATH 407", entry, {"L1", "D1"})
    assert result.status == "fail"


def test_lab_pairing_fails_when_required_section_missing():
    entry = {
        "has_lab": True,
        "has_discussion": False,
        "sections": {"lectures": [{"section_id": "L1", "link_code": "A"}]},
    }
    result = _check_lab_discussion_pairing("CSCI 104", entry, {"L1"})
    assert result.status == "fail"


def test_lab_pairing_none_when_not_required():
    entry = {"has_lab": False, "has_discussion": False, "sections": {}}
    assert _check_lab_discussion_pairing("CSCI 360", entry, {"L1"}) is None


# ---- major restrictions -----------------------------------------------------

def test_major_restrictions_fails_when_reserved_for_other_major():
    entry = {
        "has_restrictions": True,
        "sections": {
            "lectures": [
                {
                    "section_id": "1",
                    "is_cancelled": False,
                    "notes": "This course is reserved for students in the B.S. GeoDesign program.",
                }
            ]
        },
    }
    result = _check_major_restrictions("ARCH 203", entry, {"major": "Computer Science", "classLevel": "Junior"}, {"1"})
    assert result.status == "fail"


def test_major_restrictions_none_when_reserved_for_students_major():
    entry = {
        "has_restrictions": True,
        "sections": {
            "lectures": [
                {
                    "section_id": "1",
                    "is_cancelled": False,
                    "notes": "This course is reserved for students in the Computer Science program.",
                }
            ]
        },
    }
    result = _check_major_restrictions("CSCI 490", entry, {"major": "Computer Science", "classLevel": "Junior"}, {"1"})
    assert result is None


def test_major_restrictions_fails_when_undergrad_only_but_student_is_grad():
    entry = {
        "has_restrictions": True,
        "sections": {
            "lectures": [
                {"section_id": "1", "is_cancelled": False, "notes": "This course is only open to undergraduate students."}
            ]
        },
    }
    result = _check_major_restrictions("CSCI 401", entry, {"major": "Computer Science", "classLevel": None}, {"1"})
    assert result.status == "fail"


def test_major_restrictions_none_when_undergrad_only_and_student_is_undergrad():
    entry = {
        "has_restrictions": True,
        "sections": {
            "lectures": [
                {"section_id": "1", "is_cancelled": False, "notes": "This course is only open to undergraduate students."}
            ]
        },
    }
    result = _check_major_restrictions("CSCI 401", entry, {"major": "Computer Science", "classLevel": "Junior"}, {"1"})
    assert result is None


def test_major_restrictions_warns_when_note_unparseable():
    entry = {
        "has_restrictions": True,
        "sections": {"lectures": [{"section_id": "1", "is_cancelled": False, "notes": "Some unusual restriction text."}]},
    }
    result = _check_major_restrictions("XYZ 100", entry, {"major": "Computer Science", "classLevel": "Junior"}, {"1"})
    assert result.status == "warning"


def test_major_restrictions_warns_when_flagged_but_no_notes():
    entry = {"has_restrictions": True, "sections": {"lectures": [{"section_id": "1", "is_cancelled": False, "notes": None}]}}
    result = _check_major_restrictions("XYZ 100", entry, {"major": "Computer Science", "classLevel": "Junior"}, {"1"})
    assert result.status == "warning"


# ---- time conflicts ----------------------------------------------------------

def make_catalog_entry(days, start, end, section_id="1"):
    return {"sections": {"lectures": [{"section_id": section_id, "is_cancelled": False, "days": days, "start_time": start, "end_time": end}]}}


def test_time_conflict_fails_when_selected_sections_overlap():
    catalog = {
        "CSCI 426": make_catalog_entry(["Wed"], "13:00", "16:20"),
        "ANTH 338": make_catalog_entry(["Mon", "Wed"], "14:00", "15:20"),
    }
    conflicts = _check_time_conflicts([("CSCI 426", {"1"}), ("ANTH 338", {"1"})], catalog)
    assert conflicts["CSCI 426"][0].status == "fail"
    assert conflicts["ANTH 338"][0].status == "fail"


def test_time_conflict_fails_when_any_selected_section_overlaps():
    """A course with multiple selected sections (e.g. lecture + lab) commits to all of them at
    once -- a conflict from just one of them is still a real conflict."""
    catalog = {
        "A": {
            "sections": {
                "lectures": [{"section_id": "a1", "is_cancelled": False, "days": ["Mon"], "start_time": "08:00", "end_time": "09:50"}],
                "labs": [{"section_id": "a2", "is_cancelled": False, "days": ["Mon"], "start_time": "10:00", "end_time": "11:50"}],
            }
        },
        "B": make_catalog_entry(["Mon"], "10:30", "11:00", section_id="b1"),
    }
    conflicts = _check_time_conflicts([("A", {"a1", "a2"}), ("B", {"b1"})], catalog)
    assert conflicts["A"][0].status == "fail"
    assert conflicts["B"][0].status == "fail"


def test_time_conflict_absent_when_no_overlap():
    catalog = {
        "A": make_catalog_entry(["Mon"], "08:00", "09:00"),
        "B": make_catalog_entry(["Tue"], "08:00", "09:00"),
    }
    conflicts = _check_time_conflicts([("A", {"1"}), ("B", {"1"})], catalog)
    assert conflicts == {}


def test_to_minutes_handles_malformed_input_gracefully():
    assert _to_minutes("not-a-time") is None
    assert _to_minutes(None) is None
    assert _to_minutes("TBA") is None
    assert _to_minutes("09:30") == 570


# ---- full integration --------------------------------------------------------

def test_validate_next_semester_end_to_end(planned_courses, stars_summary, course_catalog, dept_clearance):
    result = validate_next_semester(planned_courses, stars_summary, course_catalog, dept_clearance)
    assert result.overall_status == "invalid"

    by_course = {c.course: c for c in result.course_results}
    expected_status = {
        "CSCI 360": "fail",  # time conflict with CSCI 104 (both meet Tue/Thu ~noon)
        "CSCI 401": "fail",  # time conflict with MATH 407
        "CSCI 104": "fail",  # already completed, plus time conflict with CSCI 360 and ACCT 371
        "CSCI 426": "fail",  # time conflicts with ANTH 338, ACCT 371, ARCH 203 (all Wed afternoon)
        "MATH 407": "fail",  # mismatched lab/discussion link code, plus conflict with CSCI 401
        "ANTH 491": "warning",  # D-clearance + TBA section, no fixed time to conflict-check
        "ANTH 338": "fail",  # time conflicts with CSCI 426 and ARCH 203
        "ACCT 371": "fail",  # both selected sections full, plus time conflicts
        "ARCH 203": "fail",  # reserved for GeoDesign/Landscape Arch, not this student's major
        "CSCI 999": "warning",  # not in catalog
    }
    for course, status in expected_status.items():
        assert by_course[course].status == status, f"{course}: expected {status}, got {by_course[course].status}"

    assert "CSCI 426 conflicts with ANTH 338." in by_course["CSCI 426"].reasons
    assert "CSCI 426 conflicts with ARCH 203." in by_course["CSCI 426"].reasons
    assert any("TBA" in r for r in by_course["ANTH 491"].reasons)
    assert any("full" in r for r in by_course["ACCT 371"].reasons)
    assert any("reserved for" in r for r in by_course["ARCH 203"].reasons)
    assert any("link code" in r for r in by_course["MATH 407"].reasons)

    assert result.summary["total_units"] == 36.0
    assert any("CSCI 999" in w for w in result.summary["warnings"])
    assert any("18" in w for w in result.summary["warnings"])


def test_validate_next_semester_raises_on_bad_dept_clearance_version(planned_courses, stars_summary, course_catalog, dept_clearance):
    bad = {**dept_clearance, "_schema_version": "0.1"}
    with pytest.raises(ValueError):
        validate_next_semester(planned_courses, stars_summary, course_catalog, bad)


# ---- shared redacted STARS samples -------------------------------------------
# The parser's expected output for each redacted sample report
# (fixtures/stars/<name>.json, produced from <name>.txt) is this validator's
# stars_summary input. These run the validator on all of them, so a change to
# the parser's output shape breaks a test here too.

REAL_SAMPLES = sorted(
    p.name for p in SHARED_STARS.glob("*.json") if p.name != "mock_stars_report.json"
)


def test_real_samples_are_present():
    assert len(REAL_SAMPLES) == 11


@pytest.mark.parametrize("name", REAL_SAMPLES)
def test_validator_runs_on_real_sample(name, planned_courses, course_catalog, dept_clearance):
    summary = load_shared_stars(name)
    result = validate_next_semester(planned_courses, summary, course_catalog, dept_clearance)
    assert {r.course for r in result.course_results} == {p["course"] for p in planned_courses}


@pytest.mark.parametrize("name", REAL_SAMPLES)
def test_already_taken_reads_real_sample_codes(name):
    summary = load_shared_stars(name)
    # First-semester samples have no completed USC course, only exam credit.
    for done in [c for c in summary["completedCourses"] if c["source"] == "usc" and c["passed"]][:1]:
        assert _check_already_taken(done["code"], summary).status == "fail"
    completed = {c["code"] for c in summary["completedCourses"]}
    doing = next(c for c in summary["inProgressCourses"] if c["code"] not in completed)
    assert _check_already_taken(doing["code"], summary).status == "warning"


def test_withdrawn_course_is_not_already_completed():
    # ene_fr_withdrawals withdrew from MATH 226 (W, 0 units). Planning it again
    # isn't retaking a completed course.
    summary = load_shared_stars("ene_fr_withdrawals.json")
    assert any(c["code"] == "MATH 226" and c["grade"] == "W" for c in summary["completedCourses"])
    result = _check_already_taken("MATH 226", summary)
    assert result is None or result.status != "fail"


def test_real_sample_transfer_counts_only_through_its_equivalence():
    # aibiz_jr_doubledegree took CMPR120 and CMPR131 at a community college;
    # the report substitutes them for CSCI 113 and CSCI 114. ANTH101 there has
    # no equivalence, so it proves nothing about USC's ANTH 101.
    summary = load_shared_stars("aibiz_jr_doubledegree.json")
    assert _check_prereq("CSCI 201", {"description": "Prereq: CSCI 113"}, summary) is None
    assert _check_prereq("ANTH 301", {"description": "Prereq: ANTH 101"}, summary).status == "fail"
