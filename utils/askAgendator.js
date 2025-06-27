const OpenAI = require('openai');
const prompt = require('../prompts/agendator.responses');
const { LOCAL_FUNCTIONS } = require('../controllers/agendator.functions');
const getTools = require('./getToolSchemas');

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

module.exports = async function askAgendator(message, req, opts = {}) {
    const { model = 'gpt-4.1-mini', noSearch } = opts;
    const history = req.session.agendaHist || [];
    history.push({ role: 'user', content: [{ type: 'input_text', text: message }] });

    try {
        const now = await LOCAL_FUNCTIONS.get_datetime();
        history.push({
            role: 'user',
            content: `Resultado de get_datetime: ${JSON.stringify(now)}`
        });
    } catch (e) {
        history.push({
            role: 'user',
            content: `Resultado de get_datetime: ${JSON.stringify({ error: e.message })}`
        });
    }

    const prof = req.session.user;
    let instructions = `${prompt}\nID_PROFESIONAL:${prof.id_profesional}`;
    if (prof.preferencias) instructions += `\nPREFERENCIAS_PRO:\n${prof.preferencias}`;
    if (req.session.patient)
        instructions += `\nID_PACIENTE_SELECCIONADO:${req.session.patient.id_paciente}`;

    let rsp = await openai.responses.create({
        model,
        instructions,
        input: sanitiseHistory(history),
        tools: buildTools(req, !!noSearch),
        tool_choice: 'auto'
    });

    /* hasta 8 pasos como en el stream para que ejecute
       todas las llamadas a funciones necesarias */
    for (let step = 0; step < 8; step++) {
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

    const reply = rsp?.output?.find(o => o.type === 'output_text')?.content?.[0]?.text
        ?? rsp?.output_text
        ?? rsp?.text
        ?? '';

    history.push({ role: 'assistant', content: reply });
    req.session.agendaHist = history.slice(-30);
    return reply;
};