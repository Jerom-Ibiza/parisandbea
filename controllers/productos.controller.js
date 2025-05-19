// controllers/productos.controller.js
const pool = require('../database');

/* ------------------------------------------------------------------
 *  API PÚBLICA - Productos
 *  ----------------------------------------------------------------*/

/**
 * GET /api/productos/public
 * Devuelve todos los productos *activos* ordenados por `orden`
 * Solo los campos necesarios para la “tarjeta” de listado.
 */
exports.getPublicProducts = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id_producto,
              marca,
              nombre,
              slug,
              imagen,
              proposito,
              pvp
       FROM productos
       WHERE activo = 1
       ORDER BY orden ASC, id_producto ASC`
        );
        res.json(rows);                                // []
    } catch (err) {
        console.error('Error al obtener productos públicos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * GET /api/productos/public/:slug
 * Devuelve todos los datos de *un* producto identificado por su slug
 */
exports.getPublicProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const [rows] = await pool.query(
            'SELECT * FROM productos WHERE slug = ? AND activo = 1 LIMIT 1',
            [slug]
        );

        if (!rows.length)
            return res.status(404).json({ error: 'Producto no encontrado' });

        res.json(rows[0]);
    } catch (err) {
        console.error('Error al obtener producto público:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
