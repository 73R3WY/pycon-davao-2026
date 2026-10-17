"""
reviewers/ai.py — everything about talking to OpenAI (Part 4 of the workshop).

PURPOSE: Keep all AI code in ONE file, away from views, so the pattern is easy
to see:

    settings (topic, count, %, difficulty)
        -> build_prompt()        turn settings into instructions for the model
        -> call_openai()         send them, get STRUCTURED JSON back
        -> validate_questions()  treat the JSON like untrusted user input
        -> save_as_drafts()      store, but as DRAFTS a human must approve

If anything in validate_questions() fails we raise AIError, show the message
to the user and save NOTHING. Never assume AI output is valid application data.
"""

from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from django.db import transaction

from .models import Choice, Question, Reviewer

# Guardrails for the content itself.
MIN_CHOICES = 2
MAX_CHOICES = 6
MAX_TEXT_LENGTH = 500
ALLOWED_TYPES = {Question.Type.MULTIPLE_CHOICE, Question.Type.DIRECT}

# The exact shape we ask the model to return. Sending a JSON Schema means the
# model is forced to answer with data our code can read — not a free-form essay.
QUESTIONS_SCHEMA: dict[str, Any] = {
    "name": "quiz_questions",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "type": {"type": "string", "enum": ["multiple_choice", "direct"]},
                        "question": {"type": "string"},
                        "choices": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "text": {"type": "string"},
                                    "correct": {"type": "boolean"},
                                },
                                "required": ["text", "correct"],
                            },
                        },
                        "answer": {"type": "string"},
                    },
                    "required": ["type", "question", "choices", "answer"],
                },
            }
        },
        "required": ["questions"],
    },
}


class AIError(Exception):
    """Raised when the AI call fails or its answer does not pass our checks."""


def build_prompt(topic: str, count: int, mc_percent: int, difficulty: str) -> list[dict[str, str]]:
    """
    Turn the creator's settings into chat messages for the model.

    Returns the `messages` list the OpenAI API expects: a "system" message
    (how to behave) and a "user" message (what we want this time).
    """
    mc_count = round(count * mc_percent / 100)
    direct_count = count - mc_count
    system = (
        "You write quiz questions for students. "
        "Reply ONLY with JSON matching the given schema. "
        "Multiple-choice questions have 4 choices with exactly one correct=true. "
        "Direct questions have an empty choices list and a short expected answer. "
        "Keep every question clear, accurate and self-contained."
    )
    user = (
        f"Topic: {topic}\n"
        f"Difficulty: {difficulty}\n"
        f"Create exactly {count} questions: "
        f"{mc_count} multiple_choice and {direct_count} direct."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def fake_response(topic: str, count: int, mc_percent: int, difficulty: str) -> dict[str, Any]:
    """
    Offline stand-in for OpenAI, used when FAKE_AI=1 or no API key is set.

    It returns data in the SAME shape as the real API so every other step
    (validation, drafts, review) behaves identically. Handy on workshop day
    when the Wi-Fi dies or you have no key yet.
    """
    mc_count = round(count * mc_percent / 100)
    questions = []
    for i in range(count):
        if i < mc_count:
            questions.append(
                {
                    "type": "multiple_choice",
                    "question": f"[{difficulty}] Sample question {i + 1} about {topic}: which option is correct?",
                    "choices": [
                        {"text": "Option A", "correct": False},
                        {"text": "Option B (correct)", "correct": True},
                        {"text": "Option C", "correct": False},
                        {"text": "Option D", "correct": False},
                    ],
                    "answer": "",
                }
            )
        else:
            questions.append(
                {
                    "type": "direct",
                    "question": f"[{difficulty}] In one word, what is sample question {i + 1} about?",
                    "choices": [],
                    "answer": topic,
                }
            )
    return {"questions": questions}


def call_openai(messages: list[dict[str, str]]) -> dict[str, Any]:
    """
    Send the messages to OpenAI and return the parsed JSON object.

    `response_format` with our JSON Schema is the key trick: the model's reply
    is guaranteed to be valid JSON in our shape, so json.loads() always works.
    """
    # Imported here so the rest of the app works even if the package is missing.
    from openai import OpenAI, OpenAIError

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            response_format={"type": "json_schema", "json_schema": QUESTIONS_SCHEMA},
        )
    except OpenAIError as exc:  # network problems, bad key, quota, ...
        raise AIError(f"OpenAI request failed: {exc}") from exc

    content = completion.choices[0].message.content or ""
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise AIError("The AI did not return valid JSON.") from exc


