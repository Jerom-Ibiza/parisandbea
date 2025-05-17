/* controllers/assistantFiles.controller.js
   Maneja /tmp + vector‑store + guardado permanente                       */
const fs      = require('fs');
const path    = require('path');
const OpenAI  = require('openai');
const mime = require('mime-types');           // ← npm i mime --save
const pool    = require('../database');   // ← faltaba
const slugify = require('../utils/slugify');
const logger  = require('../logger');

const TMP     = path.join(__dirname, '..', 'tmp');
const openai  = new OpenAI();

/* ------------- registerFile (sin cambios salvo tmpFiles push) -------- */
exports.registerFile = async (req, res) => {
  try{
    if (!req.session.user) return res.status(403).json({ error:'Sin sesión' });

    const { tmpName, origName } = req.body || {};
    if (!tmpName || !origName)   return res.status(400).json({ error:'Faltan datos' });

    const abs = path.join(TMP, tmpName);
    if (!fs.existsSync(abs))     return res.status(404).json({ error:'No existe en tmp' });

    const ext      = path.extname(origName).toLowerCase();
    const isImage  = ['.jpg','.jpeg','.png','.webp','.gif','.heic'].includes(ext);

    let fileId = null, vsId = null;

    if (!isImage){
      const up = await openai.files.create({ file:fs.createReadStream(abs), purpose:'assistants' });
      fileId = up.id;

      vsId = req.session.vectorStoreId;
      if (!vsId){
        const vs = await openai.vectorStores.create({ name:`vs_${Date.now()}` });
        vsId = vs.id;
        req.session.vectorStoreId = vsId;
      }
      await openai.vectorStores.files.create(vsId, { file_id:fileId });
      req.session.uploadedFiles = (req.session.uploadedFiles || []).concat(fileId);
    }

    /* ------- guardamos mapa tmp ↔ nombre original ------- */
    req.session.tmpFiles = (req.session.tmpFiles || []).concat({ tmpName, origName });

    return res.json({
      ok:true, kind:isImage?'image':'doc',
      tmpName, fileId, vectorStoreId:vsId, filename:origName
    });

  }catch(err){
    logger.error('[registerFile] '+err.message);
    res.status(500).json({ error:err.message });
  }
};

/* ────────── saveAttachment ────────── */
exports.saveAttachment = async (req, res) => {
  try {
    let { tmpName, origName, image_url, finalName = '', description = '' } = req.body || {};

    // 1) Si viene image_url, lo derive:
    if (!tmpName && image_url) {
      // extrae 'tmp-123.webp' de '/tmp/tmp-123.webp'
      tmpName = path.basename(new URL(image_url, 'http://dummy').pathname);
    }

    // 2) Si no hay tmpName todavía, pruebe con origName
    if (!tmpName && origName && req.session.tmpFiles) {
      const hit = req.session.tmpFiles.find(f => f.origName === origName);
      if (hit) tmpName = hit.tmpName;
    }

    if (!tmpName) 
      return res.status(400).json({ error:'Falta tmpName u image_url válido' });

    if (!req.session.patient)
      return res.status(403).json({ error:'Sesión sin paciente' });

    const src = path.join(TMP, tmpName);
    if (!fs.existsSync(src))
      return res.status(404).json({ error:'No existe en tmp' });

    // 3) Construye nombre definitivo
    const idPac   = req.session.patient.id_paciente;
    const ext     = path.extname(finalName || tmpName).toLowerCase();
    const base    = slugify(path.basename(finalName || tmpName, ext));
    const dstName = `${idPac}-${Date.now()}-${base}${ext}`;

    const dstRel  = path.join('attachments_consulta', dstName);
    const dstAbs  = path.join(__dirname, '..', dstRel);

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
      [ idPac, finalName || (base+ext), dstRel, mimeType, description ]
    );

    // 7) Responde OK
    return res.json({
      ok:true,
      message:'Archivo guardado',
      url:`/${dstRel}`
    });

  } catch(err) {
    logger.error('[saveAttachment] ', err);
    return res.status(500).json({ error:'Error guardando archivo: '+err.message });
  }
};

/* ------------------------------------------------------------------ */
/*     copia un adjunto permanente al vector-store de la sesión        */
/* ------------------------------------------------------------------ */
exports.ingestAttachment = async (req, res) => {
  try {
    const { filepath } = req.body || {};
    if (!filepath) return res.status(400).json({ error:'Falta filepath' });

    // 1) localiza el fichero en disco
    const abs = path.join(__dirname, '..', filepath.replace(/^[\\/]/,''));
    if (!fs.existsSync(abs))
      return res.status(404).json({ error:'No existe el archivo' });

    // 2) sube a Files API
    const up = await openai.files.create({
      file   : fs.createReadStream(abs),
      purpose: 'assistants'
    });

    // 3) vector-store (uno por sesión)
    let vsId = req.session.vectorStoreId;
    if (!vsId){
      const vs = await openai.vectorStores.create({
        name:`vs_${Date.now()}`
      });
      vsId = vs.id;
      req.session.vectorStoreId = vsId;
    }

    // 4) enlaza file → vector store
    await openai.vectorStores.files.create(vsId, { file_id: up.id });

    res.json({ ok:true, file_id: up.id, vectorStoreId: vsId });
  }catch(err){
    logger.error('[ingestAttachment] '+err.message);
    res.status(500).json({ error:err.message });
  }
};

exports.ingestFile = async (req, res) => {
  try{
    const { filepath } = req.body || {};
    if (!filepath) return res.status(400).json({ ok:false, error:'Falta filepath' });

    const abs = path.join(__dirname, '..', filepath);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok:false, error:'No existe el archivo' });

    /* 1· subimos el archivo a la Files API (si no está ya) */
    const fileUp   = await openai.files.create({ file: fs.createReadStream(abs), purpose:'assistants' });

    /* 2· creamos (o usamos) el vector-store de la sesión */
    const vsId = req.session.vectorStoreId || (await openai.vectorStores.create({ name:`vs_${Date.now()}` })).id;
    if (!req.session.vectorStoreId) req.session.vectorStoreId = vsId;

    /* 3· vinculamos el file al VS (idempotente) */
    await openai.vectorStores.files.create(vsId, { file_id: fileUp.id });

    res.json({ ok:true, message:'Documento preparado', file_id:fileUp.id, vector_store:vsId });

  }catch(err){
    logger.error('[ingestFile] '+err.message);
    res.status(500).json({ ok:false, error: err.message });
  }
};

