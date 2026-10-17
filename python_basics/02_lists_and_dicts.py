"""
02_lists_and_dicts.py — lists hold many things; dictionaries label each thing.

PURPOSE: a quiz is "a list of questions", and each question is "a dictionary
of fields". These two shapes are exactly what the AI will send us later as JSON.
Run it:  python 02_lists_and_dicts.py
"""

# A list is an ordered collection, written with [square brackets].
choices = ["func", "def", "function", "define"]
print(choices[0])  # lists start counting at 0 -> "func"
print(choices[1])  # -> "def"
print(len(choices))  # how many items -> 4

choices.append("lambda")  # add to the end
print(choices)

# A dictionary maps keys to values, written with {curly braces}.
question = {
    "text": "Which keyword defines a function in Python?",
    "type": "multiple_choice",
    "choices": choices,
    "correct": "def",
}
print(question["text"])  # look up a value by its key
print(question["correct"])

# Lists of dictionaries: a whole quiz!
quiz = [
    question,
    {"text": "What does len() return?", "type": "direct", "answer": "the number of items"},
]

# A for-loop visits each item in turn.
for number, q in enumerate(quiz, start=1):
    print(f"{number}. {q['text']}  ({q['type']})")

assert quiz[1]["type"] == "direct"
assert len(quiz) == 2
