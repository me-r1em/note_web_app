from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config['SECRET_KEY'] = os.environ.get('NOTE_APP_SECRET', 'change-this-secret')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)

    # simple import after db init
    from . import routes
    app.register_blueprint(routes.bp)

   # Create tables
    with app.app_context():
        db.create_all()

    return app
