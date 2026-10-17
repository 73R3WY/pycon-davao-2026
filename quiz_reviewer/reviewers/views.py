"""
reviewers/views.py — the "kitchen": one function per page.

PURPOSE: A view receives an HttpRequest, does some work (read/write the
database, run a form), and returns an HttpResponse — usually by rendering a
template with some data.

The pattern used by every form view here:

    if request.method == "POST":   # the user clicked Submit
        form = SomeForm(request.POST)
        if form.is_valid():
            ...save...
            return redirect(...)   # Post/Redirect/Get: refresh never re-submits
    else:                          # the user just opened the page
        form = SomeForm()
    return render(request, "template.html", {"form": form})
"""

from django.contrib import messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render

from .ai import AIError, generate_questions
from .forms import GenerateForm, QuestionForm, ReviewerForm
from .models import Choice, Question, Reviewer


def reviewer_list(request):
    """Home page: every reviewer, with links to take / edit each one."""
    reviewers = Reviewer.objects.all()
    return render(request, "reviewers/reviewer_list.html", {"reviewers": reviewers})


def reviewer_create(request):
    """Create a new Reviewer from a title and description."""
    if request.method == "POST":
        form = ReviewerForm(request.POST)
        if form.is_valid():
            reviewer = form.save()  # ModelForm can save straight to the database
            messages.success(request, f"Created “{reviewer.title}”. Now add some questions!")
            return redirect("reviewers:question_add", slug=reviewer.slug)
    else:
        form = ReviewerForm()
    return render(request, "reviewers/reviewer_form.html", {"form": form})


def question_add(request, slug):
    """Add one question (and its choices) to a reviewer by hand."""
    reviewer = get_object_or_404(Reviewer, slug=slug)  # 404 page if the slug is wrong
    if request.method == "POST":
        form = QuestionForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            with transaction.atomic():  # question + choices saved together or not at all
                question = Question.objects.create(
                    reviewer=reviewer,
                    text=data["text"],
                    question_type=data["question_type"],
                    answer=data["answer"] if data["question_type"] == Question.Type.DIRECT else "",
                    order=reviewer.questions.count(),
                )
                if question.is_multiple_choice:
                    for i, text in enumerate(form.choice_texts()):
                        Choice.objects.create(
                            question=question,
                            text=text,
                            is_correct=(i == data["correct_choice"]),
                        )
            messages.success(request, "Question added.")
            return redirect("reviewers:question_add", slug=reviewer.slug)
    else:
        form = QuestionForm()
    return render(
        request,
        "reviewers/question_form.html",
        {"form": form, "reviewer": reviewer, "questions": reviewer.published_questions},
    )


def take(request, slug):
    """
    The public page at /reviewer/<slug>/.

    GET  -> show the published questions as a form.
    POST -> grade the answers and show the results page.
    No login needed: anyone with the link can take the reviewer.
    """
    reviewer = get_object_or_404(Reviewer, slug=slug)
    questions = list(reviewer.published_questions.prefetch_related("choices"))

    if request.method == "POST":
        results = []
        for question in questions:
            # Inputs are named q_<id>, so we can find each answer in request.POST
            submitted = request.POST.get(f"q_{question.id}", "")
            results.append(
                {
                    "question": question,
                    "submitted": submitted,
                    "correct": question.is_correct(submitted),
                    "correct_text": question.correct_answer_text(),
                }
            )
        score = sum(1 for r in results if r["correct"])
        return render(
            request,
            "reviewers/results.html",
            {"reviewer": reviewer, "results": results, "score": score, "total": len(results)},
        )

    return render(request, "reviewers/take.html", {"reviewer": reviewer, "questions": questions})


def generate(request, slug):
    """Ask the AI for questions. They are saved as DRAFTS, then we go to the review page."""
    reviewer = get_object_or_404(Reviewer, slug=slug)
    # Compact version of the GET/POST pattern: `request.POST or None` gives an
    # unbound (empty) form on GET and a bound one on POST, in a single line.
    form = GenerateForm(request.POST or None, initial={"topic": reviewer.title})
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        try:
            created = generate_questions(reviewer, d["topic"], d["count"], d["mc_percent"], d["difficulty"])
        except AIError as exc:
            # Validation failed or OpenAI errored: show why, save nothing.
            messages.error(request, f"Could not generate questions: {exc}")
        else:
            messages.success(request, f"The AI drafted {created} question(s). Review them below.")
            return redirect("reviewers:review_drafts", slug=reviewer.slug)
    return render(request, "reviewers/generate.html", {"form": form, "reviewer": reviewer})


def review_drafts(request, slug):
    """
    Human-in-the-loop: list draft questions with checkboxes.

    "Accept selected" publishes them; "Reject selected" deletes them.
    Nothing the AI wrote reaches quiz takers without passing through here.
    """
    reviewer = get_object_or_404(Reviewer, slug=slug)
    if request.method == "POST":
        ids = request.POST.getlist("question_ids")  # all ticked checkboxes
        selected = reviewer.draft_questions.filter(pk__in=ids)
        if request.POST.get("action") == "accept":
            count = selected.update(status=Question.Status.PUBLISHED)
            messages.success(request, f"Published {count} question(s).")
        elif request.POST.get("action") == "reject":
            count, _ = selected.delete()
            messages.info(request, f"Rejected {count} question(s).")
        return redirect("reviewers:review_drafts", slug=reviewer.slug)
    drafts = reviewer.draft_questions.prefetch_related("choices")
    return render(request, "reviewers/review_drafts.html", {"reviewer": reviewer, "drafts": drafts})
