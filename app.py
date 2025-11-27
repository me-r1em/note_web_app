from flask import Flask, render_template, request, redirect, url_for, session
import sqlite3

app = Flask(__name__)
app.secret_key = "secret_key"  # Change this before deployment

# ---------- DATABASE SETUP ----------
def init_db():
    conn = sqlite3.connect('notes.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT,
                    content TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id))''')
    conn.commit()
    conn.close()

init_db()

# ---------- ROUTES ----------
@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('notes'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = sqlite3.connect('notes.db')
        c = conn.cursor()
        try:
            c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            conn.commit()
            conn.close()
            return redirect(url_for('login'))
        except:
            return "Username already exists"
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = sqlite3.connect('notes.db')
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE username=? AND password=?", (username, password))
        user = c.fetchone()
        conn.close()
        if user:
            session['user_id'] = user[0]
            session['username'] = username
            return redirect(url_for('notes'))
        else:
            return "Invalid username or password"
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/notes', methods=['GET', 'POST'])
def notes():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    conn = sqlite3.connect('notes.db')
    c = conn.cursor()
    user_id = session['user_id']

    # Add a note
    if request.method == 'POST':
        title = request.form['title'].strip()
        content = request.form['content'].strip()
        if title and content:
            c.execute("INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)", (user_id, title, content))
            conn.commit()

    # Handle search
    query = request.args.get('q')
    if query:
        c.execute("SELECT id, title, content FROM notes WHERE user_id=? AND (title LIKE ? OR content LIKE ?)",
                  (user_id, f'%{query}%', f'%{query}%'))
    else:
        c.execute("SELECT id, title, content FROM notes WHERE user_id=?", (user_id,))
    notes = c.fetchall()
    conn.close()
    return render_template('notes.html', notes=notes, username=session['username'], query=query)

@app.route('/delete/<int:note_id>')
def delete(note_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('notes.db')
    c = conn.cursor()
    c.execute("DELETE FROM notes WHERE id=? AND user_id=?", (note_id, session['user_id']))
    conn.commit()
    conn.close()
    return redirect(url_for('notes'))

@app.route('/edit/<int:note_id>', methods=['GET', 'POST'])
def edit(note_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    conn = sqlite3.connect('notes.db')
    c = conn.cursor()

    if request.method == 'POST':
        new_title = request.form['title'].strip()
        new_content = request.form['content'].strip()
        if new_title and new_content:
            c.execute("UPDATE notes SET title=?, content=? WHERE id=? AND user_id=?",
                      (new_title, new_content, note_id, session['user_id']))
            conn.commit()
            conn.close()
            return redirect(url_for('notes'))

    c.execute("SELECT id, title, content FROM notes WHERE id=? AND user_id=?", (note_id, session['user_id']))
    note = c.fetchone()
    conn.close()
    if note is None:
        return "Note not found"
    
    # Convert tuple to dict for easier template usage
    note_dict = {"id": note[0], "title": note[1], "content": note[2]}
    return render_template('edit.html', note=note_dict)

if __name__ == '__main__':
    app.run(debug=True)
