"""
reviewers/models.py — the DATA of our app, described as Python classes.

PURPOSE: Each class below becomes a table in the database. Each attribute
becomes a column. Django's ORM (Object-Relational Mapper) lets us work with
rows as normal Python objects instead of writing SQL.

The shape of our data:

    Reviewer  "Python Fundamentals"
      └── Question  "Which keyword defines a function?"   (multiple choice)
      │     ├── Choice "func"      correct=False
      │     ├── Choice "def"       correct=True
      │     └── Choice "function"  correct=False
      └── Question  "What does len() return?"            (direct answer)
            answer = "the number of items"

A ForeignKey is the arrow in that picture: "this Question belongs to that
Reviewer". It is how Django represents a one-to-many relationship.
"""

from django.db import models
from django.urls import reverse
from django.utils.text import slugify


class Reviewer(models.Model):
    """A quiz / study set. Has a title, a description and many questions."""

    title = models.CharField(max_length=200)
    # The slug is the URL-friendly version of the title, e.g.
    # "Python Fundamentals" -> "python-fundamentals". It makes shareable links.
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]  # newest first when we list them

    def __str__(self) -> str:
        """What Django Admin (and print()) shows for a Reviewer."""
        return self.title

    def save(self, *args, **kwargs) -> None:
        """Automatically build a unique slug from the title the first time we save."""
        if not self.slug:
            base = slugify(self.title) or "reviewer"
            slug = base
            counter = 2
            # If "python-basics" is taken, try "python-basics-2", "-3", ...
            while Reviewer.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_absolute_url(self) -> str:
        """The public, shareable link for taking this reviewer."""
        return reverse("reviewers:take", kwargs={"slug": self.slug})

    @property
    def published_questions(self):
        """Only questions that have been approved (manual ones, or accepted AI drafts)."""
        return self.questions.filter(status=Question.Status.PUBLISHED)

    @property
    def draft_questions(self):
        """AI-generated questions waiting for a human to accept or reject them."""
        return self.questions.filter(status=Question.Status.DRAFT)


class Question(models.Model):
    """One question inside a Reviewer. Either multiple choice or direct (typed) answer."""

    class Type(models.TextChoices):
        """The two kinds of question our app supports."""

        MULTIPLE_CHOICE = "multiple_choice", "Multiple choice"
        DIRECT = "direct", "Direct answer"

    class Status(models.TextChoices):
        """DRAFT = waiting for human review. PUBLISHED = visible to quiz takers."""

        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    # related_name="questions" lets us write reviewer.questions.all()
    reviewer = models.ForeignKey(Reviewer, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    question_type = models.CharField(max_length=20, choices=Type.choices, default=Type.MULTIPLE_CHOICE)
    # Only used for DIRECT questions: the expected typed answer.
    answer = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED)
    # Lets us remember whether the AI wrote this question (shown in the UI).
    ai_generated = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        """Short label for admin lists."""
        return self.text[:60]

    @property
    def is_multiple_choice(self) -> bool:
        """Convenience flag used by templates to decide radio buttons vs text box."""
        return self.question_type == self.Type.MULTIPLE_CHOICE

    def is_correct(self, submitted: str) -> bool:
        """
        Decide whether a quiz taker's answer is right.

        - Multiple choice: `submitted` is the id of the Choice they clicked.
        - Direct answer:   `submitted` is the text they typed. We compare
          case-insensitively and ignore surrounding spaces, so "Def" == "def".
        """
        submitted = (submitted or "").strip()
        if self.is_multiple_choice:
            # Anything that is not a whole number cannot be a Choice id
            # (someone editing the form by hand). Treat it as a wrong answer.
            if not submitted.isdigit():
                return False
            return self.choices.filter(pk=submitted, is_correct=True).exists()
        return submitted.casefold() == self.answer.strip().casefold()

    def correct_answer_text(self) -> str:
        """The right answer as text, for the results page."""
        if self.is_multiple_choice:
            choice = self.choices.filter(is_correct=True).first()
            return choice.text if choice else "(no correct choice set)"
        return self.answer


class Choice(models.Model):
    """One option of a multiple-choice question. Exactly one per question should be correct."""

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    text = models.CharField(max_length=300)
    is_correct = models.BooleanField(default=False)

    def __str__(self) -> str:
        """Label used in admin; marks the correct one with a check."""
        return f"{'✔ ' if self.is_correct else ''}{self.text}"
