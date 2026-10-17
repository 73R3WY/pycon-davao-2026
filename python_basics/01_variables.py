"""
01_variables.py — variables, strings, numbers and f-strings.

PURPOSE: the very first Python ideas we need for the quiz app.
Run it:  python 01_variables.py
A variable is a labelled box. You put a value in it and use the label later.
"""

# A string (text) goes in quotes.
title = "Python Fundamentals"
# An integer (whole number) does not.
question_count = 10
# A float (decimal number).
multiple_choice_percent = 70.0

# An f-string lets us drop variables into text with {curly braces}.
print(f"Reviewer: {title}")
print(f"It has {question_count} questions, {multiple_choice_percent}% multiple choice.")

# Math works the way you expect. // is whole-number division.
multiple_choice_count = question_count * multiple_choice_percent // 100
direct_count = question_count - multiple_choice_count
print(f"{multiple_choice_count} multiple choice + {direct_count} direct answer")

# type() tells you what kind of value a variable holds.
print(type(title), type(question_count), type(multiple_choice_percent))

# Self-check: if this line is wrong the script stops with an AssertionError.
assert direct_count == 3
