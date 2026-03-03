"""
Feature C2 — Adaptive Question Generator (Resume + Self-Intro → Questions)
Takes parsed resume JSON and self-introduction transcript.
Uses LLM to generate personalized, contextual questions.

5-Step Flow:
1. Parse: Resume → JSON via pyresparser
2. Analyse: Self-intro transcript → NLP tone + vocabulary
3. Gap Matrix: Claimed skills vs JD skills → priority probe list
4. Seed + Personalise: Question bank seed → LLM rewrites with context
5. Adapt: Each answer scored → next question difficulty adjusts

Install: pip install anthropic (or: pip install openai)
"""

import json

# ── QUESTION SEED BANK (per skill) ────────────────────────────────
SEED_QUESTIONS = {
    "python": "Explain the difference between a list and a generator.",
    "docker": "What happens when you run docker build?",
    "kubernetes": "How does Kubernetes schedule pods onto nodes?",
    "aws": "What is the difference between S3 and EBS?",
    "redis": "How would you use Redis to implement a rate limiter?",
    "ci/cd": "Walk me through a CI/CD pipeline you have built.",
    "fastapi": "How does FastAPI handle async request processing?",
    "postgresql": "Explain the difference between WHERE and HAVING.",
    "system design": "Design a URL shortener with scaling strategy.",
    "rest apis": "What are idempotent HTTP methods and why do they matter?",
    "machine learning": "Explain bias-variance tradeoff.",
    "react": "What is the virtual DOM and how does React use it?",
    "sql": "Explain the difference between INNER and LEFT JOIN.",
    "data structures": "Implement a LRU Cache with O(1) operations.",
    "algorithms": "Find two numbers in an array that add to target sum.",
}


def generate_personalised_question(
    skill: str,
    seed_q: str,
    candidate_name: str,
    company: str,
    project: str,
    difficulty: str = "MID",
    self_intro_tone: str = "neutral",
) -> str:
    """
    Uses LLM to rewrite seed question with candidate-specific context.
    Falls back to seed question if LLM is not available.
    """
    try:
        import anthropic

        client = anthropic.Anthropic()

        prompt = f"""
You are an expert technical interviewer.

Candidate profile:
- Name: {candidate_name}
- Previous company: {company}
- Notable project on resume: {project}
- Self-introduction tone: {self_intro_tone}
- Difficulty calibration: {difficulty}

Seed question for skill '{skill}':
{seed_q}

Rewrite this question to be:
1. Personalised — reference their company or project where natural
2. Calibrated to {difficulty} level
3. Impossible to answer with a generic AI response
4. One sentence only. No preamble.

Return ONLY the rewritten question, nothing else.
"""
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception:
        # Fallback to seed question if API not available
        return f"[{difficulty}] {seed_q}"


def select_next_difficulty(
    prev_answer_score: int, current_difficulty: str
) -> str:
    """
    Adjust difficulty based on previous answer quality.
    score: 0-10 (from scoring engine)
    """
    levels = ["BEGINNER", "JUNIOR", "MID", "SENIOR", "PRINCIPAL"]
    idx = levels.index(current_difficulty)

    if prev_answer_score >= 8 and idx < 4:
        return levels[idx + 1]  # step up
    elif prev_answer_score <= 4 and idx > 0:
        return levels[idx - 1]  # step down
    else:
        return current_difficulty  # stay


def generate_interview_questions(
    resume_data: dict,
    gap_matrix: dict,
    difficulty: str,
    num_questions: int = 10,
) -> list:
    """
    Generate a full set of interview questions based on resume analysis.
    Prioritizes missing skills (gaps) for probing.
    """
    questions = []
    company = (
        resume_data.get("companies", ["Unknown"])[0]
        if resume_data.get("companies")
        else "their company"
    )
    name = resume_data.get("name", "Candidate")

    # Priority 1: Missing skills (from gap matrix)
    for skill in gap_matrix.get("missing_skills", []):
        if len(questions) >= num_questions:
            break
        seed = SEED_QUESTIONS.get(skill, f"Explain your experience with {skill}.")
        q = generate_personalised_question(
            skill=skill,
            seed_q=seed,
            candidate_name=name,
            company=company,
            project="their projects",
            difficulty=difficulty,
        )
        questions.append(
            {
                "question": q,
                "skill": skill,
                "difficulty": difficulty,
                "probe_type": "GAP",
            }
        )

    # Priority 2: Matched skills (verify claimed proficiency)
    for skill in gap_matrix.get("matched_skills", []):
        if len(questions) >= num_questions:
            break
        seed = SEED_QUESTIONS.get(skill, f"Explain your experience with {skill}.")
        q = generate_personalised_question(
            skill=skill,
            seed_q=seed,
            candidate_name=name,
            company=company,
            project="their projects",
            difficulty=difficulty,
        )
        questions.append(
            {
                "question": q,
                "skill": skill,
                "difficulty": difficulty,
                "probe_type": "VERIFY",
            }
        )

    return questions


if __name__ == "__main__":
    # ── EXAMPLE USAGE ─────────────────────────────────────────────
    resume = {
        "name": "Raj Sharma",
        "companies": ["Flipkart"],
        "skills": ["Python", "Docker"],
    }
    gap = {
        "missing_skills": ["kubernetes", "aws", "ci/cd"],
        "matched_skills": ["python", "docker"],
    }

    questions = generate_interview_questions(resume, gap, "MID", 5)
    print("Generated Questions:")
    for i, q in enumerate(questions, 1):
        print(f"  {i}. [{q['probe_type']}] [{q['skill']}] {q['question']}")
