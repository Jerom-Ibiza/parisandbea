/* ------------------------------------------------ utilidades básicas ------------------------------------------------ */
const $id = id => document.getElementById(id);

/* ---------- divisor ajustable de paneles ---------- */
const divider = $id('divider');
const panels = $id('panels');
const infoMask = $id('infoMask');
const chatMask = $id('chatMask');

function updateMasks() {
    const r = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-ratio')) || 0.5;
    const threshold = 0.22;
    if (infoMask) infoMask.classList.toggle('show', r < threshold);
    if (chatMask) chatMask.classList.toggle('show', (1 - r) < threshold);
}
function setRatio(r) {
    r = Math.max(0, Math.min(1, r));
    document.documentElement.style.setProperty('--panel-ratio', r);
    updateMasks();
}
function startDrag(e) {
    e.preventDefault();
    const horizontal = window.matchMedia('(min-width:1200px)').matches;
    const startPos = e.touches ? (horizontal ? e.touches[0].clientX : e.touches[0].clientY) : (horizontal ? e.clientX : e.clientY);
    const rect = panels.getBoundingClientRect();
    const startRatio = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-ratio')) || 0.5;
    const move = ev => {
        const pos = ev.touches ? (horizontal ? ev.touches[0].clientX : ev.touches[0].clientY) : (horizontal ? ev.clientX : ev.clientY);
        const delta = pos - startPos;
        const size = horizontal ? rect.width : rect.height;
        setRatio((startRatio * size + delta) / size);
    };
    const stop = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchend', stop);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move);
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop);
}
divider?.addEventListener('mousedown', startDrag);
divider?.addEventListener('touchstart', startDrag);

/* ---------- overlay asistente: mostrar / ocultar ---------- */
function showAssistantImg() {
    if ($id('assistantOverlay')) return;          // ya existe

    const img = new Image();                     // atajo para crear <img>
    img.id = 'assistantOverlay';
    img.src = 'images/recursos/assistant.png';
    img.className = 'assistant-overlay';
    document.body.appendChild(img);

    /* ── cuando la imagen esté lista, dispara el fundido ── */
    const reveal = () => requestAnimationFrame(() => img.classList.add('show'));

    if (img.complete) {        // ya en caché
        reveal();
    } else {
        img.onload = reveal;   // esperar a que cargue
    }
}

function hideAssistantImg() {
    const img = $id('assistantOverlay');
    if (!img) return;
    img.classList.remove('show');                    // inicia fundido
    img.addEventListener('transitionend', () => img.remove(), { once: true });
}

// ---------- modal de texto ----------
const modalAsk = $id('modalAsk');     // <div id="modalAsk">…
const btnSendTxt = $id('btnAskSend');   // botón con el icono “send”
/* ---------- manejo de chat persistente ---------- */
let activeChatId = null;          // se rellenará al primer guardado
let chatChanged = false;         // true cuando hay algo nuevo sin salvar
window.sessionImages = [];

/* ================= CLICK GLOBAL (📌 / 🔍) ================= */
document.addEventListener('click', async e => {

    /* ---------- 1 · GUARDAR adjunto temporal (📌) ---------- */
    if (e.target.classList.contains('btnSaveAttach')) {
        /* …handler de guardado… */
        return;
    }

    /* ---------- 2 · ANALIZAR adjunto permanente (🔍/🔬) ---------- */
    const probe = e.target.closest('.probe, .research');
    if (!probe) return;

    const url = probe.dataset.url;
    if (!url) return;

    /* quitar iconos 🔍/🔬 tras pulsar uno de ellos */
    const wrapper = probe.closest('.thumb-wrap, .file-wrap, .attach');
    wrapper?.querySelectorAll('.probe, .research').forEach(el => el.remove());

    const isImg = /\.(jpe?g|png|webp|gif|bmp|svg|heic)$/i.test(url);
    const isResearch = probe.classList.contains('research');
    const userQ = inpMsg.value.trim() ||
        (isImg
            ? isResearch
                ? 'Analiza cuidadosamente esta imagen y dame una descripción técnica detallada.'
                : 'Describe brevemente esta imagen.'
            : isResearch
                ? 'Analiza cuidadosamente este documento y dame una descripción técnica detallada.'
                : 'Hazme un breve resumen de este documento.');

    /* limpiar textarea y volcar pregunta */
    inpMsg.value = '';
    autoGrow(inpMsg);
    log.insertAdjacentHTML(
        'beforeend',
        `<div class="feedback msg-user">${linkify(userQ)}</div>`
    );
    chatChanged = true;
    log.scrollTop = log.scrollHeight;

    /* ============ 2.a · IMAGEN ============ */
    if (isImg) {
        // Envío una sola imagen para evitar errores al
        // acumular varias en sessionImages
        window.sessionImages = [url];
        const bodyImg = { message: userQ, images: [url] };
        if (useModelO3) await sendToAssistant(bodyImg);
        else await sendToAssistantStream(bodyImg);
        return;
    }

    // 2.b · PDF / WORD / OTRO DOC
    try {
        ensureLoader();

        // 1) extrae la ruta relativa (sin protocolo ni host)
        const relPath = new URL(probe.dataset.url).pathname.replace(/^\/+/, '');

        // 2) llama al endpoint de ingesta
        const rr = await fetch('/api/assistant/files/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: relPath }),
            credentials: 'include'
        });
        const jj = await safeJson(rr);
        if (!jj.ok) throw new Error(jj.error || 'Error preparando doc');

        // —— Inserta un mensaje en el chat con el resultado de la función ——  
        log.insertAdjacentHTML('beforeend',
            `<div class="feedback info">
		   📄 Documento preparado: file_id=${jj.file_id}, vs=${jj.vector_store}
		 </div>`
        );
        chatChanged = true;
        log.scrollTop = log.scrollHeight;

        // 3) ahora sí haz la pregunta al asistente
        const bodyDoc = { message: userQ };
        if (useModelO3) await sendToAssistant(bodyDoc);
        else await sendToAssistantStream(bodyDoc);

    } catch (err) {
        safeRemoveLoader();
        log.insertAdjacentHTML('beforeend',
            `<div class="feedback error">${linkify(err.message)}</div>`
        );
        chatChanged = true;
        log.scrollTop = log.scrollHeight;
    }
});

