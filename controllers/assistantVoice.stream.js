/* controllers/assistantVoice.stream.js
   1. Sube el audio (multer)            → 2. Transcribe con Whisper
   3. Envía texto token-a-token (SSE)   → 4. Cuando acaba, genera MP3 y notifica */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const multer = require('multer');

const ttsOAI = require('../utils/openaiTTS');
const logger = require('../logger');
const prompt = require('../prompts/assistant.responses');
const getTools = require('../utils/getToolSchemas');
const { LOCAL_FUNCTIONS } = require('./assistant.functions');

const openai = new OpenAI();

/* --- tmp + Multer --- */
const TMP = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
const upload = multer({ dest: TMP });

/* --- helpers --- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const buildTools = req => {
    const tools = getTools(LOCAL_FUNCTIONS, { web_search: true });
    if (req.session?.vectorStoreId) {
        tools.push({
            type: 'file_search',
            vector_store_ids: [req.session.vectorStoreId]
        });
    }
    return tools;
};

/* ---------- POST /api/assistant/voice-stream ---------- */
exports.voiceStream = [
    upload.single('audio'),
    async (req, res) => {
        try {
            /* 1· audio obligatorio */
            const audio = req.file;
            if (!audio) return res.status(400).end('Falta audio');

            /* 2· transcripción Whisper */
            const { text = '' } = await openai.audio.transcriptions.create({
                file: fs.createReadStream(audio.path),     // :contentReference[oaicite:0]{index=0}
                model: 'whisper-large-v3',                 // :contentReference[oaicite:1]{index=1}
                language: 'es'
            });
            const question = text.trim() || '[sin transcripción]';

            /* 3· cabeceras SSE (sin buffering nginx) */
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');        // :contentReference[oaicite:2]{index=2}
            res.flushHeaders();

            /* 4· enviamos la transcripción al cliente */
            res.write(`event:transcript\ndata:${question}\n\n`);

            /* 5· llamada Responses API en streaming */
            const stream = await openai.responses.create({
                model: 'gpt-4.1-mini',
                instructions: prompt,
                input: [{
                    role: 'user',
                    content: [{ type: 'input_text', text: question }]
                }],
                tools: buildTools(req),
                tool_choice: 'auto',
                stream: true                                 // :contentReference[oaicite:3]{index=3}
            });

            let full = '';
            for await (const ev of stream) {               // :contentReference[oaicite:4]{index=4}
                if (ev.type === 'response.text.delta'
                    || ev.type === 'response.output_text.delta') {
                    const chunk = typeof ev.delta === 'string'
                        ? ev.delta
                        : (ev.delta?.text || '');
                    full += chunk;
                    res.write(`data:${chunk.replace(/\n/g, '\\n')}\n\n`);
                }
            }

            /* 6· TTS al acabar el texto (no streaming de audio) */
            try {
                const voice = (req.session.user?.voz || 'alloy').trim();
                const mp3Path = await ttsOAI(full, voice);
                const audioUrl = '/tmp/' + path.basename(mp3Path);
                res.write(`event:audio\ndata:${audioUrl}\n\n`);
            } catch (e) { logger.error('[TTS] ' + e.message); }

            res.write('event:done\ndata:[DONE]\n\n');
            res.end();
        } catch (err) {
            logger.error('[voiceStream] ' + err.stack);
            res.write(`event:error\ndata:${err.message}\n\n`);
            res.end();
        } finally {
            if (req.file?.path) fs.unlink(req.file.path, () => { });
            await sleep(250);
        }
    }
];
