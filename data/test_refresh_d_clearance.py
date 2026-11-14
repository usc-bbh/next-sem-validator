"""Tests for refresh_d_clearance.apply_flags. Run with: python3 -m pytest data"""
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from refresh_d_clearance import apply_flags  # noqa: E402

# ENGL 174 as scraped before registration: every section D-clearance. USC lifted it since.
CATALOG = {
    "ENGL 174": {"has_d_clearance": True, "sections": {
        "lectures": [{"section_id": "32613", "has_d_clearance": True}],
        "discussions": [{"section_id": "32614", "has_d_clearance": True}, {"section_id": "32615", "has_d_clearance": True}],
    }},
    "AME 420": {"has_d_clearance": False, "sections": {"lectures": [
        {"section_id": "28814", "has_d_clearance": False}, {"section_id": "29014", "has_d_clearance": False},
    ]}},
    "CSCI 104": {"has_d_clearance": False, "units": 4, "sections": {"lectures": [{"section_id": "29903", "has_d_clearance": False}]}},
}


def test_lifted_d_clearance_clears_the_sections_and_the_course():
    catalog = copy.deepcopy(CATALOG)
    counts = apply_flags(catalog, {"ENGL 174": {"32613": False, "32614": False, "32615": False}})
    engl = catalog["ENGL 174"]
    assert engl["has_d_clearance"] is False
    assert not any(s["has_d_clearance"] for g in engl["sections"].values() for s in g)
    assert counts["sections_changed"] == 3 and counts["courses_changed"] == 1


def test_added_d_clearance_sets_the_course_flag_from_any_section():
    catalog = copy.deepcopy(CATALOG)
    apply_flags(catalog, {"AME 420": {"28814": False, "29014": True}})
    assert catalog["AME 420"]["has_d_clearance"] is True
    assert [s["has_d_clearance"] for s in catalog["AME 420"]["sections"]["lectures"]] == [False, True]


def test_what_usc_didnt_return_is_left_as_scraped():
    catalog = copy.deepcopy(CATALOG)
    counts = apply_flags(catalog, {"ENGL 174": {"32613": False}, "CSCI 104": None})
    discussions = catalog["ENGL 174"]["sections"]["discussions"]
    assert all(s["has_d_clearance"] for s in discussions)  # not in USC's answer
    assert catalog["ENGL 174"]["has_d_clearance"] is True  # still true: a discussion needs it
    assert catalog["CSCI 104"] == CATALOG["CSCI 104"]  # fetch failed
    assert counts["sections_not_live"] == 2 and counts["courses_unfetched"] == 2  # CSCI 104 failed, AME 420 not asked


def test_only_d_clearance_flags_change():
    catalog = copy.deepcopy(CATALOG)
    apply_flags(catalog, {"CSCI 104": {"29903": True}})
    assert catalog["CSCI 104"]["units"] == 4
    assert set(catalog["CSCI 104"]["sections"]["lectures"][0]) == {"section_id", "has_d_clearance"}
