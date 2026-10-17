"""
config/wsgi.py — entry point for production web servers (Gunicorn, etc.).

PURPOSE: Not used during the workshop (runserver does this for us), but
production hosts import `application` from here to run the site.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()
