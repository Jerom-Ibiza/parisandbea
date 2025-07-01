const $ = id => document.getElementById(id);
const modalAg = $('modalAg');
const logAg = $('agLog');
const logAgMsgs = $('agMsgs');
const inpAg = $('agInput');
const btnSendAg = $('btnAgSend');
const btnTalkAg = $('btnAgTalk');
const btnStopAg = $('btnAgStop');
const btnCloseAg = $('btnAgClose');
const btnOkAg = $('btnAgOk');
const inpSearchAg = $('agSearch');
const resSearchAg = $('agResults');
const btnAgCitasHoy = $('btnAgCitasHoy');
const btnAgCitasSemana = $('btnAgCitasSemana');
const chkAgTextOnly = $('chkAgTextOnly');

let selectedPatient = null;

let recAg, chunksAg = [];
let talkingAg = false;
let manualCancelAg = false;
let currentAudio = null;
let typingAg;

function showAgendatorImg() {
    if ($('agendatorOverlay')) return;
    const img = new Image();
    img.id = 'agendatorOverlay';
    img.src = 'images/recursos/agendator.png';
    img.className = 'agendator-overlay';
    const panel = modalAg.querySelector('.panel');
    (panel || modalAg).appendChild(img);
    const reveal = () => requestAnimationFrame(() => img.classList.add('show'));
    if (img.complete) reveal();
    else img.onload = reveal;
}

function hideAgendatorImg() {
    const img = $('agendatorOverlay');
    if (!img) return;
    img.classList.remove('show');
    img.addEventListener('transitionend', () => img.remove(), { once: true });
}

const linkify = txt => {
    const processLine = line =>
        line.replace(/(https?:\/\/[^\s]+)/g, url => {
            const isImg = /\.(jpe?g|png|webp|gif|bmp|svg|heic)$/i.test(url);
            const isStored = /\/attachments_consulta\//i.test(url);
            const isTmp = /\/tmp\//i.test(url);
            const showProbe = isTmp;
            const showPin = isTmp && !isImg;
            const iconProbe = showProbe ? `<span class="probe" data-url="${url}" title="Analizar">🔍</span>` : '';
            const iconResearch = showProbe ? `&nbsp;<span class="research" data-url="${url}" title="Análisis técnico">🔬</span>` : '';
            const iconPin = showPin ? `<button class="btnSaveAttach" data-tmp="${url.split('/').pop()}" title="Guardar">📌</button>` : '';

            if (isImg) {
                return `<div class="thumb-wrap">${iconPin}<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="thumb" /></a>${iconProbe}${iconResearch}</div>`;
            }
            return `<div class="file-wrap">${iconPin}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${iconProbe}${iconResearch}</div>`;
        });

    return txt.split(/\n+/).map(processLine).join('<br>');
};

function playTTS(url) {
    if (chkAgTextOnly?.checked) return;
    currentAudio?.pause();
    currentAudio = new Audio(url);
    currentAudio.addEventListener('ended', cleanup);
    currentAudio.addEventListener('pause', cleanup);
    currentAudio.play().catch(() => { });
    btnStopAg.style.display = 'flex';
}
function cleanup() {
    if (!currentAudio) return;
    fetch(currentAudio.src, { method: 'DELETE' });
    currentAudio = null;
    btnStopAg.style.display = talkingAg ? 'flex' : 'none';
}

btnStopAg.onclick = () => {
    if (currentAudio) { currentAudio.pause(); return; }
    if (talkingAg) {
        manualCancelAg = true;                 // marcar cancelación manual
        recAg.stop();                          // onstop no enviará nada
        talkingAg = false;
        btnTalkAg.classList.remove('talking');
        btnStopAg.style.display = 'none';
    }
};

$('btnOpenAg').onclick = () => {
    modalAg.style.display = 'flex';
    requestAnimationFrame(() => {
        inpAg.blur();
        inpSearchAg.focus();
    });
    resSearchAg.style.display = 'none';
};
btnCloseAg.onclick = () => { modalAg.style.display = 'none'; hideAgendatorImg(); };
btnOkAg.onclick = () => { modalAg.style.display = 'none'; hideAgendatorImg(); };
modalAg.addEventListener('click', e => {
    if (e.target.id === 'modalAg') {
        modalAg.style.display = 'none';
        resSearchAg.style.display = 'none';
        hideAgendatorImg();
    }
});

btnSendAg.onclick = () => sendText(inpAg.value);

inpAg.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(inpAg.value); } });

inpSearchAg.addEventListener('input', () => {
    clearTimeout(typingAg);
    const q = inpSearchAg.value.trim();
    if (!q) { resSearchAg.style.display = 'none'; return; }
    typingAg = setTimeout(() => fetchSearch(q), 300);
});

