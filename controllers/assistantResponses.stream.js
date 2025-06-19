/* ---------------------------------------------------------------------------
   controllers/assistantResponses.stream.js
   Devuelve las respuestas del asistente en streaming (SSE, token a token)
   Modelo por defecto: gpt-4.1-mini
   ------------------------------------------------------------------------- */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ttsOAI = require('../utils/openaiTTS');
const prompt = require('../prompts/assistant.responses');
const { LOCAL_FUNCTIONS } = require('./assistant.functions');
const getTools = require('../utils/getToolSchemas');

const openai = new OpenAI();

/* ---------------------------------------------------------------------------
   helpers
   ------------------------------------------------------------------------- */

// pausa pequeña (misma que en el controlador original)
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Clonamos la función sanitiseHistory del controlador viejo
   (garantiza que arguments sea objeto JSON válido)             */
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

/* Construye lista de herramientas igual que en el controlador clásico */
function buildTools(req, noSearch) {
    const tools = getTools(LOCAL_FUNCTIONS, { web_search: !noSearch });
    if (req.session?.vectorStoreId) {
        tools.push({ type: 'file_search', vector_store_ids: [req.session.vectorStoreId] });
    }
    return tools;
}

/* ---------------------------------------------------------------------------
   /api/assistant/chat-stream  (POST)
   ------------------------------------------------------------------------- */
exports.chatStream = async (req, res) => {
    try {
        const { message, images = [], model = 'gpt-4.1-mini', noSearch } = req.body || {};
        if (!message) return res.status(400).end('Falta "message"');
        // Descomenta estas líneas cuando pruebes ya con sesión válida
        if (!req.session.user || !req.session.patient)
            return res.status(403).end('Sin sesión válida');

        /* ----- historial en sesión ----- */
        const history = req.session.respHistory || [];
        history.push({
            role: 'user',
            content: [
                { type: 'input_text', text: message },
                ...images.map(u => ({ type: 'input_image', image_url: u }))
            ]
        });

        /* ----- cabeceras SSE ----- */
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();                       // envía ya las cabeceras

        /* ------------------------------------------------------------------
           Primera llamada sin streaming para detectar tool_calls
           ----------------------------------------------------------------- */
        let rsp = await openai.responses.create({
            model,
            instructions: prompt,
            input: sanitiseHistory(history),
            tools: buildTools(req, !!noSearch),
            tool_choice: 'auto'
        });

        for (let step = 0; step < 4; step++) {
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

        /* ------------------------------------------------------------------
           Segunda llamada en streaming (tool_choice:none) para texto final
           ----------------------------------------------------------------- */
        const stream = await openai.responses.create({
            model,
            instructions: prompt,
            input: sanitiseHistory(history),
            tool_choice: 'none',
            stream: true
        });

        let fullText = '';

        for await (const event of stream) {
            /* ── texto incremental ── */
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
        /* --- TTS (opcional) --- */
        const shortAck = /^ *((registro|actualizaci[o�]n|historial|evaluaci[o�]n|tratamiento|sesi[o�]n)\s+realizada?\s+correctamente\.?) *$/i
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

        res.write('event:done\ndata:[DONE]\n\n');
        res.end();

        history.push({ role: 'assistant', content: fullText });
        req.session.respHistory = history.slice(-30);

    } catch (err) {
        logger.error('[assistantStream] ' + err.stack);
        /* enviamos error por SSE antes de cerrar */
        res.write(`event:error\ndata:${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
};

