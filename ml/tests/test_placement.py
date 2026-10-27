from __future__ import annotations

from edubase_ml.placement import DriveInfo, analyze_placement_gaps


def test_placement_gap_ordering():
    drives = [
        DriveInfo(
            id="d1",
            company_name="TechCorp",
            role_title="Backend Engineer",
            package_lpa=20.0,
            min_cgpa=7.5,
            required_skills=["Python", "PostgreSQL", "Docker", "Kubernetes"],
            eligible_programs=["prog_cs"],
            status="upcoming",
        ),
        DriveInfo(
            id="d2",
            company_name="DataFlow",
            role_title="Data Scientist",
            package_lpa=15.0,
            min_cgpa=7.0,
            required_skills=["Python", "SQL", "Docker"],
            eligible_programs=["prog_cs"],
            status="upcoming",
        ),
        DriveInfo(
            id="d3",
            company_name="FinanceFirst",
            role_title="Analyst",
            package_lpa=30.0,
            min_cgpa=8.5,  # Student not eligible (CGPA 8.0)
            required_skills=["Excel", "Financial Modeling"],
            eligible_programs=["prog_cs"],
            status="upcoming",
        ),
        DriveInfo(
            id="d4",
            company_name="CompletedDrive",
            role_title="Dev",
            package_lpa=12.0,
            min_cgpa=6.0,
            required_skills=["Rust"],
            eligible_programs=["prog_cs"],
            status="completed",  # Not upcoming
        ),
    ]

    student_cgpa = 8.0
    student_program = "prog_cs"
    # Student already has Python and SQL
    student_skills = ["Python", "SQL"]

    gaps = analyze_placement_gaps(student_cgpa, student_program, student_skills, drives)

    # Missing in eligible drives (d1 and d2):
    # Docker: in d1 (20) + d2 (15) -> impact = 35.0
    # PostgreSQL: in d1 (20) -> impact = 20.0
    # Kubernetes: in d1 (20) -> impact = 20.0
    # (Excel from d3 excluded because min_cgpa 8.5 > 8.0; Rust from d4 excluded because completed)

    assert len(gaps) >= 3

    # Top impact gap must be Docker (impact 35.0)
    top_gap = gaps[0]
    assert top_gap["skill"].lower() == "docker"
    assert top_gap["impact"] == 35.0
    assert len(top_gap["unlocked_drives"]) == 2
    assert "TechCorp" in top_gap["reason"] or "DataFlow" in top_gap["reason"]

    # Verify descending ordering
    for i in range(len(gaps) - 1):
        assert gaps[i]["impact"] >= gaps[i + 1]["impact"]