document.addEventListener('click', async e => {
    const lens = e.target.closest('.lens');
    if (!lens) return;

    const url = lens.dataset.url;
    const msg = $id('txtMessage').value.trim();
    if (!msg) {
        alert('Escribe tu consulta antes de pulsar el icono 🔬');
        return;
    }

    $id('txtMessage').value = '';
    $id('textPanel').style.display = 'none';

    log.insertAdjacentHTML(
        'beforeend',
        `<div class="feedback msg-user">${linkify(msg)}</div>`
    );
    chatChanged = true;
    log.scrollTop = log.scrollHeight;

    const ext = url.split('.').pop().toLowerCase();
    const isImg = /\.(jpe?g|png|webp|gif|bmp)$/i.test(url);

    const body = {
        message: msg,
        ...(isImg ? { images: [url] } : {})
    };
    if (useModelO3) {
        body.model = 'o3';
        body.noSearch = true;
    }

    ensureLoader();
    try {
        const r = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const raw = await r.text();
        let j;
        try { j = JSON.parse(raw); }
        catch { throw new Error(raw); }
        await handleAssistantResponse(j);
    } catch (err) {
        safeRemoveLoader();
        log.insertAdjacentHTML(
            'beforeend',
            `<div class="feedback error">${err.message}</div>`
        );
        chatChanged = true;
        log.scrollTop = log.scrollHeight;
    }
});

/* ---------- construye el body para /assistant/chat ---------- */
function buildAssistantBody(msg) {
    const body = { message: msg };
    if (window.sessionImages.length) {
        body.images = [...window.sessionImages];      // copia defensiva
    }
    if (useModelO3) {
        body.model = 'o3';
        body.noSearch = true;
    }
    return body;
}

const serializeChat = () => log.innerHTML;  // volcamos tal cual el HTML
const row = (l, v) => v ? `<dt>${l}</dt><dd>${v}</dd>` : '';
const title = (i, t) => `<div class="section-title"><span class="material-icons-outlined">${i}</span>${t}</div>`;
/* ---------- formateador de fechas ---------- */
const fDate = d => {
    /* 1) vacío, null o undefined → nada */
    if (!d) return '';

    /* 2) si viene como string “0000-00-00”  → nada */
    if (typeof d === 'string' && /^0{4}-0{2}-0{2}$/.test(d.trim())) return '';

    /* 3) pasamos a objeto Date */
    const dateObj = new Date(d);

    /* 4) inválido o siglo XIX (efecto 30-11-1899) → nada */
    if (isNaN(dateObj) || dateObj.getFullYear() < 1900) return '';

    /* 5) formato dd/mm/aaaa 🇪🇸 */
    return dateObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const fTime = t => t ? t.slice(0, 5) : '';

let currentBlock = 'historial';

/* ---------- linkify con 🔍 y 📌 ---------- */
const linkify = txt => {
    const processLine = line =>
        line.replace(/(https?:\/\/[^\s]+)/g, url => {
            const isImg = /\.(jpe?g|png|webp|gif|bmp|svg|heic)$/i.test(url);
            const isStored = /\/attachments_consulta\//i.test(url); // ya guardado
            const isTmp = /\/tmp\//i.test(url);
            const showProbe = isTmp;                 // solo para archivos en tmp
            const showPin = isTmp && !isImg;         // pin solo para tmp-PDF
            const iconProbe = showProbe ? `<span class="probe" data-url="${url}" title="Analizar">🔍</span>` : '';
            const iconResearch = showProbe ? `&nbsp;<span class="research" data-url="${url}" title="Análisis técnico">🔬</span>` : '';
            const iconPin = showPin ? `<button class="btnSaveAttach" data-tmp="${url.split('/').pop()}" title="Guardar">📌</button>` : '';

            if (isImg) {
                return `<div class="thumb-wrap">${iconPin}<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="thumb" /></a>${iconProbe}${iconResearch}</div>`;
            }
            // PDF / Word u otros
            return `<div class="file-wrap">${iconPin}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${iconProbe}${iconResearch}</div>`;
        });

    return txt.split(/\n+/).map(processLine).join('<br>');
};

/* ------- envía mensaje silencioso ------- */
async function safeJson(res) {
    const txt = await res.text();
    try { return JSON.parse(txt); }
    catch { return { ok: false, reply: txt }; }
}
async function sendHidden(msg) {
    try {
        const r = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildAssistantBody(msg))
        });
        return await safeJson(r);
    } catch (e) {
        console.error('Hidden call error', e);
        return { ok: false, reply: '' };
    }
}

/* ------- spinner helpers ------- */
const ensureLoader = () => $id('spin') || addLoader();
const safeRemoveLoader = () => removeLoader();

async function sendToAssistant(body) {
    if (useModelO3) {
        body.model = 'o3';
        body.noSearch = true;
    }
    ensureLoader();
    try {
        const r = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const raw = await r.text();
        let j;
        try { j = JSON.parse(raw); }
        catch { throw new Error(raw); }
        await handleAssistantResponse(j);
    } catch (err) {
        safeRemoveLoader();
        log.insertAdjacentHTML(
            'beforeend', `<div class="feedback error">${linkify(err.message)}</div>`
        );
        chatChanged = true; log.scrollTop = log.scrollHeight;
    }
}

