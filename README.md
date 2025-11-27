# note_web_app
This is a Flask-based Notes Application with user authentication and additional productivity features.
# Notes + Pomodoro — Flask App

Lightweight Flask-based notes application with user authentication, note summaries, and a Pomodoro timer.

## Key features
- User registration, login, session handling
- Create, edit, delete notes
- View generated summaries of notes
- Pomodoro timer (frontend JS + CSS)
- SQLite persistence via SQLAlchemy
- Alembic migrations

## Repository layout
- app/  
  - app.py, routes.py, models.py — main Flask code  
  - templates/ — HTML pages (notes, login, register, pomodoro, summaries)  
  - static/ — CSS and JS assets
- migrations/ — Alembic migration scripts
- run.py — application entry point
- requirements.txt, .env (config)

## Requirements
- Python 3.8+
- pip

## Quick start (Windows)
1. Create and activate venv
   ```
   python -m venv venv
   venv\Scripts\activate
   ```
2. Install dependencies
   ```
   pip install -r requirements.txt
   ```
3. Configure environment
   - Copy or create a `.env` file at the project root. Typical variables:
     ```
     FLASK_ENV=development
     SECRET_KEY=<your-secret>
     DATABASE_URL=sqlite:///instance/app.db
     ```
4. Initialize / migrate database (if using Flask-Migrate)
   ```
   set FLASK_APP=run.py
   flask db upgrade
   ```
   Or run the included script if the project uses a custom entry:
   ```
   python run.py
   ```
5. Open the app
   - If using `flask run`, visit http://127.0.0.1:5000
   - If `python run.py` prints a different host/port, follow output.

## Development notes
- Templates live in `app/templates`. Static assets in `app/static`.
- Migrations are managed by Alembic (see `migrations/`).
- The `instance/` folder is used for the local SQLite DB by default.

## Troubleshooting
- If the app can't find the DB, ensure `instance/` exists and `DATABASE_URL` points to a writable SQLite path.
- Use the integrated browser devtools to debug frontend (pomodoro.js / app.js).

## Contributing
- Fork, create a branch, add tests for new features, open a PR.
- Keep changes small and focused.
