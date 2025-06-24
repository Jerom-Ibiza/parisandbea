/* ---------------------------------------------------------------------------
   controllers/assistantVoice.stream.js
   Transcribe audio input y devuelve respuesta en streaming (SSE)
   Modelo por defecto: gpt-4.1-mini
   ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');
const logger = require('../logger');
const ttsOAI = require('../utils/openaiTTS');
const prompt = require('../prompts/assistant.responses');
const { LOCAL_FUNCTIONS } = require('./assistant.functions');
const getTools = require('../utils/getToolSchemas');

const openai = new OpenAI();

/* carpeta temporal para los audios */
const TMP = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const upload = multer({ dest: TMP });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safeUnlink = f => fs.unlink(f, () => { });

function sanitiseHistory(hist) {
    return hist.map(m => {
        if (m.role !== 'user') return m;
        if (typeof m.content !== 'string') return m;
        try {
            const obj = JSON.parse(m.content);
            if (obj?.type === 'function_call') {
                if (typeof obj.arguments !== 'object') {
                    obj.arguments = { __raw: obj.arguments };
                    m.content = JSON.stringify(obj);
                }
            }
        } catch { /* no era JSON */ }
        return m;
    });
}

function buildTools(req, noSearch) {
    const tools = getTools(LOCAL_FUNCTIONS, { web_search: !noSearch });
    if (req.session?.vectorStoreId) {
        tools.push({ type: 'file_search', vector_store_ids: [req.session.vectorStoreId] });
    }
    return tools;
}

exports.handleVoiceStream = [
    upload.single('audio'),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).end('Falta audio');

            /* ----- determina extensión ----- */
            const tmpPath = req.file.path;
            let ext = path.extname(req.file.originalname).toLowerCase();
            if (!ext) {
                const mime = req.file.mimetype;
                if (mime === 'audio/webm') ext = '.webm';
                else if (mime === 'video/mp4') ext = '.mp4';
                else if (mime === 'audio/mp4' || mime === 'audio/x-m4a') ext = '.m4a';
            }
            const realPath = tmpPath + ext;
            fs.renameSync(tmpPath, realPath);

            /* ----- transcripción Whisper ----- */
            const { text } = await openai.audio.transcriptions.create({
                file: fs.createReadStream(realPath),
                model: 'whisper-1',
                language: 'es'
            });
            safeUnlink(realPath);
            logger.info('[voice-stream] texto: ' + text.slice(0, 80) + '…');

            const { model = 'gpt-4.1-mini', noSearch } = req.body || {};
            if (!req.session.user || !req.session.patient)
                return res.status(403).end('Sin sesión válida');

            /* ----- historial en sesión ----- */
            const history = req.session.respHistory || [];
            history.push({
                role: 'user',
                content: [{ type: 'input_text', text }]
            });

            /* ----- cabeceras SSE ----- */
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();

            /* enviamos pregunta transcrita */
            res.write(`event:question\ndata:${text.replace(/\n/g, ' ')}\n\n`);

            /* ----- primera llamada sin streaming (tool_calls) ----- */
            let rsp = await openai.responses.create({
                model,
                instructions: prompt,
                input: sanitiseHistory(history),
                tools: buildTools(req, !!noSearch),
                tool_choice: 'auto'
            });

            for (let step = 0; step < 8; step++) {
                const calls = (rsp.output || []).filter(o => o.type === 'function_call');
                if (!calls.length) break;

                for (const call of calls) {
                    const fn = LOCAL_FUNCTIONS[call.name];
                    if (!fn) continue;

                    let args = {};
                    try { args = JSON.parse(call.arguments || '{}'); }
                    catch { logger.warn('[parseArgs] ' + call.arguments); }

                    let result;
                    try { result = await fn(args, req); }
                    catch (e) { result = { error: e.message }; }

                    history.push({
                        role: 'user',
                        content: `Resultado de ${call.name}: ${JSON.stringify(result)}`
                    });
                }

                rsp = await openai.responses.create({
                    model,
                    instructions: prompt,
                    input: sanitiseHistory(history),
                    tools: buildTools(req, !!noSearch),
                    tool_choice: 'auto'
                });
                await sleep(180);
            }

            /* ----- segunda llamada en streaming ----- */
            const stream = await openai.responses.create({
                model,
                instructions: prompt,
                input: sanitiseHistory(history),
                tool_choice: 'none',
                stream: true
            });

            let fullText = '';

            for await (const event of stream) {
                if (event.type === 'response.text.delta' ||
                    event.type === 'response.output_text.delta') {
                    const chunk = typeof event.delta === 'string'
                        ? event.delta
                        : (event.delta?.text || '');
                    if (!chunk) continue;

                    fullText += chunk;
                    res.write(`data:${chunk.replace(/\n/g, '\\n')}\n\n`);
                }
            }

            /* ----- TTS opcional ----- */
            const shortAck = /^ *((registro|actualizaci[oó]n|historial|evaluaci[oó]n|tratamiento|sesi[oó]n)\s+realizada?\s+correctamente\.?) *$/i
                .test(fullText);
            if (!shortAck && fullText && fullText !== '[Sin respuesta]') {
                try {
                    const voice = (req.session.user?.voz || 'alloy').trim();
                    const mp3Path = await ttsOAI(fullText, voice);
                    const audioUrl = '/tmp/' + path.basename(mp3Path);
                    setTimeout(() => fs.unlink(mp3Path, () => { }), 10 * 60 * 1000);
                    res.write(`event:audio\ndata:${audioUrl}\n\n`);
                } catch (e) { logger.error('[TTS] ' + e.message); }
            }

            history.push({ role: 'assistant', content: fullText });
            req.session.respHistory = history.slice(-30);
            await new Promise(r => req.session.save(r));

            res.write('event:done\ndata:[DONE]\n\n');
            res.end();

        } catch (err) {
            logger.error('[voiceStream] ' + err.stack);
            res.write(`event:error\ndata:${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
];