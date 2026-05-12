document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://idwtktaypxsomnqlmjdp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd3RrdGF5cHhzb21ucWxtamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODQ4NjIsImV4cCI6MjA4MTI2MDg2Mn0.NqqhknttW9VfIb4sr3NkpTRemV3_YohxK093Pjhm8v0';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ADMIN_WHATSAPP = '5585981521490';
    const THEME_KEY     = 'student_app_theme';
    const CHECKIN_RADIUS_M = 3000;

    let currentStudent  = null;
    let currentDay      = 'segunda';
    let studentTrainings = null;
    let studentProgress  = {};
    let isMobileMenuOpen = false;
    let miniMap          = null;

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
    function loadTheme() { setTheme(localStorage.getItem(THEME_KEY) || 'light'); }

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
            document.getElementById('studentName').textContent = currentStudent.name;
        } catch {
            alert('Erro ao carregar sessão.');
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
    // TREINO DO DIA + PROGRESSO
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
            await checkWeeklyCompletion();
            showToast('Progresso salvo!', 'success');
        } catch {
            showToast('Erro ao salvar.', 'error');
            checkbox.checked = !checked;
        } finally {
            checkbox.disabled = false;
        }
    }

    async function checkWeeklyCompletion() {
        const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
        let allCompleted = true;

        for (const day of days) {
            const exercises = studentTrainings?.[day]?.exercises || [];
            const completed = studentProgress?.[day] || [];
            if (exercises.length && completed.length !== exercises.length) {
                allCompleted = false;
                break;
            }
        }

        if (allCompleted) {
            showToast('🎉 Parabéns! Você concluiu todos os treinos da semana!', 'success');
            days.forEach(day => studentProgress[day] = []);
            await supabase.from('progresso').upsert(
                { aluno_id: currentStudent.id, progresso: studentProgress },
                { onConflict: 'aluno_id' }
            );
            const storageKey = `consecutiveWeeks_${currentStudent.id}`;
            let weeks = parseInt(localStorage.getItem(storageKey) || '0', 10);
            weeks += 1;
            localStorage.setItem(storageKey, weeks.toString());

            if (weeks >= 4) {
                showToast('💡 Já se passaram 4 semanas! Considere pedir ao seu professor uma atualização de treino.', 'success');
                localStorage.setItem(storageKey, '0');
            }
            selectDay(currentDay);
        }
    }

    // ============================================================
    // CHECK-IN (com tratamento de permissão melhorado)
    // ============================================================
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
                const dt  = new Date(data.created_at);
                const fmt = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
                document.getElementById('checkinLastText').textContent = `Último: ${data.gym_name} — ${fmt}`;
                document.getElementById('checkinLastInfo').style.display = 'flex';
            }
        } catch { /* silencioso */ }
    }

    async function doCheckin() {
        const btn     = document.getElementById('btnCheckin');
        const loading = document.getElementById('checkinLoading');
        const result  = document.getElementById('checkinResult');
        const loadTxt = document.getElementById('checkinLoadingText');

        btn.style.display     = 'none';
        result.style.display  = 'none';
        loading.style.display = 'flex';
        loadTxt.textContent   = 'Obtendo localização...';

        try {
            const { lat, lng } = await getCurrentPosition();
            loadTxt.textContent = 'Buscando academias próximas...';
            const gyms = await fetchNearbyGyms(lat, lng, CHECKIN_RADIUS_M);

            if (gyms.length === 0) {
                showCheckinError('Nenhuma academia encontrada em um raio de 3 km. Tente em outro local.', btn, loading);
                return;
            }

            const nearest = gyms[0];
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

            loading.style.display = 'none';
            showCheckinResult(nearest, lat, lng);
            await loadLastCheckin();
            showToast(`Check-in feito em ${nearest.name}! 💪`, 'success');
        } catch (err) {
            showCheckinError(err.message || 'Erro ao realizar check-in.', btn, loading);
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

        const mapDiv = document.getElementById('checkinMiniMap');
        mapDiv.style.display = 'block';
        if (miniMap) { miniMap.remove(); miniMap = null; }

        setTimeout(() => {
            miniMap = L.map('checkinMiniMap', { zoomControl: true, scrollWheelZoom: false }).setView([latAluno, lngAluno], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(miniMap);

            const iconAluno = L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:#1e40af;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`, iconSize:[16,16], iconAnchor:[8,8] });
            L.marker([latAluno, lngAluno], { icon: iconAluno }).addTo(miniMap).bindPopup('Você está aqui');

            const iconGym = L.divIcon({ className:'', html:`<div style="width:20px;height:20px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`, iconSize:[20,20], iconAnchor:[10,10] });
            L.marker([gym.lat, gym.lng], { icon: iconGym }).addTo(miniMap).bindPopup(gym.name).openPopup();

            L.polyline([[latAluno, lngAluno], [gym.lat, gym.lng]], { color:'#1e40af', weight:2, dashArray:'6,4', opacity:.7 }).addTo(miniMap);
        }, 100);
    }

    function showCheckinError(msg, btn, loading) {
        loading.style.display = 'none';
        btn.style.display     = 'block';
        showToast(msg, 'error');
    }

    // ============================================================
    // GEOLOCALIZAÇÃO COM FEEDBACK INTELIGENTE
    // ============================================================
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Seu navegador não suporta geolocalização.'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => {
                    let msg = '';
                    let canOpenSettings = false;

                    switch(err.code) {
                        case err.PERMISSION_DENIED:
                            msg = 'Localização bloqueada. Para usar o check-in, permita o acesso à localização nas configurações do seu navegador.';
                            canOpenSettings = true;
                            break;
                        case err.POSITION_UNAVAILABLE:
                            msg = 'Localização indisponível. Verifique se o GPS/Wi-Fi está ativo.';
                            break;
                        case err.TIMEOUT:
                            msg = 'Tempo esgotado. Tente novamente em uma área com melhor sinal.';
                            break;
                        default:
                            msg = 'Erro ao obter localização.';
                            break;
                    }

                    // Exibe toast com instruções
                    showToast(msg, 'error');

                    // Se possível, oferece um atalho para as configurações do site
                    if (canOpenSettings) {
                        // Abre um diálogo nativo ou instrução extra
                        if (window.confirm(msg + '\n\nDeseja abrir as configurações do site? (funciona no Chrome/Edge para desktop e Android)')) {
                            openSiteSettings();
                        }
                    }

                    reject(new Error(msg));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Tenta abrir as configurações de permissão do site.
     * Funciona no Chrome/Edge para desktop (chrome://settings/content/siteDetails)
     * e no Android (intent de configurações do navegador).
     */
    function openSiteSettings() {
        // Fallback: se for mobile, tentar abrir as configurações do app
        const ua = navigator.userAgent;
        const isAndroid = /Android/i.test(ua);
        const isChrome = /Chrome/i.test(ua);

        if (isAndroid && isChrome) {
            // No Android Chrome, podemos tentar abrir as configurações do site via intent
            window.location.href = 'intent://settings#Intent;scheme=chrome;package=com.android.chrome;end';
        } else {
            // Desktop: tentar abrir diretamente as configurações do site
            window.open('chrome://settings/content/siteDetails?site=' + encodeURIComponent(window.location.origin), '_blank');
        }

        // Dica extra no toast
        showToast('📱 Se a janela de configurações não abrir, acesse manualmente: Configurações do navegador > Privacidade > Localização.', 'success');
    }

    // ============================================================
    // OVERPASS API – BUSCA DE ACADEMIAS
    // ============================================================
    async function fetchNearbyGyms(lat, lng, radiusM) {
        const query = `
            [out:json][timeout:10];
            (
              node["leisure"="fitness_centre"](around:${radiusM},${lat},${lng});
              node["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
              node["amenity"="gym"](around:${radiusM},${lat},${lng});
              way["leisure"="fitness_centre"](around:${radiusM},${lat},${lng});
              way["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
            );
            out center;
        `;

        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!res.ok) throw new Error('Falha ao buscar academias. Tente novamente mais tarde.');

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

    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast-aluno ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    initializeApp();
});