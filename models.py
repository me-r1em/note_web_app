from . import db
from datetime import datetime

# association table note <-> tag
note_tags = db.Table(
    'note_tags',
    db.Column('note_id', db.Integer, db.ForeignKey('note.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    # we keep password simple for the demo (string). If you want hashing, we can add Werkzeug hashing.
    password = db.Column(db.String(200), nullable=False)
    notes = db.relationship('Note', backref='user', lazy=True)
    drafts = db.relationship('Draft', backref='user', lazy=True)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    pinned = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    tags = db.relationship('Tag', secondary=note_tags, lazy='subquery',
                           backref=db.backref('notes', lazy=True))

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=False, nullable=False)

class Draft(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    content = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Summary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    note_id = db.Column(db.Integer, db.ForeignKey('note.id'))

