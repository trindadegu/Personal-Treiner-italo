// ========================================
// CONFIGURAÇÕES INICIAIS
// ========================================

const STORAGE_KEY = 'italoRuanTrainings';
const STUDENTS_KEY = 'italoRuanStudents';

// Dados padrão
const defaultTrainings = {
    segunda: {
        focus: 'Peito + Tríceps + Ombro',
        exercises: [
            'Supino reto com halteres: 4x20-15-12-10',
            'Supino inclinado com halteres: 4x10',
            'Crucifixo no banco inclinado: 4x10',
            'Crucifixo polia: 4x10',
            'Elevação lateral com halteres: 4x10',
            'Remada alta com barra: 4x10',
            'Elevação frontal com corda na polia: 3x15',
            'Tríceps na polia: 4x10',
            'Tríceps patada: 4x15'
        ]
    },
    terca: {
        focus: 'Perna - Quadríceps',
        exercises: [
            'Agachamento sumô (mobilidade): 2x20 segundos',
            'Mobilidade de tornozelo e quadril: 2x10/lado',
            'Cadeira extensora: 4x20',
            'Agachamento livre com barra: 4x10',
            'Leg press 45: 4x10',
            'Agachamento afundo com halteres: 4x10',
            'Cadeira flexora: 4x20-15-12-10',
            'Cadeira adutora: 3x20',
            'Panturinha máquina: 3x15'
        ]
    },
    quarta: {
        focus: 'Costas + Posteriores + Ombro + Bíceps',
        exercises: [
            'Puxada pela frente com pegada aberta: 4x20-15-12-10',
            'Puxada pela frente com pegada supinada: 3x10',
            'Remada curvada com barra: 4x10',
            'Remada curvada com halteres: 3x10',
            'Pulldown polia alta: 3x10',
            'Remada baixa na polia (use a barra): 3x10',
            'Encolhimento de ombro: 3x10',
            'Rosca direta com barra: 4x10',
            'Rosca scott com barra W: 4x10'
        ]
    },
    quinta: {
        focus: 'Pernas',
        exercises: [
            'Agachamento sumô (mobilidade): 2x20 segundos',
            'Mobilidade de tornozelo e quadril: 2x10/lado',
            'Cadeira abdutora: 3x20',
            'Levantamento terra com barra: 4x10',
            'Mesa flexora bilateral: 3x10',
            'Elevação pélvica: 4x10',
            'Cadeira flexora: 4x20-15-12-10',
            'Stiff joelho flexionado com halteres: 4x10',
            'Cadeira extensora: 4x20'
        ]
    },
    sexta: {
        focus: 'Glúteos + Costas',
        exercises: [
            'Desenvolvimento máquina: 4x10',
            'Desenvolvimento arnold: 4x10',
            'Elevação lateral sentado (rest-pause): 4x10',
            'Voador inverso com pegada pronada (rest-pause): 4x10',
            'Elevação frontal com corda na polia (drop-set): 4x10',
            'Remada com corda na polia alta: 4x10',
            'Encolhimento de ombro: 4x10'
        ]
    }
};

let currentDay = 'segunda';
let currentStudent = 'self';
let editingStudentId = null;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeData();
    loadMyTrainings();
    loadStudents();
    populateStudentSelector();
});

// ========================================
// GERENCIAMENTO DE DADOS
// ========================================

function initializeData() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            self: defaultTrainings
        }));
    }
    
    if (!localStorage.getItem(STUDENTS_KEY)) {
        localStorage.setItem(STUDENTS_KEY, JSON.stringify([]));
    }
}

function getTrainings() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { self: defaultTrainings };
}

function saveTrainings(trainings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trainings));
    showToast('Treinos salvos com sucesso!', 'success');
}