async function sendToAssistantStream(body) {
    ensureLoader();
    const opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
    };
    const r = await fetch('/api/assistant/chat-stream', opts);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    let full = '';
    const div = document.createElement('div');
    div.className = 'feedback msg-assist';
    log.appendChild(div);
    chatChanged = true;
    log.scrollTop = log.scrollHeight;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (!chunk) continue;
            if (chunk.startsWith('event:')) {
                const lines = chunk.split('\n');
                const ev = lines[0].slice(6).trim();
                const data = (lines[1] || '').replace(/^data:/, '').trim();
                if (ev === 'audio') playTTS(data);
                else if (ev === 'done') {
                    safeRemoveLoader();
                } else if (ev === 'error') {
                    safeRemoveLoader();
                    log.insertAdjacentHTML(
                        'beforeend', `<div class="feedback error">${linkify(data)}</div>`
                    );
                }
            } else if (chunk.startsWith('data:')) {
                const txt = chunk.slice(5).replace(/\\n/g, '\n');
                full += txt;
                div.innerHTML = linkify(full);
                log.scrollTop = log.scrollHeight;
            }
        }
    }
    safeRemoveLoader();
}

async function sendVoiceStream(form) {
    ensureLoader();
    const r = await fetch('/api/assistant/voice-stream', {
        method: 'POST',
        credentials: 'include',
        body: form
    });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    let full = '';
    let div = null;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (!chunk) continue;
            if (chunk.startsWith('event:')) {
                const lines = chunk.split('\n');
                const ev = lines[0].slice(6).trim();
                const data = (lines[1] || '').replace(/^data:/, '').trim();
                if (ev === 'question') {
                    log.insertAdjacentHTML(
                        'beforeend',
                        `<div class="feedback msg-user">${linkify(data)}</div>`
                    );
                    chatChanged = true;
                    div = document.createElement('div');
                    div.className = 'feedback msg-assist';
                    log.appendChild(div);
                    log.scrollTop = log.scrollHeight;
                } else if (ev === 'audio') {
                    playTTS(data);
                } else if (ev === 'done') {
                    safeRemoveLoader();
                } else if (ev === 'error') {
                    safeRemoveLoader();
                    log.insertAdjacentHTML(
                        'beforeend', `<div class="feedback error">${linkify(data)}</div>`
                    );
                }
            } else if (chunk.startsWith('data:')) {
                const txt = chunk.slice(5).replace(/\\n/g, '\n');
                full += txt;
                if (!div) {
                    div = document.createElement('div');
                    div.className = 'feedback msg-assist';
                    log.appendChild(div);
                }
                div.innerHTML = linkify(full);
                log.scrollTop = log.scrollHeight;
            }
        }
    }
    safeRemoveLoader();
}

/* ------- gestor recursivo de respuestas ------- */
async function handleAssistantResponse(j, silent = false, depth = 0) {
    if (depth > 3) {            // evita bucle infinito
        safeRemoveLoader();
        return;
    }
    if (!j || !j.ok) {        // error ya tratado por caller
        safeRemoveLoader();
        return;
    }

    /* --------- caso 1: hay texto --------- */
    if (j.reply && j.reply.trim()) {
        safeRemoveLoader();
        if (!silent) {
            log.insertAdjacentHTML(
                'beforeend',
                `<div class="feedback msg-assist">${linkify(j.reply)}</div>`
            );
            chatChanged = true;
            log.scrollTop = log.scrollHeight;
        }
        if (confRE.test(j.reply)) {
            await loadSession();
        }
        if (j.audioUrl) playTTS(j.audioUrl);
        return;
    }

    if (confRE.test(j.reply)) {
        await loadSession();   // vuelve a pedir los datos al servidor
    }

    /* --------- caso 2: solo audio --------- */
    if (j.audioUrl) {
        safeRemoveLoader();
        playTTS(j.audioUrl);
        return;
    }

    /* --------- caso 3: respuesta vacía → re-preguntar --------- */
    ensureLoader();                     // mantenemos spinner
    const next = await sendHidden('Completa todo lo que te he pedido');
    await handleAssistantResponse(next, true, depth + 1);
}

/* ------------------------------------------------ guías por bloque --------------------------------------------------- */
const guide = {
    historial: [
        { icon: 'psychology', text: 'Motivo consulta' },
        { icon: 'event', text: 'Fecha inicio problema' },
        { icon: 'history', text: 'Antecedentes personales' },
        { icon: 'family_restroom', text: 'Antecedentes familiares' },
        { icon: 'healing', text: 'Tratamientos previos' },
        { icon: 'medication', text: 'Medicación actual' },
        { icon: 'coronavirus', text: 'Alergias' },
        { icon: 'fitness_center', text: 'Hábitos de vida' },
        { icon: 'work', text: 'Profesión' }
    ],
    evaluacion: [
        { icon: 'location_on', text: 'Localización dolor' },
        { icon: 'speed', text: 'Intensidad dolor' },
        { icon: 'psychology', text: 'Tipo dolor' },
        { icon: 'wifi_tethering', text: '¿Irradia? Sí/No' },
        { icon: 'description', text: 'Descripción' },
        { icon: 'visibility', text: 'Inspección visual' },
        { icon: 'touch_app', text: 'Palpación' },
        { icon: 'directions_run', text: 'Movilidad articular' },
        { icon: 'accessibility_new', text: 'Pruebas funcionales' },
        { icon: 'psychology_alt', text: 'Valoración neurológica' },
        { icon: 'rule', text: 'Evaluación funcional' },
        { icon: 'medical_information', text: 'Diagnóstico' },
        { icon: 'flag', text: 'Objetivos terapéuticos' }
    ],
    tratamiento: [
        { icon: 'event', text: 'Fecha inicio' },
        { icon: 'event_busy', text: 'Duración / fecha fin' },
        { icon: 'manufacturing', text: 'Técnicas utilizadas' },
        { icon: 'schedule', text: 'Frecuencia sesiones' },
        { icon: 'timer', text: 'Duración sesiones' },
        { icon: 'thumb_up', text: 'Recomendaciones' },
        { icon: 'local_drink', text: 'Suplementación' },
        { icon: 'event', text: 'Fecha inicio suplementación' },
        { icon: 'inventory_2', text: 'Cápsulas por bote' },
        { icon: 'notification_important', text: 'Días antes para alerta' }
    ],
    sesion: [
        { icon: 'science', text: 'Técnicas utilizadas' },
        { icon: 'insights', text: 'Evolución paciente' },
        { icon: 'autorenew', text: '¿Modif. tratamiento?' },
        { icon: 'comment', text: 'Observaciones' }
    ]
};

