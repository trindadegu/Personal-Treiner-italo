document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // CONFIGURAÇÕES E CONSTANTES
    // ========================================
    const SUPABASE_URL = 'https://idwtktaypxsomnqlmjdp.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd3RrdGF5cHhzb21ucWxtamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODQ4NjIsImV4cCI6MjA4MTI2MDg2Mn0.NqqhknttW9VfIb4sr3NkpTRemV3_YohxK093Pjhm8v0';
    const ADMIN_CREDENTIALS = { user: 'italo', password: 'italoruan123' };
    const ADMIN_WHATSAPP = '5585981521490';
    const THEME_KEY = 'preferred_theme';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    function initializeApp() {
        checkExistingSession();
        loadTheme();
        loadStudentsList();
        attachEventListeners();
    }

    function attachEventListeners() {
        document.querySelector('.theme-toggle-login').addEventListener('click', toggleTheme);

        // Abas de Login
        document.querySelectorAll('.login-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchLoginTab(tab.dataset.tab);
            });
        });

        // Formulários de Login
        document.getElementById('adminForm').addEventListener('submit', loginAdmin);
        document.getElementById('studentForm').addEventListener('submit', loginStudent);

        // Botão "Esqueci minha senha"
        document.querySelector('.btn-forgot-password').addEventListener('click', forgotPassword);
    }

    // ========================================
    // FUNÇÕES DA APLICAÇÃO
    // ========================================

    function checkExistingSession() {
        const adminSession = localStorage.getItem('admin_session');
        if (adminSession) {
            try {
                const session = JSON.parse(adminSession);
                if (session.expiresAt > new Date().getTime()) {
                    window.location.href = 'admin.html';
                    return;
                }
            } catch {}
            localStorage.removeItem('admin_session');
        }

        const studentSession = localStorage.getItem('student_session');
        if (studentSession) {
            try {
                const session = JSON.parse(studentSession);
                if (session.expiresAt > new Date().getTime()) {
                    window.location.href = `treino-aluno.html?id=${session.id}`;
                    return;
                }
            } catch {}
            localStorage.removeItem('student_session');
        }
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        setTheme(savedTheme);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('themeIcon').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        document.body.style.background = theme === 'dark' ? 'var(--dark-bg)' : 'var(--gradient-accent)';

        const lightLogo = document.querySelector('.light-logo');
        const darkLogo = document.querySelector('.dark-logo');

        if (theme === 'dark') {
            if (lightLogo) lightLogo.style.display = 'none';
            if (darkLogo) darkLogo.style.display = 'block';
        } else {
            if (lightLogo) lightLogo.style.display = 'block';
            if (darkLogo) darkLogo.style.display = 'none';
        }

        localStorage.setItem(THEME_KEY, theme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    }

    function switchLoginTab(tabName) {
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
        document.querySelector(`.login-tab[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}Form`)?.classList.add('active');
        clearMessages();
    }

    async function loginAdmin(event) {
        event.preventDefault();
        const user = document.getElementById('adminUser').value.trim();
        const password = document.getElementById('adminPassword').value.trim();
        const loginBtn = document.getElementById('adminLoginBtn');

        toggleButtonLoading(loginBtn, true, 'Entrando...');

        try {
            if (user === ADMIN_CREDENTIALS.user && password === ADMIN_CREDENTIALS.password) {
                await supabase.from('admins').upsert({ username: user, password: password }, { onConflict: 'username' });
                createSession('admin_session', { user });
                window.location.href = 'admin.html';
                return;
            }

            const { data, error } = await supabase.from('admins').select('*').eq('username', user).eq('password', password).single();
            if (error || !data) throw new Error('Usuário ou senha incorretos.');

            createSession('admin_session', { user: data.username });
            window.location.href = 'admin.html';
        } catch (error) {
            showMessage('adminError', error.message);
            toggleButtonLoading(loginBtn, false);
        }
    }

    async function loginStudent(event) {
        event.preventDefault();
        const studentId = document.getElementById('studentSelect').value;
        const password = document.getElementById('studentPassword').value.trim();
        const loginBtn = document.getElementById('studentLoginBtn');

        if (!studentId) {
            showMessage('studentError', 'Por favor, selecione seu nome.');
            return;
        }
        toggleButtonLoading(loginBtn, true, 'Entrando...');

        try {
            const { data: student, error } = await supabase.from('alunos').select('id, nome').eq('id', studentId).single();
            if (error || !student) throw new Error('Aluno não encontrado.');

            if (password !== student.id.slice(-6)) {
                throw new Error('Senha incorreta. Use os 6 últimos dígitos do seu ID.');
            }

            createSession('student_session', { id: student.id, name: student.nome });
            window.location.href = `treino-aluno.html?id=${student.id}`;
        } catch (error) {
            showMessage('studentError', error.message);
            toggleButtonLoading(loginBtn, false);
        }
    }

    async function forgotPassword() {
        const studentId = document.getElementById('studentSelect').value;
        if (!studentId) {
            showMessage('studentError', 'Selecione seu nome para podermos te ajudar.');
            return;
        }
        try {
            const { data: student, error } = await supabase.from('alunos').select('id, nome').eq('id', studentId).single();
            if (error || !student) throw new Error();

            const message = `Olá! Sou ${student.nome} e esqueci minha senha. Meu ID é ${student.id}. Pode me ajudar?`;
            window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
            showMessage('studentSuccess', 'Você será redirecionado para o WhatsApp do professor!');
        } catch {
            showMessage('studentError', 'Não foi possível encontrar seu cadastro. Fale com o professor.');
        }
    }

    async function loadStudentsList() {
        const select = document.getElementById('studentSelect');
        try {
            const { data: students, error } = await supabase.from('alunos').select('id, nome').order('nome');
            if (error) throw error;

            select.innerHTML = '<option value="">-- Escolha seu nome --</option>';
            students.forEach(student => {
                select.innerHTML += `<option value="${student.id}">${student.nome}</option>`;
            });
        } catch (error) {
            select.innerHTML = '<option disabled>Erro ao carregar alunos</option>';
        }
    }

    function createSession(key, data) {
        const session = { ...data, expiresAt: new Date().getTime() + (24 * 60 * 60 * 1000) };
        localStorage.setItem(key, JSON.stringify(session));
    }

    function toggleButtonLoading(button, isLoading, loadingText = '') {
        button.disabled = isLoading;
        if (isLoading) {
            button.dataset.originalHtml = button.innerHTML;
            button.innerHTML = `<span class="loading"></span> ${loadingText}`;
        } else {
            button.innerHTML = button.dataset.originalHtml;
        }
    }

    function showMessage(elementId, message) {
        clearMessages();
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.classList.add('active');
    }

    function clearMessages() {
        document.querySelectorAll('.error-message, .success-message').forEach(el => {
            el.classList.remove('active');
            el.textContent = '';
        });
    }

    // Inicia a aplicação
    initializeApp();
});
