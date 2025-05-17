const express = require('express');
const router = express.Router();
const mailController = require('../controllers/mail.controller');

// Middleware de autenticación con la API_KEY
const checkApiKey = require('../middleware/checkApiKey');

// RUTA PARA ENVIAR EMAILS
router.post('/send', checkApiKey, mailController.sendMail);

// RUTA PARA LEER CORREOS (IMAP) Y GUARDAR EN BD
router.get('/receive', checkApiKey, mailController.fetchReceivedEmails);

// LISTAR CORREOS RECIBIDOS (con o sin filtro)
router.get('/received/:filter?', checkApiKey, mailController.listReceivedEmails);

// LISTAR CORREOS ENVIADOS (con o sin filtro)
router.get('/sent/:filter?', checkApiKey, mailController.listSentEmails);

// ELIMINAR UN CORREO RECIBIDO
router.delete('/received/:id', checkApiKey, mailController.deleteReceivedEmailById);

// ELIMINAR UN CORREO ENVIADO
router.delete('/sent/:id', checkApiKey, mailController.deleteSentEmailById);

// LISTAR CARPETAS IMAP (opcional)
router.get('/list-imap-folders', mailController.listImapFolders);

module.exports = router;
