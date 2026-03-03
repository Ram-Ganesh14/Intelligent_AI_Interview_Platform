"""
Feature C1 — Resume Parser → Structured JSON Extraction
Parses PDF/DOCX resumes and extracts structured data.
Builds skill gap matrix against job description requirements.

GitHub Source: github.com/OmkarPathak/pyresparser
Install: pip install pyresparser spacy nltk
         python -m spacy download en_core_web_sm
         python -m nltk.downloader words stopwords
"""

import json
from pyresparser import ResumeParser


def parse_resume(file_path: str) -> dict:
    """
    Parse a resume PDF or DOCX into structured JSON.
    Returns: name, email, skills, experience, education, companies.
    """
    data = ResumeParser(file_path).get_extracted_data()
    return {
        "name": data.get("name", ""),
        "email": data.get("email", ""),
        "mobile": data.get("mobile_number", ""),
        "skills": data.get("skills", []),
        "total_exp_years": data.get("total_experience", 0),
        "education": data.get("degree", []),
        "companies": data.get("company_names", []),
        "designations": data.get("designation", []),
        "no_of_pages": data.get("no_of_pages", 1),
    }


def build_gap_matrix(
    resume_data: dict, job_description_skills: list
) -> dict:
    """
    Compare claimed skills vs job requirements.
    Returns: matched, missing, extra skills, and gap_score.
    """
    claimed = set(s.lower() for s in resume_data["skills"])
    required = set(s.lower() for s in job_description_skills)

    matched = claimed & required
    missing = required - claimed
    extra = claimed - required

    gap_score = len(matched) / max(len(required), 1)

    return {
        "matched_skills": sorted(matched),
        "missing_skills": sorted(missing),  # <-- PROBE THESE
        "extra_skills": sorted(extra),
        "gap_score": round(gap_score, 2),
        "coverage_pct": round(gap_score * 100, 1),
    }


def get_difficulty_level(resume_data: dict) -> str:
    """Map experience years to interview difficulty tier."""
    years = resume_data.get("total_exp_years", 0)
    if years < 1:
        return "BEGINNER"
    elif years < 3:
        return "JUNIOR"
    elif years < 6:
        return "MID"
    elif years < 10:
        return "SENIOR"
    else:
        return "PRINCIPAL"


if __name__ == "__main__":
    # Example usage (requires an actual resume file)
    import sys

    if len(sys.argv) < 2:
        print("Usage: python resume_parser.py <path/to/resume.pdf>")
        print("\nRunning with sample data...")
        resume = {
            "name": "Raj Sharma",
            "email": "raj@email.com",
            "skills": ["Python", "Docker", "React", "TensorFlow"],
            "total_exp_years": 4,
            "education": ["B.Tech CS"],
            "companies": ["Flipkart"],
            "designations": ["SDE-2"],
        }
    else:
        resume = parse_resume(sys.argv[1])

    jd_skills = [
        "Python", "FastAPI", "Docker", "Kubernetes",
        "PostgreSQL", "Redis", "AWS", "CI/CD",
    ]

    gap = build_gap_matrix(resume, jd_skills)
    level = get_difficulty_level(resume)

    print("Resume:", json.dumps(resume, indent=2))
    print("\nGap Matrix:", json.dumps(gap, indent=2))
    print("\nInterview Level:", level)
