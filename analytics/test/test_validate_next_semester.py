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


# Catalog wording, verbatim.
DSO_599 = {"description": "Special Topics. Selected topics reflecting current trends and recent developments in data "
                          "sciences, operations management, supply chain management and/or decision support systems. "
                          "May be repeated only if topic is different."}


def test_already_taken_repeatable_course_warns_instead_of_failing():
    # DSO 599 is a different course every time the topic changes. Blocking it was wrong.
    stars = {"completedCourses": [{"code": "DSO 599", "passed": True, "source": "usc"}]}
    result = _check_already_taken("DSO 599", stars, DSO_599)
    assert result.status == "warning"
    assert '"May be repeated only if topic is different"' in result.reasons[0]


def test_already_taken_repeatable_by_title_warns_instead_of_failing():
    # Directed Research rarely says it repeats; USC's x90 courses do by convention.
    entry = {"description": "Directed Research. Individual research and readings. Not available for graduate credit."}
    stars = {"completedCourses": [{"code": "ANTH 490", "passed": True, "source": "usc"}]}
    result = _check_already_taken("ANTH 490", stars, entry)
    assert result.status == "warning"
    assert "Directed Research" in result.reasons[0]


@pytest.mark.parametrize("name, code, description", [
    ("aibiz_sr_forgiveness.json", "MOR 499", "Special Topics. Selected topics reflecting current trends and recent "
     "developments in organizational behavior, business strategy and organizational theory."),
    ("csci_sr_renaissance.json", "MUEN 310", "University Concert Choir. Performance of choral works of all styles "
     "and periods.  Open to  all students by audition. Graded CR/NC."),
])
def test_real_sample_repeatable_course_is_not_blocked(name, code, description):
    summary = load_shared_stars(name)
    assert _check_already_taken(code, summary).status == "fail"  # what the check said without the catalog
    assert _check_already_taken(code, summary, {"description": description}).status == "warning"


def test_already_taken_still_fails_for_a_course_that_does_not_repeat():
    entry = {"description": "Data Structures and Object Oriented Design. Balanced trees, hashing, graphs."}
    stars = {"completedCourses": [{"code": "CSCI 104", "passed": True, "source": "usc"}]}
    assert _check_already_taken("CSCI 104", stars, entry).status == "fail"


def test_already_taken_repeat_language_needs_to_be_about_repeating_the_course():
    # "may not be repeated" and ARCH 581's "repeatable surfaces" don't make a course repeatable.
    stars = {"completedCourses": [{"code": "ARCH 581", "passed": True, "source": "usc"}]}
    for text in ("Digital Fabrication. Thermoforming as applied to repeatable surfaces in architecture.",
                 "Studio. May not be repeated for credit."):
        assert _check_already_taken("ARCH 581", stars, {"description": text}).status == "fail"


def test_repeatable_course_reaches_the_validator_result():
    catalog = {"DSO 599": {**DSO_599, "units": 1,
                           "sections": {"Lecture": [{"section_id": "1", "days": [], "start_time": "TBA", "end_time": "TBA"}]}}}
    stars = {"completedCourses": [{"code": "DSO 599", "passed": True, "source": "usc"}], "inProgressCourses": [], "classLevel": "Senior"}
    result = validate_next_semester([{"course": "DSO 599", "sections": ["1"]}], stars, catalog,
                                    {"_schema_version": EXPECTED_DEPT_CLEARANCE_SCHEMA_VERSION, "departments": []})
    assert result.course_results[0].status == "warning"


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


# AME 420 has two lectures, and only 29014 needs D-clearance. The course-level flag is true if
# any section needs it, so it alone warned students who picked 28814.
AME_420 = {
    "has_d_clearance": True,
    "sections": {"lectures": [
        {"section_id": "28814", "has_d_clearance": False},
        {"section_id": "29014", "has_d_clearance": True},
    ]},
}


def test_d_clearance_none_when_the_picked_section_needs_none(dept_clearance):
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    assert _check_d_clearance("AME 420", AME_420, by_prefix, {"28814"}) is None


def test_d_clearance_warns_and_names_the_picked_section_that_needs_it(dept_clearance):
    by_prefix = _dept_clearance_by_prefix(dept_clearance)
    result = _check_d_clearance("AME 420", AME_420, by_prefix, {"29014"})
    assert result.status == "warning"
    assert result.reasons[0] == "AME 420 section 29014 requires departmental clearance (D-clearance) to enroll this term."


