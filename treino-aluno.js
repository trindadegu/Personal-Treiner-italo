document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================
    const SUPABASE_URL = 'https://idwtktaypxsomnqlmjdp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd3RrdGF5cHhzb21ucWxtamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODQ4NjIsImV4cCI6MjA4MTI2MDg2Mn0.NqqhknttW9VfIb4sr3NkpTRemV3_YohxK093Pjhm8v0';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ADMIN_WHATSAPP = '5585981521490';
    const THEME_KEY     = 'student_app_theme';
    const CHECKIN_RADIUS_M = 3000; // busca academias num raio de 3 km

    let currentStudent  = null;
    let currentDay      = 'segunda';
    let studentTrainings = null;
    let studentProgress  = {};
    let isMobileMenuOpen = false;
    let miniMap          = null; // instância Leaflet do mini-mapa no card

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    async function initializeApp() {
        await checkStudentLogin();
        if (!currentStudent) return;

        loadTheme();
        setupEventListeners();
        await loadStudentData();
        await loadLastCheckin();
        selectDay('segunda');
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
                'toggle-theme':    toggleTheme,
                'toggle-days-menu':toggleDaysMenu,
                'close-days-menu': closeDaysMenu,
                'send-whatsapp':   sendWhatsApp,
                'logout':          logout,
                'do-checkin':      doCheckin,
            };
            if (actions[action]) actions[action]();
        });

        document.querySelectorAll('[data-day]').forEach(btn => {
            btn.addEventListener('click', () => selectDay(btn.dataset.day));
        });

        document.getElementById('exercisesTableBody').addEventListener('change', (e) => {
            if (e.target.classList.contains('exercise-checkbox')) {
                toggleExercise(e.target.dataset.index, e.target);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMobileMenuOpen) closeDaysMenu();
        });
    }

    // ============================================================
    // TEMA
    // ============================================================
    function loadTheme() {
        setTheme(localStorage.getItem(THEME_KEY) || 'light');
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('themeIcon').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        updateLogoImage(theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    function updateLogoImage(theme) {
        const logo = document.getElementById('logoImage');
        logo.src = theme === 'dark' ? 'img/acessoriaar.png' : 'img/acessoriapreto.jpg';
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(current === 'light' ? 'dark' : 'light');
    }

    // ============================================================
    // AUTENTICAÇÃO
    // ============================================================
    async function checkStudentLogin() {
        const sessionData = localStorage.getItem('student_session');
        if (!sessionData) { alert('Sessão não encontrada. Faça login novamente.'); window.location.href = 'login.html'; return; }
        try {
            const session = JSON.parse(sessionData);
            if (session.expiresAt < Date.now()) { alert('Sua sessão expirou. Faça login novamente.'); logout(); return; }
            currentStudent = { id: session.id, name: session.name };
            const el = document.getElementById('studentName');
            if (el) el.textContent = currentStudent.name;
        } catch {
            alert('Erro ao carregar sessão. Faça login novamente.');
            logout();
        }
    }

    // ============================================================
    // DADOS DO ALUNO
    // ============================================================
    async function loadStudentData() {
        if (!currentStudent) return;
        try {
            const [treinoRes, progressoRes] = await Promise.all([
                supabase.from('treinos').select('treino').eq('aluno_id', currentStudent.id).single(),
                supabase.from('progresso').select('progresso').eq('aluno_id', currentStudent.id).single()
            ]);
            studentTrainings = treinoRes.data?.treino || await getDefaultTraining();
            studentProgress  = progressoRes.data?.progresso || {};
        } catch (err) {
            showToast('Não foi possível carregar seus dados.', 'error');
        }
    }

    // ============================================================
    // MENU DE DIAS
    // ============================================================
    function toggleDaysMenu() {
        isMobileMenuOpen = !isMobileMenuOpen;
        const menu    = document.getElementById('daysMenuMobile');
        const overlay = document.getElementById('menuOverlay');
        const icon    = document.getElementById('menuIcon');
        if (isMobileMenuOpen) {
            menu.classList.add('active');
            overlay.classList.add('active');
            icon.className = 'fas fa-times';
            document.body.style.overflow = 'hidden';
        } else {
            closeDaysMenu();
        }
    }

    function closeDaysMenu() {
        isMobileMenuOpen = false;
        document.getElementById('daysMenuMobile').classList.remove('active');
        document.getElementById('menuOverlay').classList.remove('active');
        document.getElementById('menuIcon').className = 'fas fa-calendar-alt';
        document.body.style.overflow = 'auto';
    }

    function selectDay(day) {
        currentDay = day;
        const dayNames  = { segunda:'Segunda', terca:'Terça', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta' };
        const shortNames= { segunda:'Seg',     terca:'Ter',   quarta:'Qua',   quinta:'Qui',   sexta:'Sex' };
        document.getElementById('currentDayText').textContent = shortNames[day];
        document.getElementById('dayTitle').innerHTML = `<i class="fas fa-calendar-day"></i> ${dayNames[day]}-feira`;
        document.querySelectorAll('[data-day]').forEach(b => b.classList.toggle('active', b.dataset.day === day));
        loadDayTraining();
        closeDaysMenu();
    }

    // ============================================================
    // TREINO DO DIA
    // ============================================================
    function loadDayTraining() {
        const training = studentTrainings?.[currentDay];
        const tbody = document.getElementById('exercisesTableBody');
        tbody.innerHTML = '';

        if (!training?.exercises?.length) {
            document.getElementById('focusArea').textContent = 'Dia de descanso';
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gray-text);">
                <i class="fas fa-bed" style="font-size:1.5rem;margin-bottom:.5rem;"></i><br>Nenhum exercício para hoje.</td></tr>`;
            updateProgressUI();
            return;
        }

        document.getElementById('focusArea').textContent = training.focus || 'Treino do dia';

        training.exercises.forEach((ex, index) => {
            const isCompleted = studentProgress[currentDay]?.includes(index) ?? false;
            const exId = `ex_${currentDay}_${index}_${Date.now()}`;
            tbody.innerHTML += `
                <tr class="exercise-row ${isCompleted ? 'completed' : ''}">
                    <td><input type="checkbox" class="exercise-checkbox" id="${exId}" name="${exId}"
                               data-index="${index}" ${isCompleted ? 'checked' : ''} autocomplete="off"></td>
                    <td class="exercise-name"><label for="${exId}">${ex.name || 'Exercício'}</label></td>
                    <td>${ex.series || '-'}</td>
                    <td>${ex.reps || '-'}</td>
                    <td>${ex.video
                        ? `<a href="${ex.video}" target="_blank" class="video-link"><i class="fas fa-play-circle"></i> Vídeo</a>`
                        : '<span style="color:var(--gray-text);">-</span>'}</td>
                </tr>`;
        });
        updateProgressUI();
    }

    function updateProgressUI() {
        const exercises  = studentTrainings?.[currentDay]?.exercises || [];
        const completed  = studentProgress?.[currentDay] || [];
        const total      = exercises.length;
        const count      = completed.length;
        const pct        = total > 0 ? Math.round((count / total) * 100) : 0;
        document.getElementById('progressFill').style.width       = `${pct}%`;
        document.getElementById('progressPercentage').textContent = `${pct}%`;
        document.getElementById('progressText').textContent       = `${count} / ${total} exercícios`;
    }

    async function toggleExercise(index, checkbox) {
        const idx = parseInt(index);
        const checked = checkbox.checked;
        checkbox.disabled = true;
        try {
            if (!Array.isArray(studentProgress[currentDay])) studentProgress[currentDay] = [];
            const arr = studentProgress[currentDay];
            const pos = arr.indexOf(idx);
            if (checked && pos === -1) arr.push(idx);
            else if (!checked && pos > -1) arr.splice(pos, 1);

            await supabase.from('progresso').upsert(
                { aluno_id: currentStudent.id, progresso: studentProgress },
                { onConflict: 'aluno_id' }
            );
            checkbox.closest('tr').classList.toggle('completed', checked);
            updateProgressUI();
            showToast('Progresso salvo!', 'success');
        } catch {
            showToast('Erro ao salvar.', 'error');
            checkbox.checked = !checked;
        } finally {
            checkbox.disabled = false;
        }
    }

    // ============================================================
    // ✅ CHECK-IN  —  lógica principal
    // ============================================================

    /** Carrega o último check-in do aluno e mostra no card */
    async function loadLastCheckin() {
        try {
            const { data } = await supabase
                .from('checkins')
                .select('*')
                .eq('aluno_id', currentStudent.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                const dt   = new Date(data.created_at);
                const fmt  = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
                const el   = document.getElementById('checkinLastInfo');
                const txt  = document.getElementById('checkinLastText');
                if (el && txt) {
                    txt.textContent = `Último: ${data.gym_name} — ${fmt}`;
                    el.style.display = 'flex';
                }
            }
        } catch { /* silencioso */ }
    }

    /** Fluxo completo de check-in */
    async function doCheckin() {
        const btn     = document.getElementById('btnCheckin');
        const loading = document.getElementById('checkinLoading');
        const result  = document.getElementById('checkinResult');
        const loadTxt = document.getElementById('checkinLoadingText');

        // Reseta UI
        btn.style.display     = 'none';
        result.style.display  = 'none';
        loading.style.display = 'flex';
        loadTxt.textContent   = 'Obtendo sua localização...';

        try {
            // 1. Pega coords do browser
            const { lat, lng } = await getCurrentPosition();

            // 2. Busca academias via Overpass (OSM) — gratuito, sem chave
            loadTxt.textContent = 'Buscando academias próximas...';
            const gyms = await fetchNearbyGyms(lat, lng, CHECKIN_RADIUS_M);

            if (gyms.length === 0) {
                showCheckinError('Nenhuma academia encontrada num raio de 3 km. Tente em outro local.', btn, loading);
                return;
            }

            // 3. Pega a mais próxima
            const nearest = gyms[0];

            // 4. Salva no Supabase
            loadTxt.textContent = 'Salvando check-in...';
            await supabase.from('checkins').insert([{
                aluno_id:    currentStudent.id,
                aluno_nome:  currentStudent.name,
                gym_name:    nearest.name,
                gym_address: nearest.address,
                distance_m:  Math.round(nearest.distance),
                lat_aluno:   lat,
                lng_aluno:   lng,
                lat_gym:     nearest.lat,
                lng_gym:     nearest.lng,
                created_at:  new Date().toISOString()
            }]);

            // 5. Mostra resultado
            loading.style.display = 'none';
            showCheckinResult(nearest, lat, lng);
            await loadLastCheckin();
            showToast(`Check-in feito em ${nearest.name}! 💪`, 'success');

        } catch (err) {
            showCheckinError(err.message || 'Erro inesperado. Tente novamente.', btn, loading);
        }
    }

    function showCheckinResult(gym, latAluno, lngAluno) {
        const result  = document.getElementById('checkinResult');
        const btn     = document.getElementById('btnCheckin');
        const loading = document.getElementById('checkinLoading');

        document.getElementById('checkinGymName').textContent    = gym.name;
        document.getElementById('checkinGymAddress').textContent = gym.address || 'Endereço não disponível';
        document.getElementById('checkinGymDist').textContent    = formatDistance(gym.distance);

        result.style.display  = 'block';
        loading.style.display = 'none';
        btn.style.display     = 'block';
        btn.innerHTML         = '<i class="fas fa-check-circle"></i> <span>Check-in feito! Fazer novo</span>';

        // Mini mapa Leaflet
        const mapDiv = document.getElementById('checkinMiniMap');
        mapDiv.style.display = 'block';

        // Destrói instância anterior se existir
        if (miniMap) { miniMap.remove(); miniMap = null; }

        setTimeout(() => {
            miniMap = L.map('checkinMiniMap', { zoomControl: true, scrollWheelZoom: false }).setView([latAluno, lngAluno], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(miniMap);

            // Marcador aluno (azul)
            const iconAluno = L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:#1e40af;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`, iconSize:[16,16], iconAnchor:[8,8] });
            L.marker([latAluno, lngAluno], { icon: iconAluno }).addTo(miniMap).bindPopup('Você está aqui');

            // Marcador academia (vermelho)
            const iconGym = L.divIcon({ className:'', html:`<div style="width:20px;height:20px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`, iconSize:[20,20], iconAnchor:[10,10] });
            L.marker([gym.lat, gym.lng], { icon: iconGym }).addTo(miniMap).bindPopup(gym.name).openPopup();

            // Linha conectando
            L.polyline([[latAluno, lngAluno], [gym.lat, gym.lng]], { color:'#1e40af', weight:2, dashArray:'6,4', opacity:.7 }).addTo(miniMap);
        }, 100);
    }

    function showCheckinError(msg, btn, loading) {
        loading.style.display = 'none';
        btn.style.display     = 'block';
        showToast(msg, 'error');
    }

    // ============================================================
    // HELPERS DE GEOLOCALIZAÇÃO / OSM
    // ============================================================

    /** Retorna { lat, lng } via browser Geolocation API */
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Seu navegador não suporta geolocalização.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => {
                    const msgs = {
                        1: 'Permissão de localização negada. Habilite nas configurações do navegador.',
                        2: 'Localização indisponível. Verifique seu GPS/Wi-Fi.',
                        3: 'Tempo esgotado ao obter localização. Tente novamente.'
                    };
                    reject(new Error(msgs[err.code] || 'Erro ao obter localização.'));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    /** Busca academias próximas via Overpass API (OpenStreetMap) — totalmente gratuito */
    async function fetchNearbyGyms(lat, lng, radiusM) {
        // Overpass query: fitness centres, gyms e sports centres num raio
        const query = `
            [out:json][timeout:15];
            (
              node["leisure"="fitness_centre"](around:${radiusM},${lat},${lng});
              node["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
              node["amenity"="gym"](around:${radiusM},${lat},${lng});
              way["leisure"="fitness_centre"](around:${radiusM},${lat},${lng});
              way["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
            );
            out center;
        `;
        const url = 'https://overpass-api.de/api/interpreter';
        const res = await fetch(url, {
            method: 'POST',
            body: query,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!res.ok) throw new Error('Falha ao buscar academias. Tente novamente.');
        const json = await res.json();

        return json.elements
            .map(el => {
                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (!elLat || !elLng) return null;
                const dist = haversineDistance(lat, lng, elLat, elLng);
                const name = el.tags?.name || el.tags?.['name:pt'] || 'Academia sem nome';
                const street = el.tags?.['addr:street'] || '';
                const num    = el.tags?.['addr:housenumber'] || '';
                const city   = el.tags?.['addr:city'] || '';
                const address = [street, num, city].filter(Boolean).join(', ') || null;
                return { name, address, lat: elLat, lng: elLng, distance: dist };
            })
            .filter(Boolean)
            .sort((a, b) => a.distance - b.distance);
    }

    /** Distância em metros entre dois pontos (Haversine) */
    function haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function toRad(deg) { return deg * Math.PI / 180; }

    function formatDistance(m) {
        return m < 1000 ? `${Math.round(m)} m de distância` : `${(m/1000).toFixed(1)} km de distância`;
    }

    // ============================================================
    // AÇÕES
    // ============================================================
    function sendWhatsApp() {
        const names = { segunda:'Segunda', terca:'Terça', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta' };
        const msg = `Olá, Italo! Sou ${currentStudent.name} e estou com uma dúvida sobre o meu treino de ${names[currentDay]}.`;
        window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function logout() {
        if (confirm('Tem certeza que deseja sair?')) {
            localStorage.removeItem('student_session');
            window.location.href = 'login.html';
        }
    }

    async function getDefaultTraining() {
        try {
            const { data } = await supabase.from('treinos_padroes').select('treino').single();
            return data?.treino || {};
        } catch { return {}; }
    }

    // ============================================================
    // TOAST
    // ============================================================
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast-aluno ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    initializeApp();
});