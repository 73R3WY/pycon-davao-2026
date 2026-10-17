#!/usr/bin/env python
"""
manage.py — the command-line remote control for this Django project.

PURPOSE: Every Django command goes through this file, for example:

    python manage.py runserver        # start the development web server
    python manage.py makemigrations   # turn model changes into migration files
    python manage.py migrate          # apply migrations to the database
    python manage.py createsuperuser  # make an admin login
    python manage.py test             # run the tests in reviewers/tests.py

You never edit this file; Django generated it.
"""

import os
import sys


def main() -> None:
    """Point Django at our settings, then hand the command-line args to Django."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Did you activate the virtual environment "
            "and run `pip install -r requirements.txt`?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