def test_d_clearance_section_fix_reaches_the_validator_result(dept_clearance):
    stars = {"completedCourses": [], "inProgressCourses": [], "classLevel": "Senior"}
    result = validate_next_semester([{"course": "AME 420", "sections": ["28814"]}], stars, {"AME 420": {**AME_420, "units": 3}}, dept_clearance)
    assert not any("D-clearance" in r for r in result.course_results[0].reasons)


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


# Catalog wording, verbatim (whitespace included), for the cases Vishal's review found.
ECON_351 = ("Microeconomics for Business. Development and business applications of: theory of the firm;      "
            "theory of the consumer; inter-temporaldecisions; decisions under   risk; market failures; industrial "
            "and enterprise structure.        Prerequisites: MATH 118 or MATH 125 or MATH 126 or MATH 226. Not   "
            "for major credit for: Economics, Economics/Mathematics, Social     Sciences (Economics). Duplicates "
            "credit in BUAD 351.              ")
PSYC_353 = ("Close Relationships. Scientific perspective of close relationships: intimate relationships, "
            "friendships and others. Prerequisite: PSYC 100. (Duplicates credit in PSYC 359)")
CSCI_310 = ("Software Engineering. Introduction to the software engineering process and software lifecycle. "
            "Prerequisites: CSCI 201. Duplicates credit in former CSCI 377.")


def test_prereq_or_is_met_by_any_one_course():
    # aibiz_jr_doubledegree has MATH 125, one of four alternatives. The old check required all
    # four, plus BUAD 351 from "Duplicates credit in", and blocked the student.
    summary = load_shared_stars("aibiz_jr_doubledegree.json")
    assert _check_prereq("ECON 351", {"description": ECON_351}, summary) is None


def test_prereq_or_fails_when_no_alternative_is_met():
    result = _check_prereq("ECON 351", {"description": ECON_351}, {"completedCourses": []})
    assert result.status == "fail"
    assert "one of MATH 118, MATH 125, MATH 126 or MATH 226" in result.reasons[0]
    assert "BUAD 351" not in result.reasons[0]


def test_prereq_met_by_a_course_in_progress():
    # cpns_so is taking PSYC 100 now. Next semester's registration accepts that.
    summary = load_shared_stars("cpns_so.json")
    result = _check_prereq("PSYC 353", {"description": PSYC_353}, summary)
    assert result.status == "pass"
    assert "PSYC 100 is in progress" in result.reasons[0]


def test_prereq_in_progress_and_duplicates_credit_course_not_required():
    stars = {"completedCourses": [], "inProgressCourses": [{"code": "CSCI 201", "source": "usc"}]}
    result = _check_prereq("CSCI 310", {"description": CSCI_310}, stars)
    assert result.status == "pass"
    assert not any("CSCI 377" in r for r in result.reasons)


def test_prereq_in_progress_row_added_by_the_student_is_a_warning():
    stars = {"completedCourses": [], "inProgressCourses": [{"code": "CSCI 201", "source": "usc", "origin": "student"}]}
    assert _check_prereq("CSCI 310", {"description": CSCI_310}, stars).status == "warning"


def test_prereq_and_still_requires_every_course():
    # ECON 605, hyphenated as printed.
    entry = {"description": "Prerequisites: ECON-601 and ECON-602."}
    stars = {"completedCourses": [{"code": "ECON 601"}]}
    result = _check_prereq("ECON 605", entry, stars)
    assert result.status == "fail"
    assert "ECON 602" in result.reasons[0] and "ECON 601" not in result.reasons[0]


def test_prereq_comma_list_without_or_requires_every_course():
    entry = {"description": "Prerequisites: HBIO 203, HBIO 301, HBIO 302, HBIO 320. Duplicates credit in former EXSC 491."}
    stars = {"completedCourses": [{"code": c} for c in ("HBIO 203", "HBIO 301", "HBIO 302")]}
    result = _check_prereq("HBIO 491", entry, stars)
    assert result.status == "fail"
    assert "HBIO 320" in result.reasons[0] and "EXSC 491" not in result.reasons[0]


def test_prereq_with_or_equivalent_warns_instead_of_failing():
    entry = {"description": "Prereq: SPAN 150 or equivalent. "}
    result = _check_prereq("SPAN 220", entry, {"completedCourses": []})
    assert result.status == "warning"
    assert "SPAN 150" in result.reasons[0]


