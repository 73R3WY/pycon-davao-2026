# From Python to AI-Powered Django: Build a Quiz & Reviewer App

Workshop materials for **PyCon Davao 2026** (2 hours, beginner to intermediate).

Participants start with Python basics, build a Django **Quiz & Reviewer** app
(create a reviewer, add questions, share a link, take it, see a score), then add
an **AI question generator** that uses OpenAI with structured output, validation
and a human review step before anything is published.

```
Python → Django → Web app → Database → External API → Generative AI
```

## What is in this repo

| Path | What it is |
|------|------------|
| `slides/Jeremy Patrick Pacabis - From Python to AI-Powered Django_ Build a Quiz & Reviewer App.pptx` | The deck in the official PyCon Davao 2026 template, with speaker notes. The organizers' 7 reference pages (layout samples, branding, assets) are kept at the end as **hidden** slides. `slides/build_deck.js` regenerates it. |
| `slides/template/` | Pristine copy of the official template plus its five background images, used by the generator. |

Not in the repo on purpose: the organizers' speaker-orientation PDFs (they contain contact details) and my local rehearsal copy of the project.
| `python_basics/` | Five tiny scripts for Part 1. Each one runs on its own and checks itself with `assert`. |
| `quiz_reviewer/` | The finished Django project. Every file and function has a comment saying what it is for. |

## Setup (do this before the workshop)

You need **Python 3.12 or newer**, **Git**, a code editor (VS Code works well) and a browser.
An OpenAI API key is optional: the app has an offline `FAKE_AI` mode.

```bash
git clone https://github.com/73R3WY/pycon-davao-2026
cd pycon-davao-2026/quiz_reviewer

# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell:  .venv\Scripts\Activate.ps1
                                   # Windows cmd:         .venv\Scripts\activate.bat

# 2. Install Django, the OpenAI SDK and python-dotenv
pip install -r requirements.txt

# 3. Settings file (FAKE_AI=1 is already set, so no key is needed)
cp .env.example .env               # Windows: copy .env.example .env

# 4. Create the database tables and an admin login
python manage.py migrate
python manage.py createsuperuser

# 5. Run it
python manage.py runserver
```

Open <http://127.0.0.1:8000/> for the app and <http://127.0.0.1:8000/admin/> for the admin site.

Run the automated checks any time with:

```bash
python manage.py test
```

### Using a real OpenAI key

Edit `quiz_reviewer/.env`:

```
OPENAI_API_KEY=sk-...your key...
FAKE_AI=0
```

`.env` is listed in `.gitignore`, so the key never gets committed. If the key is
missing the app silently falls back to `FAKE_AI` mode.

## Following along: slides → files

| Slides | Topic | Files to open |
|--------|-------|---------------|
| 6–14 | Part 1 · Python foundations | `python_basics/01_variables.py` … `05_json_and_apis.py` |
| 18–20 | Project and app skeleton | `quiz_reviewer/manage.py`, `config/settings.py`, `reviewers/apps.py` |
| 21–23 | Models, relationships, migrations | `reviewers/models.py`, `reviewers/migrations/0001_initial.py` |
| 24 | Django admin | `reviewers/admin.py` |
| 25–28 | URLs, views, templates, first page | `config/urls.py`, `reviewers/urls.py`, `reviewers/views.py`, `templates/base.html`, `reviewers/templates/reviewers/reviewer_list.html` |
| 31–34 | Forms, GET vs POST, adding questions | `reviewers/forms.py`, `reviewers/views.py`, `reviewer_form.html`, `question_form.html` |
| 35–38 | Shareable link, taking the quiz, results | `reviewers/models.py` (`save`, `is_correct`), `take.html`, `results.html` |
| 40–46 | AI API, prompt, structured output, validation | `reviewers/ai.py`, `config/settings.py` (AI settings), `.env.example` |
| 47–51 | Drafts and human review | `reviewers/ai.py` (`save_as_drafts`), `reviewers/views.py` (`generate`, `review_drafts`), `generate.html`, `review_drafts.html` |
| Bonus (after Part 4) | Make it pretty | `static/css/app.css`, the `{% static %}` link in `templates/base.html`, `STATICFILES_DIRS` in `config/settings.py` |

