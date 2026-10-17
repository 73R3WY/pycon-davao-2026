"""
04_classes.py — classes are blueprints; objects are the things built from them.

PURPOSE: Django models are classes. Understanding this file means models.py
will look familiar: a class with attributes (fields) and methods (behaviour).
Run it:  python 04_classes.py
"""


class Question:
    """A quiz question with a correct answer. The blueprint."""

    def __init__(self, text: str, answer: str) -> None:
        """__init__ runs when you build an object: Question("...", "...")."""
        self.text = text  # self = "this particular question"
        self.answer = answer

    def is_correct(self, submitted: str) -> bool:
        """A method: a function that belongs to the object."""
        return submitted.strip().casefold() == self.answer.casefold()


class Reviewer:
    """A named collection of Question objects."""

    def __init__(self, title: str) -> None:
        """Start with a title and an empty list of questions."""
        self.title = title
        self.questions: list[Question] = []

    def add(self, question: Question) -> None:
        """Put a question into this reviewer."""
        self.questions.append(question)

    def grade(self, submitted_answers: list[str]) -> int:
        """Compare each submitted answer with its question, count the correct ones."""
        return sum(
            1 for q, a in zip(self.questions, submitted_answers) if q.is_correct(a)
        )


# Build objects from the blueprints.
reviewer = Reviewer("Python Fundamentals")
reviewer.add(Question("Which keyword defines a function?", "def"))
reviewer.add(Question("What does len() return?", "length"))

print(reviewer.title, "has", len(reviewer.questions), "questions")
print("Score:", reviewer.grade(["DEF", "size"]), "/", len(reviewer.questions))

# Compare with Django (coming in Part 2):
#   class Question(models.Model):
#       text = models.TextField()
#       answer = models.CharField(max_length=300)
# Same idea — Django just also knows how to save it to a database.

assert reviewer.grade(["def", "length"]) == 2
assert reviewer.grade(["x", "y"]) == 0
