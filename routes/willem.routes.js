const express = require('express');
const router = express.Router();

// Importamos los controladores
const { getProgresos, searchProgresos, createProgreso, updateProgreso, deleteProgreso } = require('../controllers/willem.controller');
// Middleware para validar la API key
const checkApiKey = require('../middleware/checkApiKey');

// Todas las rutas estarán protegidas por la API key
router.use(checkApiKey);

// Obtener los últimos 8 registros de progreso
router.get('/', getProgresos);

// Buscar registros de progreso por rango de fechas y asignatura
router.get('/search', searchProgresos);

// Registrar un nuevo progreso
router.post('/', createProgreso);

// Actualizar un registro de progreso existente
router.put('/:id', updateProgreso);

// Eliminar un registro de progreso
router.delete('/:id', deleteProgreso);

module.exports = router;

