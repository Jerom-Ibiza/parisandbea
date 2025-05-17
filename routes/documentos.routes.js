const express = require('express');
const router = express.Router();
const documentosController = require('../controllers/documentos.controller');

const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'API key incorrecta o ausente.' });
  }
  next();
};

router.post('/draft/start',    documentosController.startDraft);
router.post('/draft/append',   documentosController.appendChunk);
router.post('/draft/finalize', documentosController.finalizeDraft);

// Ruta para generar un documento genérico en PDF
router.post('/generate', checkApiKey, documentosController.generateDocument);

// Ruta para generar un documento de consentimiento (osteopatía, LOPD, etc.)
router.post('/generateConsent', checkApiKey, documentosController.generateConsentDocument);

// Ruta para generar consentimiento de punción seca
router.post('/generateConsentPuncionSeca', checkApiKey, documentosController.generateConsentimientoPuncionSeca);

// Ruta para generar consentimiento de SUELO PÉLVICO (Fisioterapia Perineal)
router.post('/generateConsentSueloPelvico', checkApiKey, documentosController.generateConsentimientoSueloPelvico);

module.exports = router;