/* ---------- campos requeridos por bloque (para resaltar en la guía) ---------- */
const requiredGuide = {
    historial: ['Motivo consulta'],
    evaluacion: ['Localización dolor'],
    tratamiento: ['Fecha inicio', 'Técnicas utilizadas'],
    sesion: ['Técnicas utilizadas']
};

function showGuide(block) {
    $id('modalTitle').textContent = block.toUpperCase();
    const req = requiredGuide[block] || [];
    $id('modalList').innerHTML = guide[block]
        .map(it => {
            const cls = req.includes(it.text) ? ' class="required"' : '';
            return `<li${cls}><span class="material-symbols-outlined">${it.icon}</span> ${it.text}</li>`;
        })
        .join('');
    $id('modalGuide').style.display = 'flex';
}
function hideGuide() { $id('modalGuide').style.display = 'none'; }

/* ------------------------------------------------ control de tiempo de grabación ------------------------------------ */
const maxBlockMs = 80 * 60 * 1000;   /* 80 minutos en milisegundos           */
let blockTimer = null;             /* id devuelto por setTimeout           */
let exceeded = false;            /* true si se superó el tiempo          */
let manualCancel = false;            /* true si el usuario pulsa “Cancelar”  */

/* ---- helpers modal timeout (Cancelar / Enviar) ---- */
function showTimeoutModal() { $id('modalTimeout').style.display = 'flex'; }
function hideTimeoutModal() { $id('modalTimeout').style.display = 'none'; }

/* cerrar tocando fuera de la tarjeta */
$id('modalTimeout').addEventListener('click', e => {
    if (e.target.id === 'modalTimeout') hideTimeoutModal();
});

/* botones dentro del modal (tope 80 min) */
$id('btnCancel').onclick = () => {
    hideTimeoutModal();
    log.insertAdjacentHTML('beforeend',
        '<div class="feedback error">❌ Grabación cancelada (excedía 80&nbsp;min)</div>');
    chatChanged = true;
    log.scrollTop = log.scrollHeight;
};
$id('btnSend').onclick = () => {
    hideTimeoutModal();
    exceeded = false;          /* permite continuar */
    sendBlock();               /* relanza envío      */
};

/* ------------------------------------------------ botón Cancelar en modal-guía -------------------------------------- */
function cancelGuideRecording() {
    if (rec) {
        manualCancel = true;                /* marcar cancelación manual */
        clearTimeout(blockTimer);
        recorder.stop();                    /* disparará sendBlock()     */
        rec = false;
        btnRec.classList.remove('recording');
        resetScreensaverTimer();
    }
    hideGuide();
}
$id('btnGuideCancel').onclick = cancelGuideRecording;

/* -------- aceptar desde modal-guía -------- */
function saveGuideRecording() {
    if (rec) {
        clearTimeout(blockTimer);
        recorder.stop();
        rec = false;
        btnRec.classList.remove('recording');
        resetScreensaverTimer();
    }
    hideGuide();
}
$id('btnGuideSave').onclick = saveGuideRecording;

