document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================
    const SUPABASE_URL      = 'https://idwtktaypxsomnqlmjdp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd3RrdGF5cHhzb21ucWxtamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODQ4NjIsImV4cCI6MjA4MTI2MDg2Mn0.NqqhknttW9VfIb4sr3NkpTRemV3_YohxK093Pjhm8v0';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const THEME_KEY = 'appTheme';
    let currentStudentId      = null;
    let currentDay            = 'segunda';
    let currentDefaultTraining= null;
    let adminMap              = null;   // instância Leaflet do mapa admin
    let mapMarkers            = [];     // marcadores no mapa
    let allCheckins           = [];     // cache dos check-ins carregados

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    async function initializeApp() {
        await checkAdminLogin();
        loadTheme();
        setupEventListeners();
        await loadInitialData();
        switchTab('dashboard');
    }

    async function loadInitialData() {
        try {
            await Promise.all([
                loadStudents(),
                loadStudentsForSelect('studentToEditTraining'),
                loadStudentsForSelect('studentProgressSelect'),
                loadAdminCredentials(),
                initializeDefaultTrainingsTab()
            ]);
            await loadProgressOverview();
        } catch (err) { console.error('Erro ao carregar dados iniciais:', err); }
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    function setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const actions = {
                'toggle-theme':               toggleTheme,
                'toggle-sidebar':             toggleSidebar,
                'logout':                     logoutAdmin,
                'open-add-student-modal':     openAddStudentModal,
                'add-exercise-row':           () => addExerciseRow('exercisesTableBody'),
                'save-student-training':      saveStudentTraining,
                'add-default-exercise-row':   () => addExerciseRow('defaultExercisesTableBody'),
                'save-default-training':      saveDefaultTraining,
                'load-predefined-training':   loadPredefinedTraining,
                'apply-default-to-all':       applyDefaultTrainingToAll,
                'apply-default-to-specific':  applyDefaultTrainingToSpecificStudent,
                'save-admin-settings':        saveAdminSettings,
                'export-data':                exportData,
                'clear-all-data':             clearAllData,
                'close-modal':                () => closeModal(target.dataset.modalId),
                'remove-exercise-row':        () => removeExerciseRow(target),
                'delete-student':             () => deleteStudentHandler(target.dataset.studentId),
                // Check-ins
                'clear-checkins':             clearCheckins,
                'export-checkins':            exportCheckinsCsv,
            };
            if (actions[action]) actions[action]();
        });

        document.querySelectorAll('.nav-item[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        document.getElementById('studentToEditTraining').addEventListener('change', (e) => loadStudentTraining(e.target.value));
        document.getElementById('studentProgressSelect').addEventListener('change',  (e) => loadStudentProgress(e.target.value));
        document.getElementById('studentFormModal').addEventListener('submit', saveNewStudent);

        // Filtro de check-ins por aluno
        document.getElementById('checkinStudentFilter').addEventListener('change', (e) => {
            renderCheckinTable(allCheckins, e.target.value);
        });
    }

    // ============================================================
    // SESSÃO E TEMA
    // ============================================================
    async function checkAdminLogin() {
        const sessionData = localStorage.getItem('admin_session');
        if (!sessionData) { window.location.href = 'login.html'; return; }
        try {
            const session = JSON.parse(sessionData);
            if (session.expiresAt < Date.now()) logoutAdmin();
        } catch { logoutAdmin(); }
    }

    function logoutAdmin() { localStorage.removeItem('admin_session'); window.location.href = 'login.html'; }

    function loadTheme() { setTheme(localStorage.getItem(THEME_KEY) || 'light'); }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('themeIcon').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem(THEME_KEY, theme);
    }

    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(cur === 'light' ? 'dark' : 'light');
    }

    // ============================================================
    // NAVEGAÇÃO
    // ============================================================
    function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('active'); }

    async function switchTab(tabName) {
        document.querySelectorAll('.tab-content.active, .nav-item.active').forEach(el => el.classList.remove('active'));
        document.getElementById(tabName)?.classList.add('active');
        document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');
        if (window.innerWidth <= 768) toggleSidebar();

        if (tabName === 'dashboard') {
            const students = await getStudents();
            document.getElementById('totalStudents').textContent = students.length;
        } else if (tabName === 'progress') {
            await loadProgressOverview();
        } else if (tabName === 'students') {
            await loadStudents();
        } else if (tabName === 'default-trainings') {
            await initializeDefaultTrainingsTab();
        } else if (tabName === 'checkins') {
            await loadCheckinsTab();
        }
    }

    // ============================================================
    // GERENCIAMENTO DE ALUNOS
    // ============================================================
    async function getStudents() {
        try {
            const { data, error } = await supabase.from('alunos').select('*').order('nome');
            if (error) throw error;
            return data || [];
        } catch (err) { showToast('Erro ao carregar alunos: ' + err.message, 'error'); return []; }
    }

    async function loadStudents() {
        const students = await getStudents();
        const grid = document.getElementById('studentsGrid');
        grid.innerHTML = '';
        if (!students.length) {
            grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:var(--gray-text);">Nenhum aluno cadastrado.</p>';
            return;
        }
        students.forEach(s => {
            grid.innerHTML += `
                <div class="student-card">
                    <div class="student-avatar">${s.nome.charAt(0).toUpperCase()}</div>
                    <h4>${s.nome}</h4>
                    <p>ID: ${s.id}</p>
                    <p style="font-size:.9rem;color:var(--secondary-color);margin-bottom:1rem;">Senha: ${s.id.slice(-6)}</p>
                    <div class="student-actions">
                        <button class="btn btn-danger btn-action" data-action="delete-student" data-student-id="${s.id}">
                            <i class="fas fa-trash-alt"></i> Excluir
                        </button>
                    </div>
                </div>`;
        });
        document.getElementById('totalStudents').textContent = students.length;
        await loadStudentsForSelect('studentToEditTraining');
        await loadStudentsForSelect('studentProgressSelect');
        await populateCheckinStudentFilter();
    }

    async function loadStudentsForSelect(selectId) {
        const students = await getStudents();
        const select = document.getElementById(selectId);
        const cur = select.value;
        select.innerHTML = `<option value="">-- Selecione --</option>`;
        students.forEach(s => { select.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
        if (cur && students.some(s => s.id === cur)) select.value = cur;
    }

    async function populateCheckinStudentFilter() {
        const students = await getStudents();
        const sel = document.getElementById('checkinStudentFilter');
        sel.innerHTML = '<option value="">— Todos os alunos —</option>';
        students.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
    }

    async function saveNewStudent(e) {
        e.preventDefault();
        const name = document.getElementById('studentNameModal').value.trim();
        if (!name) { showToast('Digite o nome do aluno.', 'error'); return; }
        try {
            const newId = 'aluno_' + Date.now();
            await supabase.from('alunos').insert([{ id: newId, nome: name, created_at: new Date().toISOString() }]);
            await saveTraining(newId, initializeEmptyTraining());
            await loadStudents();
            closeModal('studentModal');
            showToast(`Aluno adicionado! Senha: ${newId.slice(-6)}`, 'success');
        } catch (err) { showToast('Erro ao adicionar aluno: ' + err.message, 'error'); }
    }

    async function deleteStudentHandler(id) {
        if (!confirm('Excluir este aluno e todos os seus dados?')) return;
        try {
            await supabase.from('progresso').delete().eq('aluno_id', id);
            await supabase.from('treinos').delete().eq('aluno_id', id);
            await supabase.from('checkins').delete().eq('aluno_id', id);
            await supabase.from('alunos').delete().eq('id', id);
            await loadStudents();
            showToast('Aluno excluído com sucesso!', 'success');
        } catch (err) { showToast('Erro ao excluir aluno: ' + err.message, 'error'); }
    }

    // ============================================================
    // TREINOS
    // ============================================================
    function initializeEmptyTraining() {
        const days = ['segunda','terca','quarta','quinta','sexta'];
        return Object.fromEntries(days.map(d => [d, { focus: 'Nenhum foco definido', exercises: [] }]));
    }

    async function getTraining(alunoId) {
        try {
            const { data, error } = await supabase.from('treinos').select('*').eq('aluno_id', alunoId).single();
            if (error) { if (error.code === 'PGRST116') return initializeEmptyTraining(); throw error; }
            return data.treino || initializeEmptyTraining();
        } catch { return initializeEmptyTraining(); }
    }

    async function saveTraining(alunoId, treino) {
        const { data, error } = await supabase.from('treinos').upsert([{ aluno_id: alunoId, treino, updated_at: new Date().toISOString() }], { onConflict: 'aluno_id' });
        if (error) throw error;
        return data;
    }

    async function loadStudentTraining(studentId) {
        currentStudentId = studentId;
        const editor = document.getElementById('trainingEditorContainer');
        editor.style.display = studentId ? 'block' : 'none';
        if (studentId) { setupDaysTabs('daysTabs', selectDayToEdit); await selectDayToEdit('segunda'); }
    }

    async function selectDayToEdit(day) {
        currentDay = day;
        document.querySelectorAll('#daysTabs .day-tab').forEach(b => b.classList.remove('active'));
        document.querySelector(`#daysTabs [data-day="${day}"]`)?.classList.add('active');
        document.getElementById('currentDayTitle').textContent = `Treino de ${cap(day)}`;
        if (!currentStudentId) return;
        const training = await getTraining(currentStudentId);
        const dt = training[day] || { focus: '', exercises: [] };
        document.getElementById('focusArea').value = dt.focus;
        loadExercisesToTable('exercisesTableBody', dt.exercises);
    }

    function setupDaysTabs(containerId, handler) {
        const days = ['segunda','terca','quarta','quinta','sexta'];
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        days.forEach(day => {
            const btn = document.createElement('button');
            btn.className = 'day-tab'; btn.dataset.day = day;
            btn.textContent = cap(day);
            btn.addEventListener('click', () => handler(day));
            container.appendChild(btn);
        });
    }

    async function saveStudentTraining() {
        if (!currentStudentId) { showToast('Selecione um aluno primeiro', 'error'); return; }
        try {
            const current = await getTraining(currentStudentId);
            current[currentDay] = { focus: document.getElementById('focusArea').value.trim(), exercises: getExercisesFromTable('exercisesTableBody') };
            await saveTraining(currentStudentId, current);
            showToast(`Treino de ${currentDay} salvo!`, 'success');
        } catch (err) { showToast('Erro ao salvar treino: ' + err.message, 'error'); }
    }

    function addExerciseRow(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        const id = Date.now() + Math.random().toString(36).substr(2,9);
        const row = document.createElement('tr');
        row.className = 'exercise-row';
        row.innerHTML = `
            <td><input type="text" class="exercise-name"   id="en_${id}" name="en_${id}" placeholder="Ex: Supino reto" required autocomplete="off"></td>
            <td><input type="text" class="exercise-series" id="es_${id}" name="es_${id}" placeholder="4"              required autocomplete="off"></td>
            <td><input type="text" class="exercise-reps"   id="er_${id}" name="er_${id}" placeholder="20-15-12-10"    required autocomplete="off"></td>
            <td><input type="text" class="exercise-video"  id="ev_${id}" name="ev_${id}" placeholder="https://youtube.com/..." autocomplete="off"></td>
            <td><button type="button" class="btn-remove-exercise" data-action="remove-exercise-row"><i class="fas fa-trash-alt"></i></button></td>`;
        tbody.appendChild(row);
    }

    function removeExerciseRow(btn) { btn.closest('tr').remove(); }

    function loadExercisesToTable(tbodyId, exercises) {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        if (exercises?.length) {
            exercises.forEach((ex, i) => {
                const id = `ex_${i}_${Date.now()}`;
                const row = document.createElement('tr');
                row.className = 'exercise-row';
                row.innerHTML = `
                    <td><input type="text" class="exercise-name"   id="${id}_n" name="${id}_n" value="${ex.name||''}"   placeholder="Exercício" required autocomplete="off"></td>
                    <td><input type="text" class="exercise-series" id="${id}_s" name="${id}_s" value="${ex.series||''}" placeholder="4"         required autocomplete="off"></td>
                    <td><input type="text" class="exercise-reps"   id="${id}_r" name="${id}_r" value="${ex.reps||''}"   placeholder="10"        required autocomplete="off"></td>
                    <td><input type="text" class="exercise-video"  id="${id}_v" name="${id}_v" value="${ex.video||''}"  placeholder="https://..." autocomplete="off"></td>
                    <td><button type="button" class="btn-remove-exercise" data-action="remove-exercise-row"><i class="fas fa-trash-alt"></i></button></td>`;
                tbody.appendChild(row);
            });
        } else { addExerciseRow(tbodyId); }
    }

    function getExercisesFromTable(tbodyId) {
        return [...document.querySelectorAll(`#${tbodyId} .exercise-row`)]
            .map(row => ({
                name:   row.querySelector('.exercise-name').value.trim(),
                series: row.querySelector('.exercise-series').value.trim(),
                reps:   row.querySelector('.exercise-reps').value.trim(),
                video:  row.querySelector('.exercise-video').value.trim()
            }))
            .filter(ex => ex.name && ex.series && ex.reps);
    }

    // ============================================================
    // TREINOS PADRÃO
    // ============================================================
    async function initializeDefaultTrainingsTab() { setupDaysTabs('defaultDaysTabs', selectDefaultDayToEdit); await loadDefaultTraining(); }

    async function getDefaultTraining() {
        try {
            const { data, error } = await supabase.from('treinos_padroes').select('*').single();
            if (error) { if (error.code === 'PGRST116') return initializeDefaultTrainings(); throw error; }
            return data.treino || initializeDefaultTrainings();
        } catch { return initializeDefaultTrainings(); }
    }

    function initializeDefaultTrainings() {
        return {
            segunda:{ focus:'PEITO + TRÍCEPS + OMBRO', exercises:[
                {name:'Supino reto com halteres',series:'4',reps:'20-15-12-10',video:''},
                {name:'Supino inclinado com halteres',series:'4',reps:'10',video:''},
                {name:'Crucifixo no banco inclinado',series:'4',reps:'10',video:''},
                {name:'Crucifixo polia',series:'4',reps:'10',video:''},
                {name:'Elevação lateral com halteres',series:'4',reps:'10',video:''},
                {name:'Remada alta com barra',series:'4',reps:'10',video:''},
                {name:'Elevação frontal com corda na polia',series:'3',reps:'15',video:''},
                {name:'Tríceps na polia',series:'4',reps:'10',video:''},
                {name:'Tríceps patada',series:'4',reps:'15',video:''}]},
            terca:{ focus:'PERNAS - QUADRÍCEPS', exercises:[
                {name:'Agachamento sumô (mobilidade)',series:'2',reps:'20 segundos',video:''},
                {name:'Mobilidade de tornozelo e quadril',series:'2',reps:'10/lado',video:''},
                {name:'Cadeira extensora',series:'4',reps:'20',video:''},
                {name:'Agachamento livre com barra',series:'4',reps:'10',video:''},
                {name:'Leg press 45',series:'4',reps:'10',video:''},
                {name:'Agachamento afundo com halteres',series:'4',reps:'10',video:''},
                {name:'Cadeira flexora',series:'4',reps:'20-15-12-10',video:''},
                {name:'Cadeira adutora',series:'3',reps:'20',video:''},
                {name:'Panturrilha máquina',series:'3',reps:'15',video:''}]},
            quarta:{ focus:'COSTAS + POST. OMBRO, BÍCEPS', exercises:[
                {name:'Puxada pela fren. com pegada aberta',series:'4',reps:'20-15-12-10',video:''},
                {name:'Puxada pela fren. com pegada supinada',series:'3',reps:'10',video:''},
                {name:'Remada curvada com barra',series:'4',reps:'10',video:''},
                {name:'Remada curvada com halteres',series:'3',reps:'10',video:''},
                {name:'Pulldown polia alta',series:'3',reps:'10',video:''},
                {name:'Remada baixa na polia (use a barra)',series:'3',reps:'10',video:''},
                {name:'Encolhimento de ombro',series:'3',reps:'10',video:''},
                {name:'Rosca direta com barra',series:'4',reps:'10',video:''},
                {name:'Rosca Scott com barra W',series:'4',reps:'10',video:''}]},
            quinta:{ focus:'PERNAS GLÚTEOS', exercises:[
                {name:'Agachamento sumô (mobilidade)',series:'2',reps:'20 segundos',video:''},
                {name:'Mobilidade de tornozelo e quadril',series:'2',reps:'10/lado',video:''},
                {name:'Cadeira adutora',series:'3',reps:'20',video:''},
                {name:'Levantamento terra com barra',series:'4',reps:'10',video:''},
                {name:'Mesa flexora bilateral',series:'3',reps:'10',video:''},
                {name:'Elevação pélvica',series:'4',reps:'10',video:''},
                {name:'Cadeira flexora',series:'4',reps:'20-15-12-10',video:''},
                {name:'Stiff joelho flexionado com halteres',series:'4',reps:'10',video:''},
                {name:'Cadeira extensoura',series:'4',reps:'20',video:''}]},
            sexta:{ focus:'OMBRO COMPLETO', exercises:[
                {name:'Desenvolvimento máquina',series:'4',reps:'10',video:''},
                {name:'Desenvolvimento Arnold',series:'4',reps:'10',video:''},
                {name:'Elevação lateral sentado/rest-pause',series:'4',reps:'10',video:''},
                {name:'Voador inversor com pegada pronada',series:'4',reps:'10',video:''},
                {name:'Elevação frontal com corda na polia (drop-set)',series:'4',reps:'10',video:''},
                {name:'Remada com corda na polia alta',series:'4',reps:'10',video:''},
                {name:'Encolhimento de ombro',series:'4',reps:'10',video:''}]}
        };
    }

    async function selectDefaultDayToEdit(day) {
        currentDay = day;
        document.querySelectorAll('#defaultDaysTabs .day-tab').forEach(b => b.classList.remove('active'));
        document.querySelector(`#defaultDaysTabs [data-day="${day}"]`)?.classList.add('active');
        document.getElementById('defaultCurrentDayTitle').textContent = 'Treino Padrão - ' + cap(day);
        await loadDefaultTraining();
    }

    async function loadDefaultTraining() {
        try {
            currentDefaultTraining = await getDefaultTraining();
            const dt = currentDefaultTraining[currentDay];
            if (!dt) { currentDefaultTraining[currentDay] = { focus:'', exercises:[] }; await saveDefaultTrainingToDB(currentDefaultTraining); await loadDefaultTraining(); return; }
            document.getElementById('defaultFocusArea').value = dt.focus || '';
            loadExercisesToTable('defaultExercisesTableBody', dt.exercises || []);
        } catch (err) { showToast('Erro ao carregar treino padrão: ' + err.message, 'error'); }
    }

    async function saveDefaultTraining() {
        try {
            if (!currentDefaultTraining) currentDefaultTraining = {};
            currentDefaultTraining[currentDay] = { focus: document.getElementById('defaultFocusArea').value.trim(), exercises: getExercisesFromTable('defaultExercisesTableBody') };
            await saveDefaultTrainingToDB(currentDefaultTraining);
            showToast(`Treino padrão de ${currentDay} salvo!`, 'success');
        } catch (err) { showToast('Erro ao salvar treino padrão: ' + err.message, 'error'); }
    }

    async function saveDefaultTrainingToDB(treino) {
        const { error } = await supabase.from('treinos_padroes').upsert([{ treino, updated_at: new Date().toISOString() }]);
        if (error) throw error;
    }

    async function loadPredefinedTraining() {
        if (!confirm('Carregar treino pré-definido? Isso substituirá o treino atual deste dia.')) return;
        try {
            const dt = initializeDefaultTrainings(); currentDefaultTraining = dt;
            await saveDefaultTrainingToDB(dt); await loadDefaultTraining();
            showToast('Treino pré-definido carregado!', 'success');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    }

    async function applyDefaultTrainingToAll() {
        if (!confirm('Aplicar treino padrão a TODOS os alunos?')) return;
        try {
            const [dt, students] = await Promise.all([getDefaultTraining(), getStudents()]);
            for (const s of students) await saveTraining(s.id, dt);
            showToast(`Aplicado a ${students.length} aluno(s)!`, 'success');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    }

    async function applyDefaultTrainingToSpecificStudent() {
        try {
            const students = await getStudents();
            if (!students.length) { showToast('Nenhum aluno cadastrado!', 'error'); return; }
            const content = `
                <div class="modal-header"><h2>Aplicar a Aluno Específico</h2><button class="modal-close" data-action="close-modal" data-modal-id="specificStudentModal">&times;</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Selecione o aluno:</label><select id="specificStudentSelect" class="form-input">${students.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}</select></div>
                    <div class="form-group"><label><input type="checkbox" id="replaceExisting" checked> Substituir treino atual</label></div>
                    <button class="btn btn-primary" id="confirmApplyBtn"><i class="fas fa-user-check"></i> Aplicar Treino</button>
                </div>`;
            let modal = document.getElementById('specificStudentModal');
            if (!modal) { modal = document.createElement('div'); modal.id='specificStudentModal'; modal.className='modal'; modal.innerHTML=`<div class="modal-content">${content}</div>`; document.body.appendChild(modal); }
            else { modal.querySelector('.modal-content').innerHTML = content; }
            modal.querySelector('#confirmApplyBtn').addEventListener('click', confirmApplyToSpecificStudent);
            openModal('specificStudentModal');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    }

    async function confirmApplyToSpecificStudent() {
        try {
            const studentId = document.getElementById('specificStudentSelect').value;
            const replace   = document.getElementById('replaceExisting').checked;
            const dt        = await getDefaultTraining();
            if (!studentId) { showToast('Selecione um aluno!', 'error'); return; }
            const cur    = replace ? {} : await getTraining(studentId);
            const final  = replace ? dt : { ...cur, ...dt };
            await saveTraining(studentId, final);
            closeModal('specificStudentModal');
            showToast('Treino aplicado ao aluno!', 'success');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    }

    // ============================================================
    // PROGRESSO
    // ============================================================
    async function loadStudentProgress(studentId) { await loadProgressOverview(studentId); }

    async function getProgress(alunoId=null) {
        try {
            let q = supabase.from('progresso').select('*');
            if (alunoId) q = q.eq('aluno_id', alunoId);
            const { data, error } = await q;
            if (error) { if (error.code==='PGRST116') return alunoId ? {} : {}; throw error; }
            const map = {};
            data.forEach(item => { map[item.aluno_id] = item.progresso || {}; });
            return alunoId ? (map[alunoId]||{}) : map;
        } catch { return alunoId ? {} : {}; }
    }

    async function loadProgressOverview(selectedStudentId=null) {
        try {
            const students = await getStudents();
            const grid = document.getElementById('progressGrid');
            grid.innerHTML = '';
            if (!students.length) { grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:var(--gray-text);">Nenhum aluno cadastrado.</p>'; return; }
            const list = selectedStudentId ? students.filter(s => s.id === selectedStudentId) : students;
            if (!list.length) { grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:var(--gray-text);">Nenhum aluno selecionado.</p>'; return; }
            for (const s of list) {
                const trainings = await getTraining(s.id);
                const progress  = await getProgress(s.id);
                let total=0, done=0, byDay={};
                Object.keys(trainings).forEach(day => {
                    const dt = trainings[day]; const dp = progress[day]||[];
                    if (dt?.exercises) { total+=dt.exercises.length; done+=dp.length;
                        byDay[day]={ total:dt.exercises.length, completed:dp.length, exercises:dt.exercises.map((ex,i)=>({...ex,completed:dp.includes(i)})) }; }
                });
                const pct = total>0 ? Math.round((done/total)*100) : 0;
                const card = document.createElement('div');
                card.className='progress-card';
                card.innerHTML=`
                    <h4>${s.nome}</h4>
                    <div class="progress-stats">
                        <div class="stat-item"><div class="stat-value">${pct}%</div><div class="stat-label">Concluído</div></div>
                        <div class="stat-item"><div class="stat-value">${done}</div><div class="stat-label">de ${total}</div></div>
                    </div>
                    <div class="progress-details">
                        ${Object.keys(byDay).map(day=>`
                            <div style="margin-bottom:1rem;">
                                <strong>${cap(day)}</strong>
                                <div style="font-size:.8rem;margin-top:.5rem;">
                                    ${byDay[day].exercises.map(ex=>`
                                        <div class="progress-item">
                                            <span class="${ex.completed?'completed-exercise':'pending-exercise'}">${ex.completed?'✅':'⭕'} ${ex.name}</span>
                                            <span>${ex.series}x${ex.reps}</span>
                                        </div>`).join('')}
                                </div>
                            </div>`).join('')}
                    </div>`;
                grid.appendChild(card);
            }
        } catch (err) { showToast('Erro ao carregar progresso: ' + err.message, 'error'); }
    }

    // ============================================================
    // ✅ CHECK-INS — aba do admin
    // ============================================================
    async function loadCheckinsTab() {
        try {
            await populateCheckinStudentFilter();
            const { data, error } = await supabase
                .from('checkins')
                .select('*')
                .order('created_at', { ascending: false });

            allCheckins = error ? [] : (data || []);

            updateCheckinStats(allCheckins);
            renderCheckinTable(allCheckins, '');
            renderCheckinMap(allCheckins);
        } catch (err) {
            showToast('Erro ao carregar check-ins: ' + err.message, 'error');
        }
    }

    function updateCheckinStats(checkins) {
        document.getElementById('statTotalCheckins').textContent = checkins.length;

        const uniqueStudents = new Set(checkins.map(c => c.aluno_id)).size;
        document.getElementById('statActiveStudents').textContent = uniqueStudents;

        // Academia mais visitada
        const gymCount = {};
        checkins.forEach(c => { gymCount[c.gym_name] = (gymCount[c.gym_name]||0)+1; });
        const topGym = Object.entries(gymCount).sort((a,b) => b[1]-a[1])[0];
        document.getElementById('statTopGym').textContent = topGym ? `${topGym[0]} (${topGym[1]}x)` : '—';

        // Último check-in
        if (checkins.length) {
            const last = new Date(checkins[0].created_at);
            document.getElementById('statLastCheckin').textContent =
                last.toLocaleDateString('pt-BR') + ' ' + last.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        } else {
            document.getElementById('statLastCheckin').textContent = '—';
        }
    }

    function renderCheckinTable(checkins, filterStudentId) {
        const tbody = document.getElementById('checkinTableBody');
        const filtered = filterStudentId ? checkins.filter(c => c.aluno_id === filterStudentId) : checkins;

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="checkin-empty"><i class="fas fa-map-marked-alt"></i><p>Nenhum check-in registrado ainda.</p></td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const dt  = new Date(c.created_at);
            const dtf = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
            const dist= c.distance_m < 1000 ? `${c.distance_m} m` : `${(c.distance_m/1000).toFixed(1)} km`;
            return `
                <tr>
                    <td><strong>${c.aluno_nome || '—'}</strong></td>
                    <td><i class="fas fa-dumbbell" style="color:var(--primary-color);margin-right:.4rem;"></i>${c.gym_name || '—'}</td>
                    <td style="font-size:.85rem;color:var(--gray-text);">${c.gym_address || '—'}</td>
                    <td><span class="checkin-dist-badge">${dist}</span></td>
                    <td style="font-size:.85rem;">${dtf}</td>
                </tr>`;
        }).join('');
    }

    function renderCheckinMap(checkins) {
        const mapDiv = document.getElementById('adminMap');

        // Destrói mapa anterior
        if (adminMap) { adminMap.remove(); adminMap = null; mapMarkers = []; }

        // Centro padrão: Fortaleza-CE (área do usuário)
        const defaultCenter = [-3.7172, -38.5433];
        adminMap = L.map('adminMap').setView(defaultCenter, 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        }).addTo(adminMap);

        if (!checkins.length) return;

        const bounds = [];

        checkins.forEach(c => {
            if (!c.lat_aluno || !c.lng_aluno) return;

            // Marcador aluno (azul)
            const iconAluno = L.divIcon({
                className: '',
                html: `<div style="position:relative;">
                    <div style="width:14px;height:14px;background:#1e40af;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>
                    <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1e40af;color:#fff;font-size:10px;padding:2px 5px;border-radius:4px;">${c.aluno_nome||''}</div>
                </div>`,
                iconSize:[14,14], iconAnchor:[7,7]
            });

            const dt  = new Date(c.created_at);
            const dtf = dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

            L.marker([c.lat_aluno, c.lng_aluno], { icon: iconAluno })
             .addTo(adminMap)
             .bindPopup(`<strong>${c.aluno_nome}</strong><br>📍 ${c.gym_name}<br>🕐 ${dtf}`);

            bounds.push([c.lat_aluno, c.lng_aluno]);

            // Marcador academia (vermelho)
            if (c.lat_gym && c.lng_gym) {
                const iconGym = L.divIcon({
                    className: '',
                    html: `<div style="width:18px;height:18px;background:#dc2626;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:9px;color:white;">🏋</div>`,
                    iconSize:[18,18], iconAnchor:[9,9]
                });
                L.marker([c.lat_gym, c.lng_gym], { icon: iconGym })
                 .addTo(adminMap)
                 .bindPopup(`<strong>${c.gym_name}</strong><br>${c.gym_address||''}`);
                bounds.push([c.lat_gym, c.lng_gym]);
            }
        });

        if (bounds.length) adminMap.fitBounds(bounds, { padding: [40, 40] });
    }

    async function clearCheckins() {
        if (!confirm('Limpar TODO o histórico de check-ins? Essa ação é irreversível.')) return;
        try {
            await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            allCheckins = [];
            updateCheckinStats([]);
            renderCheckinTable([], '');
            renderCheckinMap([]);
            showToast('Histórico de check-ins limpo!', 'success');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    }

    function exportCheckinsCsv() {
        if (!allCheckins.length) { showToast('Nenhum check-in para exportar.', 'error'); return; }
        const header = ['Aluno','Academia','Endereço','Distância (m)','Data/Hora'];
        const rows = allCheckins.map(c => [
            c.aluno_nome || '',
            c.gym_name   || '',
            (c.gym_address || '').replace(/,/g,' '),
            c.distance_m || '',
            new Date(c.created_at).toLocaleString('pt-BR')
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `checkins_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('CSV exportado!', 'success');
    }

    // ============================================================
    // CONFIGURAÇÕES / DADOS
    // ============================================================
    async function loadAdminCredentials() {
        try {
            const { data, error } = await supabase.from('admins').select('*').eq('username','italo').single();
            document.getElementById('adminUserSetting').value = (!error && data) ? data.username : 'italo';
        } catch { document.getElementById('adminUserSetting').value = 'italo'; }
    }

    async function saveAdminSettings() {
        const pwd = document.getElementById('adminPasswordSetting').value.trim();
        if (!pwd) { showToast('Digite uma nova senha.', 'error'); return; }
        try {
            await supabase.from('admins').upsert([{ username:'italo', password:pwd, updated_at:new Date().toISOString() }]);
            showToast('Senha alterada com sucesso!', 'success');
            document.getElementById('adminPasswordSetting').value = '';
        } catch (err) { showToast('Erro ao salvar: ' + err.message, 'error'); }
    }

    async function exportData() {
        try {
            const [students, dt, prog] = await Promise.all([getStudents(), getDefaultTraining(), getProgress()]);
            const trainings = {};
            for (const s of students) trainings[s.id] = await getTraining(s.id);
            const data = { students, trainings, progress: prog, defaultTraining: dt, exportDate: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href=url; a.download=`backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            showToast('Dados exportados!', 'success');
        } catch (err) { showToast('Erro ao exportar: ' + err.message, 'error'); }
    }

    async function clearAllData() {
        if (!confirm('ATENÇÃO: Limpar TODOS os dados? Esta ação é irreversível.')) return;
        try {
            await supabase.from('progresso').delete().neq('id','00000000-0000-0000-0000-000000000000');
            await supabase.from('treinos').delete().neq('id','00000000-0000-0000-0000-000000000000');
            await supabase.from('alunos').delete().neq('id','00000000-0000-0000-0000-000000000000');
            await supabase.from('treinos_padroes').delete().neq('id','00000000-0000-0000-0000-000000000000');
            await supabase.from('checkins').delete().neq('id','00000000-0000-0000-0000-000000000000');
            await loadStudents();
            switchTab('dashboard');
            showToast('Todos os dados foram limpos!', 'success');
        } catch (err) { showToast('Erro ao limpar: ' + err.message, 'error'); }
    }

    // ============================================================
    // UTILITÁRIOS
    // ============================================================
    function openModal(id) { const m=document.getElementById(id); if(m){m.classList.add('active');document.body.style.overflow='hidden';} }
    function closeModal(id) { const m=document.getElementById(id); if(m){m.classList.remove('active');document.body.style.overflow='auto';} }
    function openAddStudentModal() {
        document.getElementById('studentModalTitle').textContent  = 'Adicionar Novo Aluno';
        document.getElementById('studentIdModal').value           = '';
        document.getElementById('studentNameModal').value         = '';
        document.getElementById('studentModalSubmit').textContent = 'Salvar Aluno';
        openModal('studentModal');
    }
    function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

    function showToast(message, type='success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(),300); }, 5000);
    }

    initializeApp();
});