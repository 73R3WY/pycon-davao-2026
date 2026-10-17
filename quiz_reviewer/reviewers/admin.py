"""
reviewers/admin.py — plugs our models into Django's automatic admin website.

PURPOSE: With these few lines, http://127.0.0.1:8000/admin/ gets full
create / edit / delete screens for Reviewers, Questions and Choices.
No HTML written by us. This is the fastest way to put data in the app
during the workshop before we build our own forms.
"""

from django.contrib import admin

from .models import Choice, Question, Reviewer


class ChoiceInline(admin.TabularInline):
    """Edit a question's choices as rows *inside* the question page."""

    model = Choice
    extra = 4  # show 4 empty choice rows by default


class QuestionInline(admin.TabularInline):
    """Show a reviewer's questions inside the reviewer page (quick overview)."""

    model = Question
    extra = 0
    fields = ("text", "question_type", "answer", "status", "ai_generated")
    show_change_link = True  # link to the full question page (where choices live)


@admin.register(Reviewer)
class ReviewerAdmin(admin.ModelAdmin):
    """Admin screen for Reviewer."""

    list_display = ("title", "slug", "created_at")
    search_fields = ("title",)
    readonly_fields = ("slug",)  # slug is generated automatically in models.py
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin screen for Question, with its choices editable inline."""

    list_display = ("text", "reviewer", "question_type", "status", "ai_generated")
    list_filter = ("question_type", "status", "ai_generated", "reviewer")
    inlines = [ChoiceInline]