/* ------------------------------------------------ carga inicial de la ficha ----------------------------------------- */
async function loadSession() {
    const main = $id('mainData');
    try {
        const data = await (await fetch('/api/session/info')).json();
        if (!data.user || !data.patient) { main.textContent = '❌ Sesión no válida'; return; }
        $id('profName').textContent = data.user.nombre;
        $id('pacName').textContent = data.patient.nombre + ' ' + data.patient.apellidos;

        /* ---- ocultar chip Historial si ya existe ---- */
        const chipHist = $id('chipHist');
        if (data.historial) {
            chipHist.classList.add('hidden');
            if (currentBlock === 'historial') {                       /* cambiamos chip activo */
                currentBlock = 'evaluacion';
                document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                $id('chipEval').classList.add('active');
            }
        } else {
            chipHist.classList.remove('hidden');
        }

        /* ---- construir HTML de detalles ---- */
        let html = '', p = data.patient, h = data.historial;
        html += title('account_circle', 'Datos personales');
        html += `<dl>
          ${row('<span class="material-icons-outlined">login</span> Alta', fDate(p.fecha_registro))}
          ${row('<span class="material-symbols-outlined">fingerprint</span> ID', p.id_paciente)}
          ${row('<span class="material-symbols-outlined">shield_person</span> LOPD', p.lopd_estado === 'firmado' ? '✅' : '❌')}
          ${row('<span class="material-symbols-outlined">early_on</span> Nacim.', fDate(p.fecha_nacimiento))}
          ${row('<span class="material-symbols-outlined">transgender</span> Género', p.genero)}
          ${row('<span class="material-symbols-outlined">id_card</span> DNI', p.dni)}
          ${row('<span class="material-symbols-outlined">mobile_hand</span> Teléfono', p.telefono)}
          ${row('<span class="material-symbols-outlined">send</span>  Email', p.email)}
          ${row('<span class="material-symbols-outlined">home_pin</span> Dirección', p.direccion)}</dl>`;
        if (h) {
            html += title('medical_services', 'Historial clínico');
            html += `<dl>${row('<span class="material-symbols-outlined">psychology</span> Motivo', h.motivo_consulta)}${row('<span class="material-symbols-outlined">event</span> Inicio', fDate(h.fecha_inicio_problema))}
                    ${row('<span class="material-symbols-outlined">history</span> Anteced.', h.antecedentes_personales)}${row('<span class="material-symbols-outlined">family_restroom</span> Ant. fam.', h.antecedentes_familiares)}${row('<span class="material-symbols-outlined">healing</span> Trat. prev.', h.tratamientos_previos)}
                    ${row('<span class="material-symbols-outlined">medication</span> Medicación', h.medicacion_actual)}${row('<span class="material-symbols-outlined">coronavirus</span> Alergias', h.alergias)}
                    ${row('<span class="material-symbols-outlined">fitness_center</span> Hábitos', h.habitos_vida)}${row('<span class="material-symbols-outlined">work</span> Profesión', h.profesion)}</dl>`;
        }

        if (data.evaluacion) {
            const e = data.evaluacion;
            html += title('fact_check', 'Última evaluación');
            html += `<dl>${row('<span class="material-icons-outlined">badge</span> Profesional', e.prof_nombre)}${row('<span class="material-symbols-outlined">event</span> Fecha', fDate(e.fecha_evaluacion))}
               ${row('<span class="material-symbols-outlined">location_on</span> Loc. dolor', e.dolor_localizacion)}${row('<span class="material-symbols-outlined">speed</span> Intensidad', e.dolor_intensidad)}
               ${row('<span class="material-symbols-outlined">psychology</span> Tipo dolor', e.dolor_tipo)}${row('<span class="material-symbols-outlined">wifi_tethering</span> Irradia', e.dolor_irradia ? 'Sí' : 'No')}
               ${row('<span class="material-symbols-outlined">description</span> Descrip.', e.dolor_descripcion)}${row('<span class="material-symbols-outlined">visibility</span> Insp. visual', e.inspeccion_visual)}
               ${row('<span class="material-symbols-outlined">touch_app</span> Palpación', e.palpacion)}${row('<span class="material-symbols-outlined">directions_run</span> Mov. artic.', e.movilidad_articular)}
               ${row('<span class="material-symbols-outlined">accessibility_new</span> Prueb. func.', e.pruebas_funcionales)}${row('<span class="material-symbols-outlined">psychology_alt</span> Val. neuro.', e.valoracion_neurologica)}
               ${row('<span class="material-symbols-outlined">straighten</span> Val. post.', e.valoracion_postural)}${row('<span class="material-symbols-outlined">rule</span> Val. func.', e.evaluacion_funcional)}
               ${row('<span class="material-symbols-outlined">medical_information</span> Diagnóstico', e.diagnostico)}${row('<span class="material-symbols-outlined">flag</span> Obj. terap.', e.objetivos_terapeuticos)}</dl>`;
        }

        if (data.tratamiento) {
            const t = data.tratamiento;
            html += title('sign_language', 'Último tratamiento');
            html += `<dl>${row('<span class="material-icons-outlined">badge</span> Profesional', t.prof_nombre)}
               ${row('<span class="material-symbols-outlined">event</span> Inicio', fDate(t.fecha_inicio))}
               ${row('<span class="material-symbols-outlined">event_busy</span> Fin', fDate(t.fecha_fin))}
               ${row('<span class="material-symbols-outlined">manufacturing</span> Técnicas', t.tecnicas_aplicadas)}
               ${row('<span class="material-symbols-outlined">schedule</span> Frec. sesión', t.frecuencia_sesiones)}
               ${row('<span class="material-symbols-outlined">timer</span> Dur. sesión', t.duracion_sesion)}
               ${row('<span class="material-symbols-outlined">thumb_up</span> Recomend.', t.recomendaciones)}
               ${row('<span class="material-symbols-outlined">fact_check</span> Estado', t.estado)}
               ${row('<span class="material-symbols-outlined">local_drink</span> Suplemento', t.suplemento_prescrito || 'No')}
               ${row('<span class="material-symbols-outlined">inventory_2</span> Caps. x bote', t.capsulas_por_bote)}
               ${row('<span class="material-symbols-outlined">format_list_numbered</span> Dosis diaria', t.dosis_diaria)}
               ${row('<span class="material-symbols-outlined">event</span> Ini. suplem.', fDate(t.fecha_inicio_suplementacion))}
               ${row('<span class="material-symbols-outlined">notification_important</span> Alert. supl.', t.dias_alerta)}</dl>`;
        }

        if (data.sesion) {
            const s = data.sesion;
            html += title('event', 'Última sesión');
            html += `<dl>${row('<span class="material-icons-outlined">badge</span> Profesional', s.prof_nombre)}
               ${row('<span class="material-symbols-outlined">event</span> Fecha', fDate(s.fecha_sesion) + ' ' + fTime(s.hora_sesion))}
               ${row('<span class="material-symbols-outlined">manufacturing</span> Técnicas', s.tecnicas_utilizadas)}${row('<span class="material-symbols-outlined">insights</span> Evolución', s.evolucion)}
               ${row('<span class="material-symbols-outlined">autorenew</span> Mod. trat.', s.modificaciones_tratamiento)}${row('<span class="material-symbols-outlined">comment</span> Observac.', s.observaciones)}
               ${row('<span class="material-symbols-outlined">redeem</span> Bono', s.id_bono)}</dl>`;
        }

        main.innerHTML = html;
    } catch (e) { console.error(e); main.textContent = 'Error cargando datos'; }
}
loadSession();

/* ------------------------------------------------ selector de bloque ------------------------------------------------ */
document.querySelectorAll('.chip').forEach(btn => {
    btn.onclick = () => {
        if (btn.classList.contains('hidden')) return;      /* ignorar chip oculto */
        document.querySelector('.chip.active')?.classList.remove('active');
        btn.classList.add('active');
        currentBlock = btn.dataset.block;
    };
});

/* ------------------------------------------------ grabación --------------------------------------------------------- */
const btnRec = $id('btnRecord'), log = $id('log');
const btnSaveChat = $id('btnSaveChat');
const btnResumen = $id('btnResumen');
const btnContrato = $id('btnContrato');
const btnPuncion = $id('btnPuncion');
const btnSuelo = $id('btnSuelo');
const btnReload = $id('btnReload');
const updateSaveBtn = () => {
    const show = log.childElementCount ? 'block' : 'none';
    btnSaveChat.style.display = show;
    btnReload.style.display = show;
};
updateSaveBtn();
new MutationObserver(updateSaveBtn).observe(log, { childList: true });
let rec = false, recorder, chunks = [];

