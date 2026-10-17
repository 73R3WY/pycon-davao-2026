"""
config/urls.py — the project's "table of contents" for URLs.

PURPOSE: When a browser asks for an address, Django looks here first.
We keep this file tiny and hand everything to the reviewers app's own urls.py.

    /admin/      -> Django's built-in admin website
    /            -> everything else goes to reviewers/urls.py
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # include() says: "for any other URL, look inside reviewers/urls.py".
    path("", include("reviewers.urls")),
]
