"""
config/asgi.py — entry point for async-capable servers (Uvicorn, Daphne).

PURPOSE: Same job as wsgi.py but for the newer async protocol. Not used in
this workshop; kept because Django generates it and hosts may expect it.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_asgi_application()
