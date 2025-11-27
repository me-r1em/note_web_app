from flask import Blueprint, render_template, request, redirect, url_for, session, send_file, jsonify
from .models import User, Note, Tag, Draft,Summary,db
from datetime import datetime
from html import unescape
from dotenv import load_dotenv
from xhtml2pdf import pisa
import re
import io
import os
import google.generativeai as genai

bp = Blueprint('main', __name__)

# ---------- Helpers ----------

def strip_html(html):
    """Convert HTML content to plain text."""
    text = re.sub(r'<[^>]+>', '', html)  # remove all HTML tags
    text = unescape(text)                # decode HTML entities like &nbsp;, &lt;, etc.
    text = text.replace('\xa0', ' ')    # convert non-breaking spaces
    return text.strip()

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def summarize_text(note):
    """
    Summarize a note in 2 concise sentences using Gemini 2.5 Flash.
    """
    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")  # ✅ correct model name
        prompt = f"Summarize this note in 2 concise sentences:\n\n{note}"
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"❌ Error generating summary: {str(e)}"


def get_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)

def human_time(dt):
    if not dt:
        return ""
    now = datetime.utcnow()
    diff = now - dt
    # small, simple human friendly (minutes/hours/days)
    if diff.total_seconds() < 60:
        return "just now"
    if diff.total_seconds() < 3600:
        mins = int(diff.total_seconds() // 60)
        return f"{mins}m ago"
    if diff.total_seconds() < 86400:
        hours = int(diff.total_seconds() // 3600)
        return f"{hours}h ago"
    days = diff.days
    if days < 30:
        return f"{days}d ago"
    months = int(days / 30)
    return f"{months}mo ago"

# ---------- Auth ----------
@bp.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('main.notes'))
    return redirect(url_for('main.login'))

@bp.route('/register', methods=['GET','POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if not username or not password:
            return "Please provide username & password", 400
        if User.query.filter_by(username=username).first():
            return "Username already exists", 400
        u = User(username=username, password=password)
        db.session.add(u)
        db.session.commit()
        return redirect(url_for('main.login'))
    return render_template('register.html')

@bp.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        u = User.query.filter_by(username=username, password=password).first()
        if u:
            session['user_id'] = u.id
            session['username'] = u.username
            return redirect(url_for('main.notes'))
        else:
            return "Invalid credentials", 401
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.login'))

# ---------- Notes ----------
@bp.route('/notes', methods=['GET','POST'])
def notes():
    user = get_user()
    if not user:
        return redirect(url_for('main.login'))

    # create note
    if request.method == 'POST':
        title = request.form.get('title','').strip()
        content = request.form.get('content','').strip()
        tags_raw = request.form.get('tags','').strip()  # comma separated
        pinned = bool(request.form.get('pinned'))
        if title == "" and content == "":
            return redirect(url_for('main.notes'))
        note = Note(user_id=user.id, title=title or "(no title)", content=content, pinned=pinned)
        # attach tags
        tags = []
        if tags_raw:
            for t in [x.strip() for x in tags_raw.split(',') if x.strip()]:
                tag = Tag.query.filter_by(name=t).first()
                if not tag:
                    tag = Tag(name=t)
                tags.append(tag)
        note.tags = tags
        db.session.add(note)
        # delete user's draft after save if exists
        draft = Draft.query.filter_by(user_id=user.id).first()
        if draft:
            db.session.delete(draft)
        db.session.commit()
        return redirect(url_for('main.notes'))

    # GET: show notes, with search and tag filter
    q = request.args.get('q','').strip()
    tag_filter = request.args.get('tag','').strip()

    query = Note.query.filter_by(user_id=user.id)
    if q:
        like = f"%{q}%"
        query = query.filter((Note.title.ilike(like)) | (Note.content.ilike(like)))
    if tag_filter:
        query = query.join(Note.tags).filter(Tag.name == tag_filter)

    # pinned first, then updated_at desc
    notes = query.order_by(Note.pinned.desc(), Note.updated_at.desc()).all()

    # fetch user's draft if any
    draft = Draft.query.filter_by(user_id=user.id).first()
    return render_template('notes.html',
                           notes=notes,
                           username=user.username,
                           human_time=human_time,
                           q=q,
                           draft=draft)

@bp.route('/edit/<int:note_id>', methods=['GET','POST'])
def edit(note_id):
    user = get_user()
    if not user:
        return redirect(url_for('main.login'))
    note = Note.query.filter_by(id=note_id, user_id=user.id).first_or_404()
    if request.method == 'POST':
        note.title = request.form.get('title','').strip() or note.title
        note.content = request.form.get('content','').strip() or note.content
        note.pinned = bool(request.form.get('pinned'))
        tags_raw = request.form.get('tags','').strip()
        tags = []
        if tags_raw:
            for t in [x.strip() for x in tags_raw.split(',') if x.strip()]:
                tag = Tag.query.filter_by(name=t).first()
                if not tag:
                    tag = Tag(name=t)
                tags.append(tag)
        note.tags = tags
        note.updated_at = datetime.utcnow()
        db.session.commit()
        return redirect(url_for('main.notes'))

    return render_template('edit.html', note=note, human_time=human_time)

@bp.route('/delete/<int:note_id>')
def delete(note_id):
    user = get_user()
    if not user:
        return redirect(url_for('main.login'))
    note = Note.query.filter_by(id=note_id, user_id=user.id).first_or_404()
    db.session.delete(note)
    db.session.commit()
    return redirect(url_for('main.notes'))

# ---------- Drafts (auto-save) ----------
@bp.route('/draft', methods=['GET','POST'])
def draft():
    """GET returns user's draft (JSON). POST saves or updates draft."""
    user = get_user()
    if not user:
        return jsonify({"error":"not logged in"}), 401

    if request.method == 'GET':
        d = Draft.query.filter_by(user_id=user.id).first()
        if not d:
            return jsonify({"title":"","content":""})
        return jsonify({"title":d.title or "","content":d.content or ""})

    data = request.json or {}
    title = data.get('title','')
    content = data.get('content','')
    d = Draft.query.filter_by(user_id=user.id).first()
    if not d:
        d = Draft(user_id=user.id, title=title, content=content)
        db.session.add(d)
    else:
        d.title = title
        d.content = content
        d.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok":True})

# ---------- Toggle pin via AJAX ----------
@bp.route('/toggle_pin/<int:note_id>', methods=['POST'])
def toggle_pin(note_id):
    user = get_user()
    if not user:
        return jsonify({"error":"not logged in"}), 401
    note = Note.query.filter_by(id=note_id, user_id=user.id).first_or_404()
    note.pinned = not note.pinned
    note.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"pinned":note.pinned})

# ---------- Export (TXT + PDF fallback) ----------
@bp.route('/export/<format>')
def export(format):
    user = get_user()
    if not user:
        return redirect(url_for('main.login'))

    notes = Note.query.filter_by(user_id=user.id).order_by(Note.pinned.desc(), Note.updated_at.desc()).all()

    if format == 'txt':
        # TXT export
        bio = io.StringIO()
        for n in notes:
            tags = ", ".join(t.name for t in n.tags) if n.tags else "None"
            updated = n.updated_at.strftime('%Y-%m-%d %H:%M') if n.updated_at else "Unknown"
            bio.write(f"Title: {n.title}\nTags: {tags}\nPinned: {'Yes' if n.pinned else 'No'}\nUpdated: {updated}\n")
            bio.write("-"*40 + "\n")
            bio.write(strip_html(n.content) + "\n\n")
        mem = io.BytesIO()
        mem.write(bio.getvalue().encode('utf-8'))
        mem.seek(0)
        return send_file(mem, as_attachment=True, download_name=f"{user.username}_notes.txt", mimetype='text/plain')

    elif format == 'pdf':
     try:
        from flask import make_response
     except ImportError:
        return redirect(url_for('main.export', format='txt'))

     html_content = f"""
     <html>
     <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: sans-serif; }}
            h2 {{ margin-bottom: 0; }}
            p {{ margin-top: 0; }}
            .note {{ margin-bottom: 20px; }}
        </style>
     </head>
     <body>
        <h1>{user.username}'s Notes</h1>
        {"".join(f"<div class='note'><h2>{n.title}</h2><p>{n.content}</p></div>" for n in notes)}
     </body>
     </html>
     """

     mem = io.BytesIO()
     pisa.CreatePDF(io.StringIO(html_content), dest=mem)
     mem.seek(0)
     return send_file(mem, as_attachment=True, download_name=f"{user.username}_notes.pdf", mimetype='application/pdf')

    else:
        return "Unsupported format", 400

@bp.route('/pomodoro')
def pomodoro():
    return render_template('pomodoro.html')

@bp.route('/summarize/<int:note_id>')
def summarize(note_id):
    if 'user_id' not in session:
        return redirect(url_for('main.login'))

    note = Note.query.filter_by(id=note_id, user_id=session['user_id']).first()
    if not note or not note.content.strip():
        return "⚠️ This note is empty or not found — nothing to summarize."
    
    summary = ""

    try:
         summary = summarize_text(note.content)
        
         # Save to database
         existing_summary = Summary.query.filter_by(note_id=note.id).first()
         if existing_summary:
            existing_summary.summary = summary
            existing_summary.title = note.title or "No Title"
         else:
            new_summary = Summary(note_id=note.id, title=note.title or "No Title", summary=summary)
            db.session.add(new_summary)
         db.session.commit()
    except Exception as e:
        summary = f"❌ Error generating summary: {str(e)}"

    return render_template('summary.html', note=note.content, summary=summary)

@bp.route('/summaries')
def summaries():
    if 'user_id' not in session:
        # Redirect to login if not logged in
        return redirect(url_for('main.login'))

    user = get_user()
    if not user:
        return redirect(url_for('main.login'))

    # Fetch summaries **only for this user**
    all_summaries = Summary.query.join(Note).filter(Note.user_id == user.id).all()
    return render_template('summaries.html', summaries=all_summaries)

@bp.route('/summary/<int:summary_id>')
def view_summary(summary_id):
    summary = Summary.query.get_or_404(summary_id)
    return render_template('view_summary.html', summary=summary)
