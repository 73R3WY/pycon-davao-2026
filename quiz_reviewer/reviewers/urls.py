"""
reviewers/urls.py — maps web addresses to view functions for this app.

PURPOSE: The URL is the "order" a visitor places; the view is the "kitchen"
that prepares the response. <slug:slug> captures part of the address and
passes it to the view as a Python argument.

    /                                   reviewer_list
    /new/                               reviewer_create
    /reviewer/<slug>/                   take          (public, shareable)
    /reviewer/<slug>/add-question/      question_add
    /reviewer/<slug>/generate/          generate       (AI)
    /reviewer/<slug>/review/            review_drafts  (human-in-the-loop)
"""

from django.urls import path

from . import views

# app_name lets templates write {% url "reviewers:take" slug %}
app_name = "reviewers"

urlpatterns = [
    path("", views.reviewer_list, name="list"),
    path("new/", views.reviewer_create, name="create"),
    path("reviewer/<slug:slug>/", views.take, name="take"),
    path("reviewer/<slug:slug>/add-question/", views.question_add, name="question_add"),
    path("reviewer/<slug:slug>/generate/", views.generate, name="generate"),
    path("reviewer/<slug:slug>/review/", views.review_drafts, name="review_drafts"),
]
