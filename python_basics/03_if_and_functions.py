"""
03_if_and_functions.py — making decisions (if/else) and reusing code (functions).

PURPOSE: grading an answer is a decision. We wrap it in a function so the quiz
app can call it for every question. Later, Django's Question.is_correct()
is this exact idea living inside a class.
Run it:  python 03_if_and_functions.py
"""


def check_answer(submitted: str, correct: str) -> bool:
    """
    Return True when the typed answer matches the correct one.

    .strip() removes spaces at the ends, .casefold() ignores UPPER/lower case,
    so " Def " still counts as "def".
    """
    return submitted.strip().casefold() == correct.strip().casefold()


def feedback(submitted: str, correct: str) -> str:
    """Build a friendly message using an if/else decision."""
    if check_answer(submitted, correct):
        return "✔ Correct!"
    else:
        return f"✘ Not quite. The answer is {correct!r}."


def score(answers: list[tuple[str, str]]) -> int:
    """Count how many (submitted, correct) pairs are right."""
    total = 0
    for submitted, correct in answers:
        if check_answer(submitted, correct):
            total += 1  # same as total = total + 1
    return total


print(feedback("Def", "def"))
print(feedback("function", "def"))

my_answers = [("def", "def"), ("length", "length"), ("size", "length")]
print(f"Score: {score(my_answers)} / {len(my_answers)}")

assert check_answer("  DEF ", "def") is True
assert check_answer("func", "def") is False
assert score(my_answers) == 2
