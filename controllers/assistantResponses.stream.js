// controllers/assistantResponses.stream.js
const OpenAI = require('openai');
const prompt = require('../prompts/assistant.responses');
const getTools = require('../utils/getToolSchemas');
const { LOCAL_FUNCTIONS } = require('./assistant.functions');

const openai = new OpenAI();

/** Construye listado de tools igual que en el controlador original */
function buildTools(req, noSearch) {
    const tools = getTools(LOCAL_FUNCTIONS, { web_search: !noSearch });
    if (req.session?.vectorStoreId) {
        tools.push({ type: 'file_search', vector_store_ids: [req.session.vectorStoreId] });
    }
    return tools;
}

/** NUEVO endpoint /stream (Server-Sent Events) */
exports.chatStream = async (req, res) => {
    try {
        const { message, images = [], model = 'gpt-4.1-mini', noSearch } = req.body || {};
        if (!message) return res.status(400).end('Falta "message"');
        if (!req.session.user || !req.session.patient)
            return res.status(403).end('Sin sesión válida');

        /** 1) cabeceras SSE */
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');   // 🛈 nginx: desactiva buffer
        res.setHeader('Content-Encoding', 'none');  // 🛈 evita gzip‐chunk buffering
        res.flushHeaders();

        /** 2) histórico (igual que antes) */
        const hist = (req.session.respHistory || []).slice(-30);
        hist.push({
            role: 'user',
            content: [
                { type: 'input_text', text: message },
                ...images.map(u => ({ type: 'input_image', image_url: u }))
            ]
        });

        /** 3) petición a OpenAI con stream */
        const stream = await openai.responses.create({
            model,
            instructions: prompt,
            input: hist,
            tools: buildTools(req, !!noSearch),
            tool_choice: 'auto',
            stream: true               // 👈  ¡la clave!
        });

        let fullText = '';

        /** 4) enviamos los tokens conforme llegan */
        for await (const ev of stream) {
            if (ev.type === 'response.output_text.delta') {
                const token = ev.data.delta;
                fullText += token;
                res.write(`data: ${token}\n\n`);   // formato SSE
            }
            /** ignora aquí events de tools; si los necesitas procesar,
                añade la misma lógica que usas en assistantResponses.controller.js */
        }

        /** 5) mensaje final obligatorio */
        res.write('data: [DONE]\n\n');
        res.end();

        /** 6) guarda el histórico para turnos siguientes */
        hist.push({ role: 'assistant', content: fullText });
        req.session.respHistory = hist.slice(-30);

    } catch (err) {
        res.write(`event: error\ndata: ${err.message}\n\n`);
        res.end();
    }
};
