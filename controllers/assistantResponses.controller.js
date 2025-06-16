/* controllers/assistantResponses.controller.js
   admite file_search + im�genes (vision) � versi�n 100 % ok          */
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ttsOAI = require('../utils/openaiTTS');
const prompt = require('../prompts/assistant.responses');
const { LOCAL_FUNCTIONS } = require('./assistant.functions');
const getTools = require('../utils/getToolSchemas');

const openai = new OpenAI();

/* --------- helpers --------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildTools(req, noSearch) {
  const tools = getTools(LOCAL_FUNCTIONS, { web_search: !noSearch });
  if (req.session?.vectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [req.session.vectorStoreId]
    });
  }
  return tools;
}

function ask(input, tools, model = 'gpt-4.1-mini') {
  return openai.responses.create({
    model,
    instructions: prompt,
    input,
    tools,
    tool_choice: 'auto'
  });
}

/* -------------  NUEVA FUNCI�N ------------- */
/* Garantiza que cualquier function_call que ya exista dentro del �history�
   tenga siempre arguments como objeto JSON (requisito de Responses API).  */
function sanitiseHistory(hist) {
  return hist.map(m => {
    if (m.role !== 'user') return m;             // s�lo nos interesan los user
    if (typeof m.content !== 'string') return m; // nada que hacer

    try {
      const obj = JSON.parse(m.content);
      if (obj?.type === 'function_call') {
        // ? si arguments no es objeto ? lo envolvemos
        if (typeof obj.arguments !== 'object') {
          obj.arguments = { __raw: obj.arguments };
          m.content = JSON.stringify(obj);
        }
      }
    } catch {/* no era JSON, lo dejamos tal cual */ }
    return m;
  });
}

/* --------------------------- /chat ------------------------------- */
exports.chat = async (req, res) => {
  try {
    const { message, images = [], model, noSearch } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Falta "message"' });
    if (!req.session.user ||
      !req.session.patient) return res.status(403).json({ error: 'Sin sesi�n v�lida' });

    /* -- HISTORIAL ----------------------- */
    const history = req.session.respHistory || [];

    /* ? content con los tipos correctos  */
    const userEntry = {
      role: 'user',
      content: [
        { type: 'input_text', text: message },
        ...images.map(url => ({
          type: 'input_image',
          image_url: url
        }))
      ]
    };
    history.push(userEntry);

    /* -- PRIMERA LLAMADA ----------------- */
    let rsp = await ask(sanitiseHistory(history), buildTools(req, !!noSearch), model);


    /* -- LOOP HERRAMIENTAS --------------- */
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
          role: 'user',                            // no admite role "tool"
          content: `Resultado de ${call.name}: ${JSON.stringify(result)}`
        });
      }

      rsp = await ask(sanitiseHistory(history), buildTools(req, !!noSearch), model);
      await sleep(180);
    }

    /* -- TEXTO FINAL --------------------- */
    const reply =
      rsp?.output?.find(o => o.type === 'output_text')?.content?.[0]?.text
      ?? rsp?.output_text
      ?? rsp?.text
      ?? '[Sin respuesta]';

    /* -- HISTORIAL (m�x 30) -------------- */
    history.push({ role: 'assistant', content: reply });
    req.session.respHistory = history.slice(-30);

    /* -- TTS (opcional) ------------------ */
    const shortAck = /^ *((registro|actualizaci[o�]n|historial|evaluaci[o�]n|tratamiento|sesi�n)\s+realizada?\s+correctamente\.?) *$/i
      .test(reply);
    let audioUrl = null;

    if (!shortAck && reply && reply !== '[Sin respuesta]') {
      try {
        const voice = (req.session.user?.voz || 'alloy').trim();
        const mp3Path = await ttsOAI(reply, voice);
        audioUrl = '/tmp/' + path.basename(mp3Path);
        setTimeout(() => fs.unlink(mp3Path, () => { }), 10 * 60 * 1000);
      } catch (e) { logger.error('[TTS] ' + e.message); }
    }

    return res.json({ ok: true, reply, audioUrl, question: message });

  } catch (err) {
    logger.error('[assistantResponses] ' + err.stack);
    res.status(500).json({ error: err.message });
  }
};