const express = require('express');
const router  = express.Router();
const ctl     = require('../controllers/assistantFiles.controller');

/* La llamada la hace el front una vez que el archivo ya está en /tmp */
router.post('/register', ctl.registerFile);
router.post('/save',     ctl.saveAttachment);
router.post('/ingest', ctl.ingestAttachment);
router.post('/ingest', ctl.ingestFile);

module.exports = router;
