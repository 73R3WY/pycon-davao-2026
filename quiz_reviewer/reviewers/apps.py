"""
reviewers/apps.py — tells Django the app's name and settings.

PURPOSE: Django generated this. The string "reviewers" here is what we put in
INSTALLED_APPS. Nothing to change for the workshop.
"""

from django.apps import AppConfig


class ReviewersConfig(AppConfig):
    """Configuration object for the reviewers app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "reviewers"
