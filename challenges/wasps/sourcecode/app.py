from flask import Flask, render_template, request, redirect, url_for, session, flash, send_file
import psycopg2
import psycopg2.extras
import hashlib
import os

app = Flask(__name__)
app.secret_key = 'wasps_secret_key_2025_utfpr_vespascon'

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'wasps'),
    'user': os.getenv('DB_USER', 'wasps_user'),
    'password': os.getenv('DB_PASSWORD', 'wasps_password'),
    'port': os.getenv('DB_PORT', '5432')
}

def get_db():
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        ra = request.form['ra']
        password = request.form['password']
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT * FROM users WHERE ra = %s AND password = %s', 
                   (ra, hashlib.md5(password.encode()).hexdigest()))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user:
            session['user_id'] = user['id']
            session['ra'] = user['ra']
            session['name'] = user['name']
            session['role'] = user['role']
            
            if user['role'] == 'professor':
                return redirect(url_for('insert_grades'))
            return redirect(url_for('dashboard'))
        
        flash('Credenciais inválidas!', 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        ra = request.form['ra']
        name = request.form['name']
        password = request.form['password']
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute('SELECT * FROM users WHERE ra = %s', (ra,))
        existing = cur.fetchone()
        
        if existing:
            flash('RA já cadastrado!', 'error')
            cur.close()
            conn.close()
            return redirect(url_for('register'))
        
        cur.execute('INSERT INTO users (ra, name, password, role) VALUES (%s, %s, %s, %s)',
                   (ra, name, hashlib.md5(password.encode()).hexdigest(), 'student'))
        conn.commit()
        cur.close()
        conn.close()
        
        flash('Cadastro realizado com sucesso!', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    if session['role'] == 'professor':
        return redirect(url_for('insert_grades'))
    
    subjects = [
        'Algoritmos e Estruturas de Dados',
        'Programação Orientada a Objetos',
        'Banco de Dados',
        'Redes de Computadores',
        'Sistemas Operacionais',
        'Engenharia de Software',
        'Inteligência Artificial',
        'Segurança da Informação'
    ]
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute('SELECT * FROM grades WHERE student_ra = %s', (session['ra'],))
    grades_rows = cur.fetchall()
    cur.close()
    conn.close()
    
    grades_dict = {}
    for grade in grades_rows:
        grades_dict[grade['subject']] = grade['grade']
    
    return render_template('dashboard.html', subjects=subjects, grades_dict=grades_dict)

@app.route('/search_student', methods=['POST'])
def search_student():
    if 'user_id' not in session or session['role'] != 'professor':
        flash('Acesso negado!', 'error')
        return redirect(url_for('login'))
    
    search_results = []
    search_term = request.form.get('search_term', '')
    
    if search_term:
        conn = get_db()
        cur = conn.cursor()
        
        query = f"SELECT * FROM users WHERE (ra LIKE '%{search_term}%' OR name LIKE '%{search_term}%') AND role = 'student'"
        
        try:
            cur.execute(query)
            search_results = cur.fetchall()
        except Exception as e:
            flash(f'Erro na busca: {str(e)}', 'error')
        
        cur.close()
        conn.close()
    
    return render_template('insert_grades.html', search_results=search_results)

@app.route('/insert_grades', methods=['GET', 'POST'])
def insert_grades():
    if 'user_id' not in session or session['role'] != 'professor':
        flash('Acesso negado!', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        student_ra = request.form['student_ra']
        subject = request.form['subject']
        grade = request.form['grade']
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute('SELECT * FROM users WHERE ra = %s AND role = %s', (student_ra, 'student'))
        student = cur.fetchone()
        
        if student:
            cur.execute('INSERT INTO grades (student_ra, subject, grade) VALUES (%s, %s, %s)',
                       (student_ra, subject, grade))
            conn.commit()
            flash('Nota inserida com sucesso!', 'success')
        else:
            flash('Aluno não encontrado!', 'error')
        
        cur.close()
        conn.close()
    
    return render_template('insert_grades.html', search_results=[])

@app.route('/backup.zip')
def download_backup():
    return send_file('backup.zip', as_attachment=True)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
