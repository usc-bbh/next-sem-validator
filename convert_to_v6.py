#!/usr/bin/env python3
"""
Convert fall2026_catalog.json (scraper output) → courses.json (v6 schema).

The degree-planner expects the bbh_schedule_data_v6 shape:
  - sections grouped by type (lectures, labs, discussions, quizzes, other)
  - section_counts per type
  - open_seats computed
  - boolean flags (has_lab, has_discussion, has_d_clearance, has_restrictions)

Usage:
    python3 convert_to_v6.py fall2026_catalog.json courses_v6.json
"""

import json
import sys
from datetime import datetime, timezone

# Map scraper's rnrMode values to v6 section_type keys
TYPE_MAP = {
    "Lecture":      "lectures",
    "Lecture-Lab":  "lectures",
    "Lecture-Discussion": "lectures",
    "Lab":          "labs",
    "Discussion":   "discussions",
    "Quiz":         "quizzes",
}

def map_section_type(mode_str):
    """Map the scraper's type field to the v6 section_type."""
    if not mode_str:
        return "other"
    return TYPE_MAP.get(mode_str, "other")

def convert_days(days_list):
    """Ensure days are the 3-letter format the v6 schema uses."""
    if not days_list:
        return []
    day_map = {
        "M": "Mon", "T": "Tue", "W": "Wed", "R": "Thu", "F": "Fri",
        "S": "Sat", "U": "Sun",
        "Mon": "Mon", "Tue": "Tue", "Wed": "Wed", "Thu": "Thu",
        "Fri": "Fri", "Sat": "Sat", "Sun": "Sun",
        "Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed",
        "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun",
    }
    result = []
    for d in days_list:
        mapped = day_map.get(d, d)
        if mapped not in result:
            result.append(mapped)
    return result

def convert_section(sec, course_has_d_clearance):
    """Convert a scraper section to v6 section format."""
    mode = sec.get("type") or "Other"
    section_type = map_section_type(mode)
    total = sec.get("total_seats") or 0
    reg = sec.get("registered_seats") or 0
    open_seats = max(0, total - reg)

    return {
        "section_id": str(sec.get("section_id") or ""),
        "section_type": section_type,
        "mode": mode,
        "has_d_clearance": bool(sec.get("has_d_clearance", False)),
        "link_code": sec.get("link_code") or None,
        "instructor": sec.get("instructor") or "TBD",
        "notes": None,
        "days": convert_days(sec.get("days", [])),
        "start_time": sec.get("start_time") or "TBD",
        "end_time": sec.get("end_time") or "TBD",
        "total_seats": total,
        "registered_seats": reg,
        "open_seats": open_seats,
        "is_full": bool(sec.get("is_full", False)),
        "is_cancelled": bool(sec.get("is_cancelled", False)),
    }

def convert_course(course, term_code):
    """Convert a scraper course to v6 course format."""
    sections_by_type = {}
    section_counts = {}
    has_d_clearance = False
    has_restrictions = bool(
        course.get("course_restrictions")
        or course.get("major_restrictions")
        or course.get("school_restrictions")
    )

    # Check course-level d-clearance from any section
    for sec in course.get("sections", []):
        if sec.get("has_d_clearance"):
            has_d_clearance = True
            break

    for sec in course.get("sections", []):
        v6_sec = convert_section(sec, has_d_clearance)
        st = v6_sec["section_type"]
        if st not in sections_by_type:
            sections_by_type[st] = []
        sections_by_type[st].append(v6_sec)

    for st, secs in sections_by_type.items():
        section_counts[st] = len(secs)

    has_lab = "labs" in sections_by_type
    has_discussion = "discussions" in sections_by_type

    # Build description: use title + description if both exist
    title = course.get("title") or ""
    desc = course.get("description") or ""
    if title and desc:
        description = f"{title}. {desc}"
    elif title:
        description = title
    elif desc:
        description = desc
    else:
        description = course.get("course_name", "")

    # Units: ensure it's a number
    units = course.get("units")
    if isinstance(units, str):
        try:
            units = float(units)
            if units == int(units):
                units = int(units)
        except ValueError:
            units = 0
    elif units is None:
        units = 0

    return {
        "course_name": course.get("course_name") or "",
        "units": units,
        "description": description,
        "term_code": term_code,
        "has_lab": has_lab,
        "has_discussion": has_discussion,
        "has_d_clearance": has_d_clearance,
        "has_restrictions": has_restrictions,
        "section_counts": section_counts,
        "sections": sections_by_type,
    }

def build_offering_frequency(courses_by_term):
    """Build offering_frequency from available terms data."""
    course_terms = {}
    for term_code, courses in courses_by_term.items():
        for c in courses:
            name = c["course_name"]
            if name not in course_terms:
                course_terms[name] = set()
            course_terms[name].add(term_code)

    total_terms = len(courses_by_term)
    freq = {}
    for name, terms in course_terms.items():
        count = len(terms)
        # Thresholds based on catalog/README.md pattern
        if total_terms <= 1:
            label = "every_semester"  # can't infer with only one term
        elif count >= total_terms * 0.8:
            label = "every_semester"
        elif count >= total_terms * 0.5:
            label = "most_semesters"
        elif count >= 2:
            label = "occasionally"
        else:
            label = "rarely"

        freq[name] = {
            "terms_offered": sorted(terms, reverse=True),
            "count": count,
            "frequency_label": label,
        }
    return freq

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 convert_to_v6.py <catalog.json> [output.json]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "courses_v6.json"

    print(f"Reading {input_path}...")
    with open(input_path) as f:
        catalog = json.load(f)

    raw_courses = catalog.get("courses", [])
    term_code = catalog.get("term", "20263")
    term_name = catalog.get("term_name", "Fall 2026")

    print(f"Converting {len(raw_courses)} courses to v6 schema...")

    v6_courses = []
    for c in raw_courses:
        v6_courses.append(convert_course(c, term_code))

    terms_data = {term_code: v6_courses}
    terms = {term_code: term_name}
    offering_frequency = build_offering_frequency(terms_data)

    output = {
        "schema_version": "6.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "terms": terms,
        "terms_data": terms_data,
        "offering_frequency": offering_frequency,
    }

    print(f"Writing {output_path}...")
    with open(output_path, "w") as f:
        json.dump(output, f)

    # Stats
    total_sections = sum(
        sum(len(secs) for secs in c["sections"].values())
        for c in v6_courses
    )
    size_mb = len(json.dumps(output)) / (1024 * 1024)
    print(f"\n✓ Done: {len(v6_courses)} courses, {total_sections} sections")
    print(f"  File size: {size_mb:.1f} MB")
    print(f"  Output: {output_path}")

if __name__ == "__main__":
    main()
