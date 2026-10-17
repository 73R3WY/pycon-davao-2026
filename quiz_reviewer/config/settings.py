"""
config/settings.py — the control panel for the whole Django project.

PURPOSE: Every project-wide setting lives here: which apps are installed,
which database to use, where templates are, and our OpenAI configuration.
Django reads this file once when the server starts.

Workshop tip: you rarely edit this file. In this workshop we only touch
three spots (marked with  # WORKSHOP  below).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# BASE_DIR is the folder that contains manage.py. We build other paths from it
# so the project works no matter where you clone it.
BASE_DIR = Path(__file__).resolve().parent.parent

# WORKSHOP: load variables from a ".env" file into os.environ.
# This is how we keep the OpenAI API key OUT of the source code.
load_dotenv(BASE_DIR / ".env")

# Used by Django to sign cookies and forms. Fine for a workshop; in a real
# deployment you would also load this from the environment.
# Read from the environment when set; the default is fine for the workshop only.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-workshop-only-change-me")

# DEBUG=True shows friendly error pages with details. Never use in production.
DEBUG = True

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# WORKSHOP: every Django "app" (a folder of models/views/templates) must be
# listed here, otherwise Django ignores it. We added "reviewers".
INSTALLED_APPS = [
    "django.contrib.admin",  # the automatic admin website
    "django.contrib.auth",  # users and permissions (used by admin login)
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",  # one-time flash messages ("Saved!")
    "django.contrib.staticfiles",
    "reviewers",  # <-- our workshop app
]

# Middleware = code that runs on EVERY request before/after the view.
# Think of it as security guards and helpers standing at the door.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",  # protects our POST forms
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# The file that lists the project's URLs (see config/urls.py).
ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # WORKSHOP: project-wide templates (base.html) live in /templates.
        # App templates live in reviewers/templates (APP_DIRS finds them).
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite = a database that is just one file (db.sqlite3). Perfect for learning:
# nothing to install, nothing to configure.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
# BONUS STEP (after Part 4): where our own CSS lives. Django's dev server serves
# it automatically while DEBUG=True.
STATICFILES_DIRS = [BASE_DIR / "static"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# WORKSHOP: AI settings (Part 4)
# ---------------------------------------------------------------------------
# The API key is read from the environment, never typed into code.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
# A small, cheap model is plenty for generating quiz questions.
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
# FAKE_AI=1 makes the app return a built-in sample response instead of calling
# OpenAI. Great for practising without an API key (or without internet).
FAKE_AI = os.environ.get("FAKE_AI", "0") == "1" or not OPENAI_API_KEY
# Guardrail: the maximum number of questions one AI request may create.
AI_MAX_QUESTIONS = 20