btnRec.onclick = async () => {
    if (!rec) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 1) elegimos MIME según soporte
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
        } else {
            options.mimeType = 'video/mp4';
        }

        // 2) creamos recorder con timeslice de 1 s
        recorder = new MediaRecorder(stream, options);
        chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = sendBlock;
        recorder.start(1000);

        // … resto idéntico …
        rec = true;
        manualCancel = false;
        btnRec.classList.add('recording');
        hideScreensaver();              /* evita salvapantallas durante grabación */
        clearTimeout(ssTimer);
        showGuide(currentBlock);

        exceeded = false;
        blockTimer = setTimeout(() => {
            if (rec) { exceeded = true; btnRec.click(); }
        }, maxBlockMs);

    } else {
        // parada normal, igual que antes
        clearTimeout(blockTimer);
        recorder.stop();
        rec = false;
        btnRec.classList.remove('recording');
        resetScreensaverTimer();
    }
};

/* ------------------------------------------------ feedback / loader -------------------------------------------------- */
function addLoader() {
    log.insertAdjacentHTML('beforeend', '<div class="loader" id="spin">Procesando…</div>');
    chatChanged = true;
    log.scrollTop = log.scrollHeight;
}
const removeLoader = () => { $id('spin')?.remove(); };

/* -------------------- guardar adjunto permanente -------------------- */
log.addEventListener('click', async e => {
    if (!e.target.classList.contains('btnSaveAttach')) return;

    const btn = e.target;
    const wrapper = btn.closest('.attach');
    const tmpName = btn.dataset.tmp;
    if (!tmpName) return;

    btn.disabled = true;
    btn.textContent = '⏳';

    try {
        const r = await fetch('/api/assistant/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tmpName }),
            credentials: 'include'
        });
        const j = await safeJson(r);
        if (!j.ok) throw new Error(j.error || 'Error');

        wrapper.classList.remove('success');
        wrapper.classList.add('info');
        btn.remove();                         // ya no hace falta el pin
        wrapper.insertAdjacentHTML(
            'beforeend',
            `<div style="margin-top:4px">✅ Guardado</div>`
        );
    } catch (err) {
        btn.disabled = false;
        btn.textContent = '📌';
        alert('No se pudo guardar: ' + err.message);
    }
});


/* ------------------------------------------------ envío del bloque --------------------------------------------------- */
async function sendBlock() {
    hideGuide();
    clearTimeout(blockTimer);

    /* cancelación manual desde el modal-guía */
    if (manualCancel) {
        manualCancel = false;
        chunks = [];                       /* ignoramos audio */
        log.insertAdjacentHTML('beforeend',
            '<div class="feedback error">❌ Grabación cancelada</div>');
        chatChanged = true;
        log.scrollTop = log.scrollHeight;
        return;
    }

    /* se excedió el tiempo: mostrar modal decidir */
    if (exceeded) {
        showTimeoutModal();
        return;
    }

    addLoader();
    // 1) obtenemos MIME y extensión
    const mime = recorder.mimeType || 'audio/webm';
    const ext = mime.includes('mp4') ? '.mp4' : '.webm';

    // 2) construimos blob+form con la extensión correcta
    const blob = new Blob(chunks, { type: mime });
    const form = new FormData();
    form.append('audio', blob, 'bloque' + ext);
    form.append('block', currentBlock);

    try {
        const r = await fetch('/api/blocks/upload', { method: 'POST', body: form });
        const j = await safeJson(r); removeLoader();

        log.insertAdjacentHTML('beforeend',
            `<div class="feedback ${j.ok ? 'success' : 'error'}">${j.ok ? j.message : j.error}</div>`);
        chatChanged = true;
        log.scrollTop = log.scrollHeight;

        if (j.ok) loadSession();
    } catch (e) {
        removeLoader();
        log.insertAdjacentHTML('beforeend', '<div class="feedback error">Error de red</div>');
        chatChanged = true;
        log.scrollTop = log.scrollHeight;
    }
}

/* ------------------------------------------------ botón HABLAR (voz ↔ assistant) ---------------------------------- */
const btnTalk = $id('btnTalk');
const btnStop = $id('btnStopTTS');     // mismo botón sirve para “parar voz / cancelar”
const btnModelO3 = $id('btnModelO3');

let useModelO3 = false;

let talking = false;                // ¿estamos grabando pregunta?
let recVoice, chunksVoice = [];
let currentAudio = null;                // reproducción TTS activa

/* --- voz española “femenina” si existe --- */
function getVoiceES() {
    const v = speechSynthesis.getVoices();
    return v.find(x => /^es(-|$)/i.test(x.lang) && /female|mujer|woman/i.test(x.name))
        || v.find(x => /^es(-|$)/i.test(x.lang))
        || null;
}

/* ---------- helpers TTS ---------- */
function playTTS(url) {
    currentAudio?.pause();                // detén la que hubiera
    currentAudio = new Audio(url);
    btnStop.style.display = 'flex';
    btnStop.textContent = 'Parar';        // cambia etiqueta a "Parar"

    currentAudio.addEventListener('ended', cleanupTTS);
    currentAudio.addEventListener('pause', cleanupTTS);
    currentAudio.addEventListener('error', cleanupTTS);

    currentAudio.play().catch(console.error);
}
function cleanupTTS() {
    if (!currentAudio) return;
    fetch(currentAudio.src, { method: 'DELETE' });   // lo borras del servidor
    currentAudio = null;
    btnStop.style.display = talking ? 'flex' : 'none';
    if (talking) btnStop.textContent = 'Cancel';
}

/* ---------- cancelar GRABACIÓN ---------- */
function cancelRecording() {
    if (!talking) return;
    recVoice.stop();                      // onstop no enviará nada
    talking = false;
    btnTalk.classList.remove('talking');
    btnStop.style.display = 'none';
    hideAssistantImg();

    log.insertAdjacentHTML(
        'beforeend',
        '<div class="feedback error">❌ Pregunta cancelada</div>'
    );
    chatChanged = true;
    log.scrollTop = log.scrollHeight;
}