function getStudents() {
    const data = localStorage.getItem(STUDENTS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveStudents(students) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

// ========================================
// NAVEGAÇÃO DE TABS
// ========================================

function switchTab(tabName) {
    // Remover classe active de todas as abas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remover classe active de todos os nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar classe active à aba selecionada
    const tabElement = document.getElementById(tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Adicionar classe active ao nav item
    event.target.closest('.nav-item').classList.add('active');
}

// ========================================
// SEÇÃO MEU TREINO
// ========================================

function loadMyTrainings() {
    const trainings = getTrainings();
    const myTraining = trainings.self;
    const grid = document.getElementById('meuTreinoGrid');
    
    grid.innerHTML = '';
    
    const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
    const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
    
    days.forEach((day, index) => {
        const training = myTraining[day];
        const card = document.createElement('div');
        card.className = 'training-card';
        
        const exercisesHtml = training.exercises
            .map(ex => `<li><i class="fas fa-check-circle"></i> ${ex}</li>`)
            .join('');
        
        card.innerHTML = `
            <h3>${dayNames[index]}</h3>
            <div class="focus">${training.focus}</div>
            <ul class="exercises">
                ${exercisesHtml}
            </ul>
        `;
        
        grid.appendChild(card);
    });
}

// ========================================
// SEÇÃO ALUNOS
// ========================================

function loadStudents() {
    const students = getStudents();
    const container = document.getElementById('studentsList');
    
    container.innerHTML = '';
    
    if (students.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #666;">Nenhum aluno adicionado ainda. Clique em "Adicionar Aluno" para começar.</p>';
        return;
    }
    
    students.forEach(student => {
        const card = document.createElement('div');
        card.className = 'student-card';
        
        const initials = student.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        
        card.innerHTML = `
            <div class="student-avatar">${initials}</div>
            <h3>${student.name}</h3>
            <p>${student.whatsapp || 'Sem WhatsApp'}</p>
            <div class="student-actions">
                <button class="btn-view-student" onclick="viewStudentTraining('${student.id}')">
                    <i class="fas fa-eye"></i> Ver Treino
                </button>
                <button class="btn-edit-student" onclick="openEditStudentModal('${student.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function openAddStudentModal() {
    document.getElementById('addStudentModal').classList.add('active');
}

function closeAddStudentModal() {
    document.getElementById('addStudentModal').classList.remove('active');
    document.getElementById('studentName').value = '';
    document.getElementById('studentWhatsapp').value = '';
}

function saveNewStudent() {
    const name = document.getElementById('studentName').value.trim();
    const whatsapp = document.getElementById('studentWhatsapp').value.trim();
    
    if (!name) {
        showToast('Por favor, digite o nome do aluno', 'error');
        return;
    }
    
    const students = getStudents();
    const trainings = getTrainings();
    
    const newStudent = {
        id: Date.now().toString(),
        name: name,
        whatsapp: whatsapp || ''
    };
    
    students.push(newStudent);
    saveStudents(students);
    
    // Criar treino padrão para o novo aluno
    trainings[newStudent.id] = JSON.parse(JSON.stringify(defaultTrainings));
    saveTrainings(trainings);
    
    closeAddStudentModal();
    loadStudents();
    populateStudentSelector();
    showToast(`Aluno "${name}" adicionado com sucesso!`, 'success');
}

function openEditStudentModal(studentId) {
    const students = getStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;
    
    editingStudentId = studentId;
    document.getElementById('editStudentName').value = student.name;
    document.getElementById('editStudentWhatsapp').value = student.whatsapp || '';
    document.getElementById('editStudentModal').classList.add('active');
}

function closeEditStudentModal() {
    document.getElementById('editStudentModal').classList.remove('active');
    editingStudentId = null;
}

function saveEditedStudent() {
    const students = getStudents();
    const student = students.find(s => s.id === editingStudentId);
    
    if (!student) return;
    
    student.name = document.getElementById('editStudentName').value.trim();
    student.whatsapp = document.getElementById('editStudentWhatsapp').value.trim();
    
    saveStudents(students);
    closeEditStudentModal();
    loadStudents();
    populateStudentSelector();
    showToast('Aluno atualizado com sucesso!', 'success');
}

function deleteStudent() {
    if (!confirm('Tem certeza que deseja deletar este aluno? Seus treinos também serão removidos.')) {
        return;
    }
    
    let students = getStudents();
    students = students.filter(s => s.id !== editingStudentId);
    saveStudents(students);
    
    let trainings = getTrainings();
    delete trainings[editingStudentId];
    saveTrainings(trainings);
    
    closeEditStudentModal();
    loadStudents();
    populateStudentSelector();
    showToast('Aluno removido com sucesso!', 'success');
}

function viewStudentTraining(studentId) {
    currentStudent = studentId;
    loadStudentForEditing();
    switchTab('editar-treino');
    document.querySelector('[onclick="switchTab(\'editar-treino\')"]').click();
}

// ========================================
// SEÇÃO EDITAR TREINOS
// ========================================

function populateStudentSelector() {
    const selector = document.getElementById('studentSelector');
    const students = getStudents();
    
    // Limpar opções exceto a primeira
    while (selector.options.length > 1) {
        selector.remove(1);
    }
    
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = student.name;
        selector.appendChild(option);
    });
}

function loadStudentForEditing() {
    currentStudent = document.getElementById('studentSelector').value;
    switchDay('segunda');
}

function switchDay(day) {
    currentDay = day;
    
    // Atualizar botões de dia
    document.querySelectorAll('.day-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Atualizar título
    const dayNames = {
        segunda: 'Segunda-feira',
        terca: 'Terça-feira',
        quarta: 'Quarta-feira',
        quinta: 'Quinta-feira',
        sexta: 'Sexta-feira'
    };
    
    document.getElementById('dayTitle').textContent = dayNames[day];
    
    // Carregar dados do dia
    loadDayTraining();
}

function loadDayTraining() {
    const trainings = getTrainings();
    const studentTraining = trainings[currentStudent] || trainings.self;
    const dayTraining = studentTraining[currentDay];
    
    document.getElementById('focusArea').value = dayTraining.focus;
    
    const exercisesList = document.getElementById('exercisesList');
    exercisesList.innerHTML = '';
    
    dayTraining.exercises.forEach((exercise, index) => {
        const item = document.createElement('div');
        item.className = 'exercise-item';
        item.innerHTML = `
            <input type="text" value="${exercise}" class="exercise-input" data-index="${index}">
            <button onclick="removeExercise(${index})" title="Remover exercício">
                <i class="fas fa-trash"></i>
            </button>
        `;
        exercisesList.appendChild(item);
    });
}

function addExercise() {
    const exercisesList = document.getElementById('exercisesList');
    const index = exercisesList.children.length;
    
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.innerHTML = `
        <input type="text" placeholder="Digite o exercício (ex: Supino: 4x10)" class="exercise-input" data-index="${index}">
        <button onclick="removeExercise(${index})" title="Remover exercício">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    exercisesList.appendChild(item);
}

function removeExercise(index) {
    const exercisesList = document.getElementById('exercisesList');
    const items = exercisesList.querySelectorAll('.exercise-item');
    if (items[index]) {
        items[index].remove();
    }
}

function saveDayTraining() {
    const trainings = getTrainings();
    const studentTraining = trainings[currentStudent] || trainings.self;
    
    const focusArea = document.getElementById('focusArea').value.trim();
    const exercises = Array.from(document.querySelectorAll('.exercise-input'))
        .map(input => input.value.trim())
        .filter(value => value.length > 0);
    
    if (!focusArea) {
        showToast('Por favor, digite o foco do treino', 'error');
        return;
    }
    
    if (exercises.length === 0) {
        showToast('Por favor, adicione pelo menos um exercício', 'error');
        return;
    }
    
    studentTraining[currentDay] = {
        focus: focusArea,
        exercises: exercises
    };
    
    trainings[currentStudent] = studentTraining;
    saveTrainings(trainings);
    loadMyTrainings();
    showToast('Treino salvo com sucesso!', 'success');
}

function resetDay() {
    if (confirm('Deseja descartar as alterações?')) {
        loadDayTraining();
    }
}

// ========================================
// CONFIGURAÇÕES
// ========================================

function saveSettings() {
    const name = document.getElementById('personalName').value;
    const whatsapp = document.getElementById('whatsappNumber').value;
    
    // Aqui você pode salvar as configurações globais se necessário
    showToast('Configurações salvas com sucesso!', 'success');
}

function exportData() {
    const trainings = getTrainings();
    const students = getStudents();
    
    const data = {
        trainings: trainings,
        students: students,
        exportDate: new Date().toLocaleString('pt-BR')
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `italo-ruan-treinos-${Date.now()}.json`;
    link.click();
    
    showToast('Dados exportados com sucesso!', 'success');
}

function resetAllData() {
    if (confirm('ATENÇÃO! Isso vai deletar TODOS os treinos e alunos. Tem certeza?')) {
        if (confirm('Esta ação é irreversível. Confirmar novamente?')) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STUDENTS_KEY);
            initializeData();
            loadMyTrainings();
            loadStudents();
            populateStudentSelector();
            showToast('Todos os dados foram resetados', 'success');
        }
    }
}

// ========================================
// LOGOUT
// ========================================

function logout() {
    if (confirm('Deseja sair do painel de administração?')) {
        window.location.href = 'personal-italo.html';
    }
}

// ========================================
// NOTIFICAÇÕES
// ========================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================================
// UTILITÁRIOS
// ========================================

// Fechar modais ao clicar fora
document.addEventListener('click', function(event) {
    const addModal = document.getElementById('addStudentModal');
    const editModal = document.getElementById('editStudentModal');
    
    if (event.target === addModal) {
        closeAddStudentModal();
    }
    
    if (event.target === editModal) {
        closeEditStudentModal();
    }
});

// Tecla ESC para fechar modais
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAddStudentModal();
        closeEditStudentModal();
    }
});