## The app in one minute

1. **Create a reviewer** at `/new/` (or in the admin).
2. **Add questions** at `/reviewer/<slug>/add-question/`: multiple choice (2–4 choices, one correct) or direct answer.
3. **Share** `/reviewer/<slug>/`. No login needed to take it.
4. **Take it**: answers are graded by `Question.is_correct()`, results show the score and correct answers.
5. **Generate with AI** at `/reviewer/<slug>/generate/`: topic, number of questions, % multiple choice, difficulty.
6. **Review drafts** at `/reviewer/<slug>/review/`: accept (publish) or reject (delete). Drafts are never shown to quiz takers.

The AI pipeline lives in `reviewers/ai.py`:

```
GenerateForm (ranges checked) → build_prompt() → call_openai() [or fake_response()]
    → validate_questions() (reject the whole reply on any problem) → save_as_drafts()
```

## Bonus: make it pretty (after Part 4)

Everything in Parts 1–4 uses Pico CSS straight from a CDN. As an optional last
step, the app ships one hand-written stylesheet, `static/css/app.css`, that adds
the workshop colours, card shadows, a numbered badge per question, highlighted
answers, pill-shaped results, and small entrance animations. It is pure CSS: no
JavaScript, no build step, and it respects `prefers-reduced-motion`.

Only two lines wire it in, so you can show the "before" by removing them:

```html
{# templates/base.html #}
{% load static %}
<link rel="stylesheet" href="{% static 'css/app.css' %}">
```

```python
# config/settings.py
STATICFILES_DIRS = [BASE_DIR / "static"]
```

Ideas for participants: change the colours in the `:root` block, add a dark mode
with `@media (prefers-color-scheme: dark)`, or animate the score on the results page.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Couldn't import Django` | Activate the virtual environment, then `pip install -r requirements.txt`. |
| `no such table: reviewers_reviewer` | Run `python manage.py migrate`. |
| `Error: That port is already in use` | `python manage.py runserver 8001` and open port 8001 instead. |
| `403 Forbidden (CSRF ...)` on a form | The template is missing `{% csrf_token %}` inside the `<form>`. |
| "Could not generate questions: OpenAI request failed" | Check the key in `.env`, or set `FAKE_AI=1` to keep going offline. |
| Changed `models.py` and nothing happened | `python manage.py makemigrations` then `python manage.py migrate`. |

## Rebuilding the slides

```bash
cd slides
npm install
NODE_PATH=./node_modules node build_deck.js
# writes "Jeremy Patrick Pacabis - From Python to AI-Powered Django_ Build a Quiz & Reviewer App.pptx"
# and appends the template's reference pages as hidden slides (merge_template_slides.py)
```

`npm install` also pulls in Prism, which the generator uses to syntax-highlight every code card in the Monokai theme.

Fonts: the template uses **Sora** (headings) and **Inter** (body). Install them on the presenting
laptop (`brew install --cask font-sora font-inter`, or from Google Fonts) so the deck renders as designed.

## Submitting the deck (from the speaker orientation)

- **Deadline:** October 10, 2026, 11:59 PM. `.pptx` only, no PDF.
- **File name:** `[Speaker Name] - [Talk Title]` (already the case). Upload to the shared Google Drive folder from the speaker guide and give the organizing team view access.
- **Demo video:** record the demo in advance (venue internet may be unreliable) and upload it to the same folder as `[Speaker Name] - [Talk Title] - [DEMO]`. The app's `FAKE_AI=1` mode also keeps Part 4 working offline.
- **On the day:** Workshop 1, Saturday 17 October, 1:10–3:10 PM. Arrive 30 minutes early for the briefing, present from your own laptop (HDMI available), light mode, large fonts. A volunteer point person is assigned to each speaker.

## License and credits

Code, scripts and slide text are released under the [MIT License](LICENSE).
The PyCon Davao 2026 and DurianPy artwork, template backgrounds and sponsor logos
belong to the organizers and sponsors and are included only so this workshop deck
can be rebuilt as presented; please do not reuse them for other material.
