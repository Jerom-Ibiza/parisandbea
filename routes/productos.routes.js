// routes/productos.routes.js
const express = require('express');
const router = express.Router();
const {
    getPublicProducts,
    getPublicProductBySlug
} = require('../controllers/productos.controller');

// *** End-points sin protección ***
router.get('/public', getPublicProducts);        // listado
router.get('/public/:slug', getPublicProductBySlug);   // detalle

module.exports = router;
