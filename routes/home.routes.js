const express = require('express');
const router = express.Router();

// Importa los controladores
const {
  getHomeData,
  getAllServerImages,
  updateHomeData,
  getCurrentDateTime,
  getEmpresaData,
  updateEmpresaData
} = require('../controllers/home.controller');

// Importa el middleware que creamos
const checkApiKey = require('../middleware/checkApiKey');

// Rutas sin protección
router.get('/', getHomeData);
router.get('/datetime', getCurrentDateTime);

// Rutas protegidas con API key
router.get('/allimages', checkApiKey, getAllServerImages);
router.put('/', checkApiKey, updateHomeData);
router.get('/empresa', checkApiKey, getEmpresaData);
router.put('/empresa', checkApiKey, updateEmpresaData);

module.exports = router;

