const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files.controller');
const multer = require('multer');
const path = require('path');

// ---------------------------
// MIDDLEWARES DE AUTENTICACIÓN
// ---------------------------

// 1. checkAuth - Protege rutas con sesión
const checkAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autorizado. Sesión no iniciada.' });
  }
  next();
};

// 2. checkApiKey - Protege rutas con la API key
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'No autorizado. API key incorrecta o ausente.' });
  }
  next();
};

// ---------------------------
// CONFIGURACIÓN MULTER
// ---------------------------
const allowedFolders = [
  'attachments_mail',
  'attachments_whatsapp',
  'documentos',
  'documentos/consentimientos',
  'documentos/consentimientos_firmados',
  'images',
  'images/recursos',
  'images/servicios',
  'images/profesionales',
  'images/productos',
  'tmp',
  'attachments_consulta'
];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // folder puede ser, por ej., 'images/recursos' según la ruta
    const folder = req.params.folder;
    if (!allowedFolders.includes(folder)) {
      return cb(new Error('Carpeta no permitida'));
    }
    cb(null, path.join(__dirname, '..', folder));
  },
  filename: function (req, file, cb) {
    // Convertir nombre de archivo de latin1 a utf8 para conservar acentos
    let originalName = file.originalname;
    try {
      // Si viene codificado en latin1, lo transformamos a utf-8
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (err) {
      console.error('Error convirtiendo nombre de archivo a UTF-8:', err);
      // En caso de error, usamos el nombre tal cual
    }
    cb(null, originalName);
  }
});

const upload = multer({ storage });

// ----------------------------------
// RUTAS PROTEGIDAS POR API KEY
// (Usamos :folder(*) para admitir subdirectorios)
// ----------------------------------

// Listar archivos con apiKey
router.get('/apikey/:folder(*)', checkApiKey, filesController.listFiles);

// Subir archivos con apiKey
router.post('/apikey/:folder(*)/upload', checkApiKey, upload.array('files', 10), filesController.uploadFiles);

// Renombrar archivo con apiKey
router.put('/apikey/:folder(*)/rename', checkApiKey, filesController.renameFile);

// Eliminar un archivo con apiKey
router.delete('/apikey/:folder(*)/:filename', checkApiKey, filesController.deleteFile);

// Eliminar varios archivos con apiKey
router.delete('/apikey/:folder(*)', checkApiKey, filesController.deleteMultipleFiles);

// RUTAS PROTEGIDAS CON SESIÓN (permitir subcarpetas)
router.get('/:folder(*)', checkAuth, filesController.listFiles);
router.post('/:folder(*)/upload', checkAuth, upload.array('files', 10), filesController.uploadFiles);
router.put('/:folder(*)/rename', checkAuth, filesController.renameFile);
router.delete('/:folder(*)/:filename', checkAuth, filesController.deleteFile);
router.delete('/:folder(*)', checkAuth, filesController.deleteMultipleFiles);

module.exports = router;