/* ---------- botón STOP (voz / grabación) ---------- */
btnStop.onclick = () => {
    if (currentAudio) {        // se está oyendo la respuesta  → parar voz
        currentAudio.pause();
    } else {                   // estamos grabando            → cancelar
        cancelRecording();
    }
    hideAssistantImg();
};

/* patrón común de confirmación */
const confRE = /(operaci[oó]n|actualizaci[oó]n|registrad[oa]).*correctamente/i;

/* ---------- click HABLAR (voz ↔ assistant) ---------- */
btnTalk.onclick = async () => {
    if (!talking) {  // ─ EMPEZAR ─
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 1. elegir mimeType
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
        } else {
            options.mimeType = 'video/mp4';
        }

        recVoice = new MediaRecorder(stream, options);
        chunksVoice = [];
        recVoice.ondataavailable = e => chunksVoice.push(e.data);
        recVoice.start(1000);            // 2. timeslice 1s

        talking = true;
        showAssistantImg();
        btnTalk.classList.add('talking');
        btnStop.style.display = 'flex';
        btnStop.textContent = 'Cancel';
        hideScreensaver();                  /* evita salvapantallas */
        clearTimeout(ssTimer);
    } else {       // ─ DETENER ─
        recVoice.stop();
        talking = false;
        btnTalk.classList.remove('talking');
        hideAssistantImg();
        resetScreensaverTimer();

        recVoice.onstop = async () => {
            // 3. determinar extensión según mimeType
            const mime = recVoice.mimeType || 'audio/webm';
            const ext = mime.includes('mp4') ? '.mp4' : '.webm';
            const blob = new Blob(chunksVoice, { type: mime });
            const form = new FormData();
            form.append('audio', blob, 'pregunta' + ext);
            if (useModelO3) {
                form.append('model', 'o3');
                form.append('noSearch', 'true');
            }

            ensureLoader();  // spinner
            try {
                if (useModelO3) {
                    const r = await fetch('/api/assistant/voice', {
                        method: 'POST',
                        credentials: 'include',
                        body: form
                    });
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Error desconocido');

                    if (j.question) {
                        log.insertAdjacentHTML(
                            'beforeend',
                            `<div class="feedback msg-user">${linkify(j.question)}</div>`
                        );
                        chatChanged = true;
                    }
                    await handleAssistantResponse(j);
                } else {
                    await sendVoiceStream(form);
                }

            } catch (err) {
                removeLoader();
                log.insertAdjacentHTML(
                    'beforeend',
                    `<div class="feedback error">${linkify(err.message)}</div>`
                );
            } finally {
                if (!currentAudio) btnStop.style.display = 'none';
            }
        };
    }
};

$id('btnHome').onclick = () => location.href = '/inicio-consulta.html';

const inpMsg = $id('txtMessage');

$id('btnKeyboard').onclick = () => {
    modalAsk.style.display = 'flex';  // abre modal
    inpMsg.focus();                   // cursor en el textarea
};

modalAsk.addEventListener('click', e => {
    if (e.target.id === 'modalAsk') modalAsk.style.display = 'none';
});

btnModelO3.onclick = () => {
    useModelO3 = !useModelO3;
    btnModelO3.classList.toggle('active', useModelO3);
};

// ---------- enviar texto al asistente ----------
async function sendText(msg) {
    msg = msg.trim();
    if (!msg) return;

    inpMsg.value = '';
    autoGrow(inpMsg);
    modalAsk.style.display = 'none';

    log.insertAdjacentHTML(
        'beforeend',
        `<div class="feedback msg-user">${linkify(msg)}</div>`
    );
    chatChanged = true;
    log.scrollTop = log.scrollHeight;

    try {
        const body = buildAssistantBody(msg);
        if (useModelO3) await sendToAssistant(body);
        else await sendToAssistantStream(body);
    } catch (err) {
        safeRemoveLoader();
        log.insertAdjacentHTML(
            'beforeend',
            `<div class="feedback error">${linkify(err.message)}</div>`
        );
        chatChanged = true;
        log.scrollTop = log.scrollHeight;
    } finally {
        if (!currentAudio) btnStop.style.display = 'none';
    }
}

/* ---------- auto-grow del <textarea> (sin scroll interno) ---------- */
const autoGrow = el => {
    el.style.height = 'auto';               // reset
    el.style.height = (el.scrollHeight + 2) + 'px';
};

/* ---------- entrada por teclado ---------- */
inpMsg.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText(inpMsg.value);
    } else {
        setTimeout(() => autoGrow(inpMsg), 0);
    }
});

btnSendTxt.onclick = () => sendText(inpMsg.value);

