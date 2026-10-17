"""
05_json_and_apis.py — JSON is how programs send data to each other.

PURPOSE: In Part 4 the AI answers us in JSON. json.loads() turns that text
into the lists and dictionaries from 02_lists_and_dicts.py, and then we
VALIDATE it before trusting it. This script does exactly that, offline.
Run it:  python 05_json_and_apis.py
"""

import json

# This is text (a string) — exactly what arrives over the internet from an API.
ai_reply = """
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Which keyword defines a function in Python?",
      "choices": [
        {"text": "func", "correct": false},
        {"text": "def", "correct": true},
        {"text": "function", "correct": false}
      ]
    },
    {
      "type": "direct",
      "question": "What does len() return?",
      "answer": "the number of items"
    }
  ]
}
"""

# json.loads = "load string": text in, Python data out.
data = json.loads(ai_reply)
print(type(data))  # <class 'dict'>
print(data["questions"][0]["question"])


def validate(question: dict) -> str | None:
    """
    Return an error message if the question is unusable, or None if it is fine.

    Rule of the workshop: treat AI output like input from a stranger.
    """
    if question.get("type") not in ("multiple_choice", "direct"):
        return "unknown type"
    if not question.get("question"):
        return "empty question text"
    if question["type"] == "multiple_choice":
        correct = [c for c in question.get("choices", []) if c.get("correct")]
        if len(correct) != 1:
            return f"needs exactly one correct choice, found {len(correct)}"
    elif not question.get("answer"):
        return "direct question has no answer"
    return None


for q in data["questions"]:
    problem = validate(q)
    print("OK  " if problem is None else f"BAD ({problem})", "-", q["question"])

# json.dumps = "dump to string": Python data back to text (what we SEND to an API).
request_body = json.dumps({"topic": "Python", "count": 5, "difficulty": "beginner"})
print(request_body)

assert validate(data["questions"][0]) is None
assert validate({"type": "direct", "question": "x"}) == "direct question has no answer"
assert validate({"type": "multiple_choice", "question": "x", "choices": []}).startswith("needs exactly one")
