"""
Feature C3 — Resume–Answer Contradiction Engine
Compares CLAIMED resume skills vs DEMONSTRATED interview performance.
Flags specific mismatches with evidence and severity ratings.

Uses your existing LLM client (Anthropic Claude).
Install: pip install anthropic
"""

import json


def detect_contradictions(
    resume_data: dict, qa_pairs: list
) -> list:
    """
    Compare resume claims against interview performance.

    Args:
        resume_data: dict from parse_resume()
        qa_pairs: list of {'question': str, 'answer': str, 'score': int}

    Returns:
        list of contradiction objects with severity and recommendations.
    """
    claimed_skills = resume_data.get("skills", [])
    exp_years = resume_data.get("total_exp_years", 0)
    designations = resume_data.get("designations", [])

    # Filter low-scoring answers only (score <= 5 out of 10)
    weak_answers = [qa for qa in qa_pairs if qa.get("score", 10) <= 5]

    if not weak_answers:
        return []  # No weak answers, no contradictions to report

    try:
        import anthropic

        client = anthropic.Anthropic()

        prompt = f"""
You are an interview evaluator checking for resume inflation.

Resume claims:
- Skills: {', '.join(claimed_skills)}
- Total experience: {exp_years} years
- Designations: {', '.join(designations)}

Weak interview answers (score <= 5/10):
{json.dumps(weak_answers, indent=2)}

Identify specific contradictions where the resume claim
is NOT supported by the interview performance.

Return a JSON array (no markdown, no explanation) with objects:
{{ "claimed": "...", "demonstrated": "...", "severity": "HIGH/MED/LOW",
   "recommendation": "..." }}
"""
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return [
                {
                    "error": "Could not parse contradiction output",
                    "raw": raw,
                }
            ]
    except (ImportError, TypeError, Exception):
        # Fallback when Anthropic is not available or API key is missing
        return _rule_based_contradictions(
            claimed_skills, weak_answers, exp_years, designations
        )


def _rule_based_contradictions(
    claimed_skills: list,
    weak_answers: list,
    exp_years: int,
    designations: list,
) -> list:
    """Rule-based fallback for contradiction detection."""
    contradictions = []

    for qa in weak_answers:
        question_lower = qa.get("question", "").lower()
        score = qa.get("score", 0)

        for skill in claimed_skills:
            if skill.lower() in question_lower and score <= 3:
                contradictions.append(
                    {
                        "claimed": f"Lists '{skill}' on resume",
                        "demonstrated": (
                            f"Scored {score}/10 on a {skill} question"
                        ),
                        "severity": "HIGH" if score <= 2 else "MED",
                        "recommendation": (
                            f"Follow up on {skill} claims or verify "
                            f"via reference check"
                        ),
                    }
                )

    return contradictions


if __name__ == "__main__":
    resume = {
        "skills": [
            "Python", "Kubernetes", "AWS", "Machine Learning"
        ],
        "total_exp_years": 4,
        "designations": ["Senior Backend Engineer"],
    }

    qa_pairs = [
        {
            "question": "How does Kubernetes schedule pods?",
            "answer": "Um, it just automatically puts them on servers?",
            "score": 2,
        },
        {
            "question": "Explain Python generators.",
            "answer": "They are like lists but lazy evaluation with yield.",
            "score": 7,
        },
    ]

    contradictions = detect_contradictions(resume, qa_pairs)
    print("Contradictions Found:")
    for c in contradictions:
        if "error" not in c:
            print(f"  [{c['severity']}] Claimed: {c['claimed']}")
            print(f"         Shown:   {c['demonstrated']}")
            print(f"         Action:  {c['recommendation']}")
