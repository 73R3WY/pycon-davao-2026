"""
reviewers/tests.py — automatic checks that the important logic works.

PURPOSE: Run with  python manage.py test .  Two things are worth testing
because they are the "brains" of the app: grading answers, and refusing bad
AI output. If someone breaks either, these tests go red.
"""

from django.test import TestCase, override_settings
from django.urls import reverse

from .ai import AIError, fake_response, save_as_drafts, validate_questions
from .models import Choice, Question, Reviewer


def make_reviewer() -> Reviewer:
    """Helper: a reviewer with one multiple-choice and one direct question."""
    reviewer = Reviewer.objects.create(title="Python Fundamentals")
    mc = Question.objects.create(reviewer=reviewer, text="Which keyword defines a function?")
    Choice.objects.create(question=mc, text="func")
    Choice.objects.create(question=mc, text="def", is_correct=True)
    Question.objects.create(
        reviewer=reviewer, text="What does len() return?", question_type=Question.Type.DIRECT, answer="length"
    )
    return reviewer


class GradingTests(TestCase):
    """Question.is_correct and the take/results page."""

    def test_slug_is_generated_and_unique(self):
        """Two reviewers with the same title get different slugs."""
        a = Reviewer.objects.create(title="My Quiz")
        b = Reviewer.objects.create(title="My Quiz")
        self.assertEqual(a.slug, "my-quiz")
        self.assertEqual(b.slug, "my-quiz-2")

    def test_is_correct(self):
        """MC compares choice ids; direct compares text ignoring case/spaces."""
        reviewer = make_reviewer()
        mc, direct = reviewer.questions.all()
        right = mc.choices.get(is_correct=True)
        self.assertTrue(mc.is_correct(str(right.id)))
        self.assertFalse(mc.is_correct("999"))
        self.assertTrue(direct.is_correct("  LENGTH "))
        self.assertFalse(direct.is_correct("size"))

    def test_is_correct_ignores_garbage_choice_id(self):
        """A hand-edited form value like 'abc' must grade as wrong, not crash."""
        reviewer = make_reviewer()
        mc = reviewer.questions.first()
        self.assertFalse(mc.is_correct("abc"))
        self.assertFalse(mc.is_correct("1; DROP TABLE"))
        self.assertFalse(mc.is_correct(""))

    def test_take_page_scores_answers(self):
        """Submitting the take form shows the score."""
        reviewer = make_reviewer()
        mc, direct = reviewer.questions.all()
        right = mc.choices.get(is_correct=True)
        response = self.client.post(
            reverse("reviewers:take", args=[reviewer.slug]),
            {f"q_{mc.id}": right.id, f"q_{direct.id}": "wrong"},
        )
        self.assertEqual(response.context["score"], 1)
        self.assertEqual(response.context["total"], 2)

    def test_drafts_are_hidden_from_takers(self):
        """Only published questions appear on the public page."""
        reviewer = make_reviewer()
        Question.objects.create(reviewer=reviewer, text="draft?", status=Question.Status.DRAFT)
        response = self.client.get(reverse("reviewers:take", args=[reviewer.slug]))
        self.assertEqual(len(response.context["questions"]), 2)


class AIValidationTests(TestCase):
    """validate_questions must reject anything that is not safe to store."""

    def good(self):
        """A valid payload to mutate in each test."""
        return {
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": "Q1?",
                    "choices": [{"text": "a", "correct": True}, {"text": "b", "correct": False}],
                    "answer": "",
                },
                {"type": "direct", "question": "Q2?", "choices": [], "answer": "yes"},
            ]
        }

    def test_valid_payload_passes(self):
        """The happy path returns two clean questions."""
        self.assertEqual(len(validate_questions(self.good(), requested_count=2)), 2)

    def test_fake_response_is_valid(self):
        """The offline sample must pass the same checks as real AI output."""
        clean = validate_questions(fake_response("Django", 5, 60, "beginner"), requested_count=5)
        self.assertEqual(len(clean), 5)

    def test_two_correct_choices_rejected(self):
        """Exactly one correct choice is required."""
        data = self.good()
        data["questions"][0]["choices"][1]["correct"] = True
        with self.assertRaises(AIError):
            validate_questions(data, requested_count=2)

    def test_missing_direct_answer_rejected(self):
        """A direct question without an answer cannot be graded, so reject it."""
        data = self.good()
        data["questions"][1]["answer"] = "  "
        with self.assertRaises(AIError):
            validate_questions(data, requested_count=2)

    def test_too_many_questions_rejected(self):
        """The AI may not return more than was requested."""
        with self.assertRaises(AIError):
            validate_questions(self.good(), requested_count=1)

    def test_unknown_type_rejected(self):
        """Only our two question types are allowed."""
        data = self.good()
        data["questions"][0]["type"] = "essay"
        with self.assertRaises(AIError):
            validate_questions(data, requested_count=2)

    def test_saved_as_drafts_then_accepted(self):
        """Drafts stay hidden until the review page publishes them."""
        reviewer = Reviewer.objects.create(title="AI Quiz")
        save_as_drafts(reviewer, validate_questions(self.good(), requested_count=2))
        self.assertEqual(reviewer.draft_questions.count(), 2)
        self.assertEqual(reviewer.published_questions.count(), 0)
        ids = list(reviewer.draft_questions.values_list("id", flat=True))
        self.client.post(
            reverse("reviewers:review_drafts", args=[reviewer.slug]),
            {"action": "accept", "question_ids": ids[:1]},
        )
        self.assertEqual(reviewer.published_questions.count(), 1)

    @override_settings(FAKE_AI=True)
    def test_generate_view_creates_drafts(self):
        """End to end with FAKE_AI: the form creates drafts and redirects to review."""
        reviewer = Reviewer.objects.create(title="Django")
        response = self.client.post(
            reverse("reviewers:generate", args=[reviewer.slug]),
            {"topic": "Django", "count": 4, "mc_percent": 50, "difficulty": "beginner"},
        )
        self.assertRedirects(response, reverse("reviewers:review_drafts", args=[reviewer.slug]))
        self.assertEqual(reviewer.draft_questions.count(), 4)