def test_prereq_mixing_and_with_or_warns_instead_of_failing():
    # MEDS 450: "(BISC 220 or BISC 221) and MEDS 220" or "BISC 220 or (BISC 221 and MEDS 220)"?
    entry = {"description": "Prerequisites: BISC-220 or BISC-221 and MEDS-220."}
    stars = {"completedCourses": [{"code": "BISC 220"}]}
    result = _check_prereq("MEDS 450", entry, stars)
    assert result.status == "warning"
    assert "MEDS 220" in result.reasons[0] and "read more than one way" in result.reasons[0]


def test_prereq_for_other_programs_is_not_a_requirement():
    entry = {"description": "Prerequisite for Biological Sciences, Medicine, Dentistry, Pharmacy. Lecture, 4 hrs.; Lab, 3 hrs."}
    assert _check_prereq("PHYS 135A", entry, {"completedCourses": []}) is None


def test_corequisite_is_not_a_prerequisite():
    entry = {"description": "Prerequisite: CHEM 322aL. Corequisite: CHEM-322bL. Graded CR/NC."}
    stars = {"completedCourses": [{"code": "CHEM 322A"}]}
    assert _check_prereq("CHEM 251", entry, stars) is None


def test_prereq_matches_codes_with_old_catalog_suffixes():
    # "x" (not for major credit) and "g" (GE) aren't part of the code STARS prints.
    entry = {"description": "Prerequisite: MATH 118xg or MATH 125."}
    assert _check_prereq("MATH 208", entry, {"completedCourses": [{"code": "MATH 118"}]}) is None


def test_prereq_with_only_a_bare_course_number_is_unverified_not_silent():
    # GERM 201: "101 and 102" means GERM 101 and 102, but that's a guess, so it's surfaced.
    result = _check_prereq("GERM 201", {"description": "Prerequisite: 101 and 102. "}, {"completedCourses": []})
    assert result.status == "warning"
    assert result.reasons == ["Prerequisite note (unverified): 101 and 102"]


def test_prereq_fix_reaches_the_validator_result():
    catalog = {"ECON 351": {"units": 4, "description": ECON_351,
                            "sections": {"Lecture": [{"section_id": "1", "days": [], "start_time": "TBA", "end_time": "TBA"}]}}}
    summary = load_shared_stars("aibiz_jr_doubledegree.json")
    result = validate_next_semester([{"course": "ECON 351", "sections": ["1"]}], summary, catalog,
                                    {"_schema_version": EXPECTED_DEPT_CLEARANCE_SCHEMA_VERSION, "departments": []})
    assert not any("prerequisite" in r for r in result.course_results[0].reasons)


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


# Spring 2027 CHEM 105A, cut down: lectures and quizzes pair by link code (A with A), and the
# labs have no link code, so any lab goes with either lecture.
CHEM_105A = {
    "has_lab": True,
    "has_discussion": False,
    "sections": {
        "lectures": [
            {"section_id": "17218", "link_code": "A", "days": ["Mon", "Wed", "Fri"], "start_time": "09:00", "end_time": "09:50"},
            {"section_id": "17219", "link_code": "B", "days": ["Mon", "Wed", "Fri"], "start_time": "13:00", "end_time": "13:50"},
        ],
        "quizzes": [
            {"section_id": "17220", "link_code": "A", "days": ["Tue"], "start_time": "15:30", "end_time": "16:50"},
            {"section_id": "17221", "link_code": "B", "days": ["Tue"], "start_time": "15:30", "end_time": "16:50"},
        ],
        "labs": [
            {"section_id": "17232", "link_code": None, "days": ["Wed"], "start_time": "13:00", "end_time": "15:50"},
            {"section_id": "17250", "link_code": None, "days": ["Wed"], "start_time": "16:00", "end_time": "18:50"},
        ],
    },
}


def test_lab_pairing_none_when_the_lab_has_no_link_code():
    # No link code means the lab isn't tied to a lecture. Reading None as "a different code"
    # failed every CHEM 105A schedule, however it was built.
    assert _check_lab_discussion_pairing("CHEM 105A", CHEM_105A, {"17218", "17220", "17250"}) is None


def test_lab_pairing_fails_when_the_quiz_belongs_to_the_other_lecture():
    result = _check_lab_discussion_pairing("CHEM 105A", CHEM_105A, {"17218", "17221", "17250"})
    assert result.status == "fail"
    assert "quiz section doesn't share a link code" in result.reasons[0]