async function fetchSearch(q) {
    try {
        const r = await fetch('/api/voice/suggest?q=' + encodeURIComponent(q));
        const arr = await r.json();
        resSearchAg.innerHTML = arr.map(p => `<div data-id="${p.id_paciente}">${p.nombre} ${p.apellidos} ${p.dni ? ('(' + p.dni + ')') : ''}</div>`).join('');
        resSearchAg.style.display = 'block';
    } catch { }
}

resSearchAg.addEventListener('click', e => {
    const div = e.target.closest('div[data-id]');
    if (!div) return;
    selectedPatient = Number(div.dataset.id);
    inpSearchAg.value = div.textContent;
    resSearchAg.style.display = 'none';
});

async function sendText(msg) {
    msg = msg.trim();
    if (!msg) return;
    inpAg.value = '';
    logAgMsgs.insertAdjacentHTML('beforeend', `<div class="feedback msg-user">${linkify(msg)}</div>`);
    logAg.scrollTop = logAg.scrollHeight;
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, id_paciente: selectedPatient }), credentials: 'include' };
    const r = await fetch('/api/agendator/chat-stream', opts);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    const div = document.createElement('div');
    div.className = 'feedback msg-assist';
    logAgMsgs.appendChild(div);
    logAg.scrollTop = logAg.scrollHeight;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
            if (!chunk) continue;
            if (chunk.startsWith('event:')) {
                const lines = chunk.split('\n');
                const ev = lines[0].slice(6).trim();
                const data = (lines[1] || '').replace(/^data:/, '').trim();
                if (ev === 'audio') playTTS(data);
            } else if (chunk.startsWith('data:')) {
                const txt = chunk.slice(5).replace(/\\n/g, '\n');
                full += txt; div.innerHTML = linkify(full); logAg.scrollTop = logAg.scrollHeight;
            }
        }
    }
}

btnAgTalk.onclick = async () => {
    if (!talkingAg) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options.mimeType = 'audio/webm;codecs=opus';
        else options.mimeType = 'video/mp4';
        recAg = new MediaRecorder(stream, options);
        chunksAg = [];
        manualCancelAg = false;            // arranque limpio
        recAg.ondataavailable = e => chunksAg.push(e.data);
        recAg.onstop = async () => {
            if (manualCancelAg) {
                manualCancelAg = false;
                chunksAg = [];
                logAgMsgs.insertAdjacentHTML('beforeend', '<div class="feedback error">❌ Pregunta cancelada</div>');
                hideAgendatorImg();
                logAg.scrollTop = logAg.scrollHeight;
                return;
            }
            const mime = recAg.mimeType || 'audio/webm';
            const ext = mime.includes('mp4') ? '.mp4' : '.webm';
            const blob = new Blob(chunksAg, { type: mime });
            const form = new FormData();
            form.append('audio', blob, 'ask' + ext);
            form.append('id_paciente', selectedPatient || '');
            const r = await fetch('/api/agendator/voice-stream', { method: 'POST', credentials: 'include', body: form });
            const reader = r.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            let full = '';
            let div = null;
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                let idx;
                while ((idx = buf.indexOf('\n\n')) >= 0) {
                    const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
                    if (!chunk) continue;
                    if (chunk.startsWith('event:')) {
                        const lines = chunk.split('\n');
                        const ev = lines[0].slice(6).trim();
                        const data = (lines[1] || '').replace(/^data:/, '').trim();
                        if (ev === 'question') {
                            logAgMsgs.insertAdjacentHTML('beforeend', `<div class="feedback msg-user">${linkify(data)}</div>`);
                            div = document.createElement('div');
                            div.className = 'feedback msg-assist';
                            logAgMsgs.appendChild(div);
                            logAg.scrollTop = logAg.scrollHeight;
                        } else if (ev === 'audio') {
                            playTTS(data);
                        }
                    } else if (chunk.startsWith('data:')) {
                        const txt = chunk.slice(5).replace(/\\n/g, '\n');
                        full += txt;
                        if (!div) {
                            div = document.createElement('div');
                            div.className = 'feedback msg-assist';
                            logAgMsgs.appendChild(div);
                        }
                        div.innerHTML = linkify(full);
                        logAg.scrollTop = logAg.scrollHeight;
                    }
                }
            }
        };
        recAg.start(1000);
        talkingAg = true;
        btnTalkAg.classList.add('talking');
        btnStopAg.style.display = 'flex';
        showAgendatorImg();
    } else {
        talkingAg = false;
        btnTalkAg.classList.remove('talking');
        manualCancelAg = false;          // se envía la grabación
        recAg.stop();
        btnStopAg.style.display = 'none';
        hideAgendatorImg();
    }
};

btnAgCitasHoy.onclick = () => {
    sendText('Muéstrame las citas que tengo hoy');
    btnAgCitasHoy.style.display = 'none';
};

btnAgCitasSemana.onclick = () => {
    sendText('Muéstrame las citas que tengo esta semana');
    btnAgCitasSemana.style.display = 'none';
};