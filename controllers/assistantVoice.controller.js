/* ───────── controllers/assistantVoice.controller.js ───────── */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');
const logger = require('../logger');
const assistantCtl = require('./assistantResponses.controller');

/* carpeta temporal */
const TMP = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const upload = multer({ dest: TMP });
const openai = new OpenAI();

/* util: borrar fichero cuando acabe */
const safeUnlink = f => fs.unlink(f, () => { });

exports.handleVoice = [
  upload.single('audio'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Falta audio' });

      // 1. determinar extensión
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

      // 2. transcripción Whisper
      const { text } = await openai.audio.transcriptions.create({
        file: fs.createReadStream(realPath),
        model: 'whisper-1',
        language: 'es'
      });
      safeUnlink(realPath);

      logger.info('[voice] texto: ' + text.slice(0, 80) + '…');

      // 3. delegar a Responses API
      req.body.message = text;
      const originalJson = res.json.bind(res);
      res.json = obj => {
        obj.question = text;
        return originalJson(obj);
      };
      await assistantCtl.chat(req, res);

    } catch (err) {
      logger.error('[voice] ' + err.stack);
      res.status(500).json({ error: err.message });
    }
  }
];