def test_lab_pairing_fails_when_no_lecture_is_picked():
    # A lab on its own isn't a registration: WebReg needs the lecture too.
    entry = {
        "has_lab": True,
        "has_discussion": False,
        "sections": {"lectures": [{"section_id": "30201", "link_code": None}], "labs": [{"section_id": "30225", "link_code": None}]},
    }
    result = _check_lab_discussion_pairing("CSCI 102", entry, {"30225"})
    assert result.status == "fail"
    assert "CSCI 102 requires a lecture section, but none was selected." in result.reasons


def test_lab_pairing_needs_no_lecture_when_the_course_has_none():
    entry = {"has_lab": False, "has_discussion": False, "sections": {"other": [{"section_id": "1", "mode": "Studio", "link_code": None}]}}
    assert _check_lab_discussion_pairing("ARCH 102", entry, {"1"}) is None


# BUAD 307 runs two ways: a combined Lecture/Discussion section, or a lecture plus a discussion.
BUAD_307 = {
    "has_lab": False,
    "has_discussion": True,
    "sections": {
        "other": [{"section_id": "14851", "mode": "Lecture/Discussion", "link_code": None}],
        "lectures": [{"section_id": "14800", "mode": "Lecture", "link_code": "J"}],
        "discussions": [{"section_id": "14802", "mode": "Discussion", "link_code": "J"}],
    },
}


def test_lab_pairing_combined_lecture_discussion_is_both():
    assert _check_lab_discussion_pairing("BUAD 307", BUAD_307, {"14851"}) is None


def test_lab_pairing_separate_lecture_still_needs_its_discussion():
    result = _check_lab_discussion_pairing("BUAD 307", BUAD_307, {"14800"})
    assert result.reasons == ["BUAD 307 requires a discussion section, but none was selected."]


# ---- major restrictions -----------------------------------------------------

def test_major_restrictions_warns_when_reserved_for_other_major():
    # Matching a note's program name against the report's major is a guess ("B.S. GeoDesign" vs
    # "Landscape Architecture and GeoDesign"), so a mismatch isn't proof the student can't enroll.
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
    assert result.status == "warning"
    assert "reserved for: B.S. GeoDesign program" in result.reasons[0]


def test_major_restrictions_warns_when_reserved_and_major_is_unknown():
    entry = {"has_restrictions": True, "sections": {"lectures": [
        {"section_id": "1", "is_cancelled": False, "notes": "This course is reserved for students in the B.S. GeoDesign program."}
    ]}}
    result = _check_major_restrictions("ARCH 203", entry, {"major": None, "classLevel": "Junior"}, {"1"})
    assert result.status == "warning"
    assert "reserved for: B.S. GeoDesign program" in result.reasons[0]


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


def test_time_conflict_fails_when_a_courses_own_sections_overlap():
    # Lecture 17219 (MWF 1:00) and lab 17232 (Wed 1:00-3:50) can't both be attended. Only pairs of
    # different courses were compared, so this passed.
    conflicts = _check_time_conflicts([("CHEM 105A", {"17219", "17221", "17232"})], {"CHEM 105A": CHEM_105A})
    assert conflicts["CHEM 105A"][0].status == "fail"
    assert "17219" in conflicts["CHEM 105A"][0].reasons[0] and "17232" in conflicts["CHEM 105A"][0].reasons[0]


def test_time_conflict_none_within_a_course_when_its_sections_fit():
    assert _check_time_conflicts([("CHEM 105A", {"17218", "17220", "17232"})], {"CHEM 105A": CHEM_105A}) == {}


def test_time_conflict_allows_an_overlap_the_department_scheduled():
    # AME 441B's only lecture and only lab overlap: that's the course's design, not the student's
    # mistake, so it isn't a conflict to report.
    entry = {"sections": {
        "lectures": [{"section_id": "28817", "days": ["Mon"], "start_time": "12:00", "end_time": "13:50"}],
        "labs": [{"section_id": "28818", "days": ["Mon"], "start_time": "10:00", "end_time": "12:50"}],
    }}
    assert _check_time_conflicts([("AME 441B", {"28817", "28818"})], {"AME 441B": entry}) == {}


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
        "ARCH 203": "fail",  # time conflicts with CSCI 426 and ANTH 338 (its "reserved for" note alone only warns)
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
