"""
reviewers/forms.py — describes the HTML forms and VALIDATES what users type.

PURPOSE: A Django Form does three jobs at once:
  1. renders the <input> fields in the template,
  2. checks the submitted data (required? right type? within range?),
  3. gives us clean Python values (form.cleaned_data).

Rule of the workshop: never trust input — not from humans, not from AI.
"""

from django import forms
from django.conf import settings

from .models import Question, Reviewer

# How many choice boxes the manual "add question" form shows.
CHOICE_SLOTS = 4


class ReviewerForm(forms.ModelForm):
    """Create a Reviewer. A ModelForm builds its fields from the model automatically."""

    class Meta:
        model = Reviewer
        fields = ["title", "description"]


class QuestionForm(forms.Form):
    """
    Add one question by hand.

    This is a plain Form (not a ModelForm) because one submission creates a
    Question AND up to four Choice rows — two different models.
    """

    text = forms.CharField(label="Question", widget=forms.Textarea(attrs={"rows": 2}))
    question_type = forms.ChoiceField(choices=Question.Type.choices)
    answer = forms.CharField(
        label="Expected answer (direct-answer questions only)", max_length=300, required=False
    )
    correct_choice = forms.TypedChoiceField(
        label="Which choice is correct?",
        choices=[(i, f"Choice {i + 1}") for i in range(CHOICE_SLOTS)],
        coerce=int,
        empty_value=None,  # nothing picked -> None (instead of "")
        required=False,
        widget=forms.RadioSelect,
    )

    def __init__(self, *args, **kwargs):
        """Add choice_0 .. choice_3 text fields dynamically."""
        super().__init__(*args, **kwargs)
        for i in range(CHOICE_SLOTS):
            self.fields[f"choice_{i}"] = forms.CharField(
                label=f"Choice {i + 1}", max_length=300, required=False
            )

    def choice_texts(self) -> list[str]:
        """The non-empty choice texts, in order."""
        return [
            self.cleaned_data.get(f"choice_{i}", "").strip()
            for i in range(CHOICE_SLOTS)
            if self.cleaned_data.get(f"choice_{i}", "").strip()
        ]

    def clean(self):
        """Cross-field rules: MC needs 2+ choices and a correct one; direct needs an answer."""
        data = super().clean()
        if data.get("question_type") == Question.Type.MULTIPLE_CHOICE:
            texts = self.choice_texts()
            if len(texts) < 2:
                raise forms.ValidationError("A multiple-choice question needs at least two choices.")
            correct = data.get("correct_choice")
            if correct is None:
                raise forms.ValidationError("Pick which choice is the correct one.")
            if not data.get(f"choice_{correct}", "").strip():
                raise forms.ValidationError("The correct choice you picked is empty.")
        else:
            if not data.get("answer", "").strip():
                raise forms.ValidationError("A direct-answer question needs an expected answer.")
        return data


class GenerateForm(forms.Form):
    """
    Settings for the AI question generator (Part 4).

    Guardrail #1 lives here: the ranges stop someone asking for 10,000
    questions or 150% multiple choice before we ever call OpenAI.
    """

    DIFFICULTIES = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    ]

    topic = forms.CharField(max_length=120, help_text="e.g. Python Fundamentals")
    # max_value comes from settings.AI_MAX_QUESTIONS so the form and ai.py
    # always agree on the cap (one place to change it).
    count = forms.IntegerField(
        label="Number of questions", min_value=1, max_value=settings.AI_MAX_QUESTIONS, initial=5
    )
    mc_percent = forms.IntegerField(
        label="Multiple choice %", min_value=0, max_value=100, initial=60,
        help_text="The rest will be direct-answer questions.",
    )
    difficulty = forms.ChoiceField(choices=DIFFICULTIES, initial="beginner")
