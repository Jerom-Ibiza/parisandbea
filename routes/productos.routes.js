// routes/productos.routes.js
const express = require('express');
const router = express.Router();
const checkApiKey = require('../middleware/checkApiKey');

const {
    /* públicas */
    getPublicProducts,
    getPublicProductBySlug,
    /* privadas */
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
} = require('../controllers/productos.controller');

/* ======================================================
 *  End-points PÚBLICOS  (sin api-key)
 * =====================================================*/
router.get('/public', getPublicProducts);        // listado público
router.get('/public/:slug', getPublicProductBySlug);   // detalle público

/* ======================================================
 *  End-points PRIVADOS  (con api-key)
 * =====================================================*/
router.post('/', checkApiKey, createProduct);     // crear
router.get('/', checkApiKey, getProducts);       // lista filtrable
router.get('/:id', checkApiKey, getProductById);    // detalle por ID
router.put('/:id', checkApiKey, updateProduct);     // actualizar
router.delete('/:id', checkApiKey, deleteProduct);     // eliminar

module.exports = router;
