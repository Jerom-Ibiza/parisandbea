/* controllers/assistantFiles.controller.js
   Maneja /tmp + vector‑store + guardado permanente                       */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const mime = require('mime-types');           // ← npm i mime --save
const pool = require('../database');   // ← faltaba
const slugify = require('../utils/slugify');
const logger = require('../logger');
const extractText = require('../utils/extractText');

const TMP = path.join(__dirname, '..', 'tmp');
const openai = new OpenAI();

/* ------------- registerFile (sin cambios salvo tmpFiles push) -------- */
exports.registerFile = async (req, res) => {
  try {
    /* 1. sesión válida -------------------------------------------------- */
    if (!req.session.user)
      return res.status(403).json({ error: 'Sin sesión' });

    /* 2. intentamos obtener tmpName y origName -------------------------- */
    let {
      tmpName,
      tmpname,
      tmp_name,
      filename,
      file,
      origName,
      originalName
    } = req.body || {};

    /* — normalizamos ---------------------------------------------------- */
    tmpName = tmpName || tmpname || tmp_name || filename || file || null;
    origName = origName || originalName || null;

    /* — plan B: buscar cualquier valor que empiece por "tmp-" ----------- */
    if (!tmpName) {
      for (const v of Object.values(req.body || {})) {
        if (typeof v === 'string' && /^tmp-/.test(v)) { tmpName = v; break; }
      }
    }

    if (!tmpName)
      return res.status(400).json({ error: 'Falta tmpName' });

    /* 3. existe físicamente en /tmp ------------------------------------- */
    const abs = path.join(TMP, tmpName);
    if (!fs.existsSync(abs))
      return res.status(404).json({ error: 'No existe en tmp' });

    /* 4. identificamos tipo de archivo ---------------------------------- */
    const ext = path.extname(origName || tmpName).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'].includes(ext);

    /* 5. si es documento → Files API + vector-store --------------------- */
    let fileId = null, vsId = null;
    if (!isImage) {
      let uploadPath = abs;
      let tmpTxt = null;
      if (['.pdf', '.docx', '.xls', '.xlsx'].includes(ext)) {
        try {
          const text = await extractText(abs);
          tmpTxt = abs + '.txt';
          await fs.promises.writeFile(tmpTxt, text);
          uploadPath = tmpTxt;
        } catch (e) {
          logger.error('[extractText] ' + e.message);
        }
      }
      const up = await openai.files.create({
        file: fs.createReadStream(uploadPath),
        purpose: 'assistants'
      });
      fileId = up.id;
      if (tmpTxt) {
        fs.unlink(tmpTxt, () => { });
      }

      vsId = req.session.vectorStoreId;
      if (!vsId) {
        const vs = await openai.vectorStores.create({ name: `vs_${Date.now()}` });
        vsId = vs.id;
        req.session.vectorStoreId = vsId;
      }
      await openai.vectorStores.files.create(vsId, { file_id: fileId });
      req.session.uploadedFiles = (req.session.uploadedFiles || []).concat(fileId);
    }

    /* 6. guardamos en la sesión el mapa tmp ↔ nombre original ----------- */
    req.session.tmpFiles = (req.session.tmpFiles || []).concat({
      tmpName,
      origName: origName || tmpName
    });

    /* 7. respondemos ----------------------------------------------------- */
    return res.json({
      ok: true,
      kind: isImage ? 'image' : 'doc',
      tmpName,
      filename: origName || tmpName,
      fileId,
      vectorStoreId: vsId
    });

  } catch (err) {
    logger.error('[registerFile] ' + err.message);
    return res.status(500).json({ error: err.message });
  }
};

/* ────────── saveAttachment ────────── */
exports.saveAttachment = async (req, res) => {
  try {
    let { tmpName, origName, image_url, finalName = '', description = '' } = req.body || {};

    // 1) Si viene image_url, lo derive:
    if (!tmpName && image_url) {
      // extrae 'tmp-123.webp' de '/tmp/tmp-123.webp'
      tmpName = decodeURIComponent(
        path.basename(new URL(image_url, 'http://dummy').pathname)
      );
    }

    // 2) Si no hay tmpName todavía, pruebe con origName
    if (!tmpName && origName && req.session.tmpFiles) {
      const hit = req.session.tmpFiles.find(f => f.origName === origName);
      if (hit) tmpName = hit.tmpName;
    }

    if (!tmpName)
      return res.status(400).json({ error: 'Falta tmpName u image_url válido' });

    if (!req.session.patient)
      return res.status(403).json({ error: 'Sesión sin paciente' });

    const src = path.join(TMP, tmpName);
    if (!fs.existsSync(src))
      return res.status(404).json({ error: 'No existe en tmp' });

    // 3) Construye nombre definitivo
    const idPac = req.session.patient.id_paciente;
    const ext = path.extname(finalName || tmpName).toLowerCase();
    const base = slugify(path.basename(finalName || tmpName, ext));
    const dstName = `${idPac}-${Date.now()}-${base}${ext}`;

    const dstRel = path.posix.join('attachments_consulta', dstName);
    const dstAbs = path.join(__dirname, '..', dstRel);

    // 4) Mueve el archivo
    await fs.promises.rename(src, dstAbs);

    // 5) Elimina la entrada tmpFiles para no confundir en iteraciones
    if (req.session.tmpFiles) {
      req.session.tmpFiles = req.session.tmpFiles.filter(f => f.tmpName !== tmpName);
    }

    // 6) Inserta registro en BD
    const mimeType = require('mime-types').lookup(ext) || 'application/octet-stream';
    await pool.query(
      `INSERT INTO patient_files
         SET id_paciente=?, filename=?, filepath=?, mime_type=?, descripcion=?`,
      [idPac, finalName || (base + ext), dstRel, mimeType, description]
    );

    // 7) Responde OK
    return res.json({
      ok: true,
      message: 'Archivo guardado',
      url: `/${dstRel}`
    });

  } catch (err) {
    logger.error('[saveAttachment] ', err);
    return res.status(500).json({ error: 'Error guardando archivo: ' + err.message });
  }
};