def validate_questions(data: Any, requested_count: int) -> list[dict[str, Any]]:
    """
    Check the AI's JSON the same way we would check a form a stranger filled in.

    Returns a clean list of question dicts, or raises AIError describing the
    first problem found. Every rule here is a guardrail from the slides.
    """
    if not isinstance(data, dict) or not isinstance(data.get("questions"), list):
        raise AIError("Response must be an object with a 'questions' list.")

    questions = data["questions"]
    if not questions:
        raise AIError("The AI returned zero questions.")
    if len(questions) > min(requested_count, settings.AI_MAX_QUESTIONS):
        raise AIError(f"The AI returned {len(questions)} questions, more than requested.")

    clean: list[dict[str, Any]] = []
    for index, item in enumerate(questions, start=1):
        if not isinstance(item, dict):
            raise AIError(f"Question {index} is not an object.")

        q_type = item.get("type")
        text = str(item.get("question", "")).strip()
        if q_type not in ALLOWED_TYPES:
            raise AIError(f"Question {index} has unknown type {q_type!r}.")
        if not text:
            raise AIError(f"Question {index} has empty text.")
        if len(text) > MAX_TEXT_LENGTH:
            raise AIError(f"Question {index} is too long ({len(text)} characters).")

        if q_type == Question.Type.MULTIPLE_CHOICE:
            choices = item.get("choices") or []
            if not MIN_CHOICES <= len(choices) <= MAX_CHOICES:
                raise AIError(f"Question {index} must have {MIN_CHOICES}-{MAX_CHOICES} choices.")
            texts = [str(c.get("text", "")).strip() for c in choices if isinstance(c, dict)]
            if len(texts) != len(choices) or not all(texts):
                raise AIError(f"Question {index} has an empty choice.")
            correct_count = sum(1 for c in choices if c.get("correct") is True)
            if correct_count != 1:
                raise AIError(f"Question {index} must have exactly one correct choice (has {correct_count}).")
            clean.append(
                {
                    "type": q_type,
                    "question": text,
                    "choices": [{"text": t, "correct": bool(c.get("correct"))} for t, c in zip(texts, choices)],
                }
            )
        else:
            answer = str(item.get("answer", "")).strip()
            if not answer:
                raise AIError(f"Question {index} (direct) is missing its expected answer.")
            if len(answer) > 300:
                raise AIError(f"Question {index} has an answer that is too long.")
            clean.append({"type": q_type, "question": text, "answer": answer})

    return clean


@transaction.atomic
def save_as_drafts(reviewer: Reviewer, questions: list[dict[str, Any]]) -> int:
    """
    Store validated questions as DRAFTS belonging to `reviewer`.

    @transaction.atomic means "all or nothing": if saving choice #3 of
    question #5 fails, nothing from this batch stays in the database.
    Returns how many questions were saved.
    """
    next_order = reviewer.questions.count()
    for offset, item in enumerate(questions):
        question = Question.objects.create(
            reviewer=reviewer,
            text=item["question"],
            question_type=item["type"],
            answer=item.get("answer", ""),
            status=Question.Status.DRAFT,  # <-- a human must accept it first
            ai_generated=True,
            order=next_order + offset,
        )
        for choice in item.get("choices", []):
            Choice.objects.create(question=question, text=choice["text"], is_correct=choice["correct"])
    return len(questions)


def generate_questions(reviewer: Reviewer, topic: str, count: int, mc_percent: int, difficulty: str) -> int:
    """
    The whole pipeline in one call, used by the `generate` view.

    prompt -> (OpenAI or fake) -> validate -> save as drafts.
    Returns the number of draft questions created. Raises AIError on any problem.
    """
    if settings.FAKE_AI:
        raw = fake_response(topic, count, mc_percent, difficulty)
    else:
        raw = call_openai(build_prompt(topic, count, mc_percent, difficulty))
    clean = validate_questions(raw, requested_count=count)
    return save_as_drafts(reviewer, clean)
