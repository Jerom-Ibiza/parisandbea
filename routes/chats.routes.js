/* routes/chats.routes.js */
const express = require('express');
const router  = express.Router();
const chatsCtl = require('../controllers/chats.controller');

/* guarda / actualiza la conversación corriente */
router.post('/save', chatsCtl.saveOrUpdateChat);

/* devuelve las últimas N (por defecto 1) */
router.get('/last', chatsCtl.getLastChats);

module.exports = router;