/* ------------------------------------------------------------------ */
/*     copia un adjunto permanente al vector-store de la sesión        */
/* ------------------------------------------------------------------ */
exports.ingestAttachment = async (req, res) => {
  try {
    const { filepath } = req.body || {};
    if (!filepath) return res.status(400).json({ error: 'Falta filepath' });

    // 1) localiza el fichero en disco
    const cleanPath = decodeURIComponent(filepath).replace(/^[\\/]/, '');
    const abs = path.join(__dirname, '..', cleanPath);
    if (!fs.existsSync(abs))
      return res.status(404).json({ error: 'No existe el archivo' });

    // 2) sube a Files API
    let uploadPath = abs;
    let tmpTxt = null;
    let extractedText = null;
    const ext = path.extname(abs).toLowerCase();
    if (['.pdf', '.docx', '.xls', '.xlsx'].includes(ext)) {
      try {
        const text = await extractText(abs);
        extractedText = text;
        tmpTxt = abs + '.txt';
        await fs.promises.writeFile(tmpTxt, text);
        uploadPath = tmpTxt;
      } catch (e) {
        logger.error('[extractText] ' + e.message);
      }
    }
    const up = await openai.files.create({
      file: fs.createReadStream(uploadPath),
      purpose: 'assistants'
    });
    if (tmpTxt) fs.unlink(tmpTxt, () => { });

    // 3) vector-store (uno por sesión)
    let vsId = req.session.vectorStoreId;
    if (!vsId) {
      const vs = await openai.vectorStores.create({
        name: `vs_${Date.now()}`
      });
      vsId = vs.id;
      req.session.vectorStoreId = vsId;
    }

    // 4) enlaza file → vector store
    await openai.vectorStores.files.create(vsId, { file_id: up.id });

    res.json({
      ok: true,
      file_id: up.id,
      vectorStoreId: vsId,
      text: extractedText
        ? extractedText.slice(0, 20000)
        : null
    });
  } catch (err) {
    logger.error('[ingestAttachment] ' + err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.ingestFile = async (req, res) => {
  try {
    const { filepath } = req.body || {};
    if (!filepath) return res.status(400).json({ ok: false, error: 'Falta filepath' });

    const cleanPath = decodeURIComponent(filepath).replace(/^[\\/]/, '');
    const abs = path.join(__dirname, '..', cleanPath);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: 'No existe el archivo' });

    /* 1· subimos el archivo a la Files API (si no está ya) */
    let uploadPath = abs;
    let tmpTxt = null;
    let extractedText = null;
    const ext = path.extname(abs).toLowerCase();
    if (['.pdf', '.docx', '.xls', '.xlsx'].includes(ext)) {
      try {
        const text = await extractText(abs);
        extractedText = text;
        tmpTxt = abs + '.txt';
        await fs.promises.writeFile(tmpTxt, text);
        uploadPath = tmpTxt;
      } catch (e) {
        logger.error('[extractText] ' + e.message);
      }
    }
    const fileUp = await openai.files.create({ file: fs.createReadStream(uploadPath), purpose: 'assistants' });
    if (tmpTxt) fs.unlink(tmpTxt, () => { });

    /* 2· creamos (o usamos) el vector-store de la sesión */
    const vsId = req.session.vectorStoreId || (await openai.vectorStores.create({ name: `vs_${Date.now()}` })).id;
    if (!req.session.vectorStoreId) req.session.vectorStoreId = vsId;

    /* 3· vinculamos el file al VS (idempotente) */
    await openai.vectorStores.files.create(vsId, { file_id: fileUp.id });

    res.json({
      ok: true,
      message: 'Documento preparado',
      file_id: fileUp.id,
      vector_store: vsId,
      text: extractedText ? extractedText.slice(0, 20000) : null
    });

  } catch (err) {
    logger.error('[ingestFile] ' + err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

