/* Streaming responses for Agendator */
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ttsOAI = require('../utils/openaiTTS');
const prompt = require('../prompts/agendator.responses');
const { LOCAL_FUNCTIONS } = require('./agendator.functions');
const getTools = require('../utils/getToolSchemas');

const openai = new OpenAI();
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
        } catch { }
        return m;
    });
}

function buildTools(req, noSearch) {
    return getTools(LOCAL_FUNCTIONS, { web_search: !noSearch });
}

exports.chatStream = async (req, res) => {
    try {
        const { message, model = 'gpt-4.1-mini', noSearch, id_paciente } = req.body || {};
        if (!message) return res.status(400).end('Falta "message"');
        if (!req.session.user) return res.status(403).end('Sin sesión válida');
        if (typeof id_paciente !== 'undefined') {
            req.session.agSelectedPatient = id_paciente ? Number(id_paciente) : null;
        }
        const history = req.session.agendaHist || [];
        history.push({ role: 'user', content: [{ type: 'input_text', text: message }] });

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const prof = req.session.user;
        let instructions = `${prompt}\nID_PROFESIONAL:${prof.id_profesional}\nNOMBRE_PROFESIONAL:${prof.nombre}`;
        if (prof.preferencias) instructions += `\nPREFERENCIAS_PRO:\n${prof.preferencias}`;
        if (req.session.agSelectedPatient) instructions += `\nID_PACIENTE_SELECCIONADO:${req.session.agSelectedPatient}`;

        let rsp = await openai.responses.create({
            model,
            instructions,
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
                try { args = JSON.parse(call.arguments || '{}'); } catch { }
                let result;
                try { result = await fn(args, req); }
                catch (e) { result = { error: e.message }; }
                history.push({ role: 'user', content: `Resultado de ${call.name}: ${JSON.stringify(result)}` });
            }
            rsp = await openai.responses.create({
                model,
                instructions,
                input: sanitiseHistory(history),
                tools: buildTools(req, !!noSearch),
                tool_choice: 'auto'
            });
            await sleep(180);
        }

        const stream = await openai.responses.create({
            model,
            instructions,
            input: sanitiseHistory(history),
            tool_choice: 'none',
            stream: true
        });

        let fullText = '';
        for await (const event of stream) {
            if (event.type === 'response.text.delta' || event.type === 'response.output_text.delta') {
                const chunk = typeof event.delta === 'string' ? event.delta : (event.delta?.text || '');
                if (!chunk) continue;
                fullText += chunk;
                res.write(`data:${chunk.replace(/\n/g, '\\n')}\n\n`);
            }
        }

        if (fullText && fullText !== '[Sin respuesta]') {
            try {
                const voice = (req.session.user?.voz || 'alloy').trim();
                const mp3Path = await ttsOAI(fullText, voice);
                const audioUrl = '/tmp/' + path.basename(mp3Path);
                setTimeout(() => fs.unlink(mp3Path, () => { }), 10 * 60 * 1000);
                res.write(`event:audio\ndata:${audioUrl}\n\n`);
            } catch (e) { logger.error('[TTS] ' + e.message); }
        }

        history.push({ role: 'assistant', content: fullText });
        req.session.agendaHist = history.slice(-30);
        await new Promise(r => req.session.save(r));

        res.write('event:done\ndata:[DONE]\n\n');
        res.end();

    } catch (err) {
        logger.error('[agendatorStream] ' + err.stack);
        res.write(`event:error\ndata:${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
};