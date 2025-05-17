/* ───────── utils/openaiTTS.js ───────── */
const OpenAI = require('openai');
const fs     = require('fs');
const path   = require('path');
const logger = require('../logger');

const openai = new OpenAI();                   // usa OPENAI_API_KEY
const TMP    = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

/**
 * Genera un MP3 con el TTS de OpenAI y devuelve la ruta del archivo.
 * @param {string} text                     Texto a locutar (máx. 4096 tokens aprox.)
 * @param {string} voice                    alloy | echo | fable | onyx | nova | shimmer
 * @param {string} model                    tts-1 | tts-1-hd (opcional)
 * @returns {Promise<string>}               Ruta completa del MP3 temporal
 */
async function tts(text, voice = 'alloy', model = process.env.OPENAI_TTS_MODEL || 'tts-1') {
  const start = Date.now();

  const response = await openai.audio.speech.create({
    model,        // tts-1 (rápido) o tts-1-hd (mejor calidad)
    input : text,
    voice,        // “alloy” suena neutro-masculino; “nova” femenino, etc.
    format: 'mp3',
	speed: 1.3
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  const file   = path.join(TMP, 'tts_' + Date.now() + '.mp3');
  fs.writeFileSync(file, buffer);

  logger.info(`[TTS-OAI] ${voice} (${model}) → ${buffer.length} bytes en ${Date.now() - start} ms`);
  return file;
}

module.exports = tts;