/* ---------- GUARDAR / ACTUALIZAR EL CHAT ---------- */
$id('btnSaveChat').onclick = async () => {

    /* 2.1 – Nada que guardar */
    if (!chatChanged) {
        Swal.fire({
            icon: 'info',
            title: 'Sin cambios',
            text: 'No has hecho ninguna modificación desde el último guardado',
            confirmButtonColor: '#276040'
        });
        return;
    }

    /* 2.2 – Preparamos cuerpo y método */
    const body = { conversation: serializeChat() };
    if (activeChatId) body.id_chat = activeChatId;

    try {
        const r = await fetch('/api/chats/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const j = await safeJson(r);
        if (!j.id_chat && !j.ok) throw new Error(j.error || 'Error');

        activeChatId = activeChatId || j.id_chat;
        chatChanged = false;

        /* 2.3 – ÉXITO */
        Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'La conversación se ha almacenado correctamente',
            confirmButtonColor: '#276040',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (err) {
        /* 2.4 – ERROR */
        Swal.fire({
            icon: 'error',
            title: 'Ups…',
            text: err.message || 'Error al guardar el chat',
            confirmButtonColor: '#a12525'
        });
    }
};

/* ---------- RESUMEN DETALLADO DEL PACIENTE ---------- */
$id('btnResumen').onclick = () => {
    sendText('Haz un resumen detallado del paciente');
    btnResumen.style.display = 'none';
};

/* ---------- DOCUMENTO DE CONSENTIMIENTO ---------- */
$id('btnContrato').onclick = () => {
    sendText('Crea documento para este paciente para recibir tratamiento de Ostio y Fisio');
    btnContrato.style.display = 'none';
};

/* ---------- DOCUMENTO DE PUNCIÓN SECA ---------- */
$id('btnPuncion').onclick = () => {
    sendText('Crea documento para este paciente para recibir tratamiento de Punción Seca');
    btnPuncion.style.display = 'none';
};

/* ---------- DOCUMENTO DE SUELO PÉLVICO ---------- */
$id('btnSuelo').onclick = () => {
    sendText('Crea documento para esta pacienta para recibir tratamiento de Suelo Pélvico');
    btnSuelo.style.display = 'none';
};

/* ---------- RECARGAR LA PÁGINA ---------- */
$id('btnReload').onclick = () => {
    location.reload(true);
};

/* =======================  SUBIDA DE ARCHIVOS  ======================= */
const picker = $id('filePicker');
const btnPlus = $id('btnUpload');

btnPlus.onclick = () => picker.click();

function addAttachmentToLog({ fileName, tmpName, isImg }) {
    const url = `${location.origin}/tmp/${tmpName}`;
    const iconProbe = `<span class="probe" data-url="${url}" title="Analizar">🔍</span>`;
    const iconResearch = `&nbsp;<span class="research" data-url="${url}" title="Análisis técnico">🔬</span>`;
    const html = `
    <div class="feedback success attach" data-tmp="${tmpName}">
      <button class="btnSaveAttach" data-tmp="${tmpName}"
              title="Guardar en ficha del paciente">📌</button>
      ${fileName} adjuntado
      ${iconProbe}${iconResearch}
      ${isImg ? `<br><img src="/tmp/${tmpName}" class="thumb">` : ''}
    </div>`;
    log.insertAdjacentHTML('beforeend', html);
    chatChanged = true;
    log.scrollTop = log.scrollHeight;
}

picker.onchange = async () => {
    if (!picker.files.length) return;

    for (const file of picker.files) {
        try {
            /* ---- 1.a – enviamos a /tmp ---- */
            const form = new FormData();
            form.append('files', file, file.name);

            const r = await fetch('/api/files/tmp/upload', {
                method: 'POST',
                body: form,
                credentials: 'include'
            });
            const j = await r.json();
            if (!j.files?.length) throw new Error('Falló la subida');

            const tmpName = typeof j.files[0] === 'object'
                ? j.files[0].filename
                : j.files[0];

            /* ---- 1.b – registramos en backend ---- */
            const r2 = await fetch('/api/assistant/files/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tmpName, origName: file.name }),
                credentials: 'include'
            });
            const j2 = await r2.json();
            if (!j2.ok) throw new Error(j2.error || 'Error registrando archivo');

            /* ---- 1.c – si es imagen la añadimos al array vision ---- */
            if (j2.kind === 'image') {
                window.sessionImages.push(`${location.origin}/tmp/${tmpName}`);
                if (window.sessionImages.length > 5) window.sessionImages.shift(); // límite 5
            }

            /* ---- 1.d – feedback + pin ---- */
            addAttachmentToLog({
                fileName: file.name,
                tmpName,
                isImg: /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name)
            });

            chatChanged = true;
            log.scrollTop = log.scrollHeight;

        } catch (err) {
            log.insertAdjacentHTML(
                'beforeend',
                `<div class="feedback error">${err.message}</div>`
            );
            chatChanged = true;
            log.scrollTop = log.scrollHeight;
        }
    }
    picker.value = '';          // reset
};

/* ─── Finalizar chat si se abandona la página ─── */
window.addEventListener('beforeunload', () => {
    /* Solo si hay un chat abierto */
    if (activeChatId !== null) {
        /* Serializamos lo que haya en pantalla */
        const payload = {
            id_chat: activeChatId,
            conversation: serializeChat(),
            finalizar: true
        };

        /* sendBeacon ⇒ dispara en segundo plano sin bloquear la salida */
        navigator.sendBeacon(
            '/api/chats/save',
            new Blob([JSON.stringify(payload)], { type: 'application/json' })
        );
    }
});

/* ─── Screensaver por inactividad ─── */
const screensaverDelay = 120000; // 2 minutos
const screensaver = document.getElementById('screensaver');
const ssImages = [
    'images/wall01.jpg',
    'images/wall02.jpg',
    'images/wall03.jpg',
    'images/wall04.jpg',
    'images/wall05.jpg',
    'images/wall06.jpg',
    'images/wall07.jpg',
    'images/wall08.jpg',
    'images/wallpaper.jpg'
];
const ssElems = ssImages.map(src => {
    const img = new Image();
    img.src = src;
    screensaver.appendChild(img);
    return img;
});
let ssIndex = 0, ssInterval, ssTimer;

function showScreensaver() {
    screensaver.style.display = 'block';
    ssIndex = Math.floor(Math.random() * ssElems.length);
    ssElems.forEach((img, i) => img.classList.toggle('active', i === ssIndex));
    ssInterval = setInterval(() => {
        let next;
        do { next = Math.floor(Math.random() * ssElems.length); } while (next === ssIndex);
        ssIndex = next;
        ssElems.forEach((img, i) => img.classList.toggle('active', i === ssIndex));
    }, 5000);
}

function hideScreensaver() {
    screensaver.style.display = 'none';
    clearInterval(ssInterval);
}

function resetScreensaverTimer() {
    clearTimeout(ssTimer);
    hideScreensaver();
    ssTimer = setTimeout(showScreensaver, screensaverDelay);
}

['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetScreensaverTimer, { passive: true });
});

resetScreensaverTimer();