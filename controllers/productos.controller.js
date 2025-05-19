// controllers/productos.controller.js
const pool = require('../database');

/* ============================================================
 * 1)  API PÚBLICA  (sin api-key)
 * ===========================================================*/

/**
 * GET /api/productos/public
 * Devuelve los productos activos ordenados por `orden`
 * (campos mínimos para la cuadrícula)
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
        res.json(rows);
    } catch (err) {
        console.error('getPublicProducts:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * GET /api/productos/public/:slug
 * Devuelve todos los campos de un producto activo (por slug)
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
        console.error('getPublicProductBySlug:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/* ============================================================
 * 2)  API PRIVADA  (protegida con api-key)
 *     CRUD completo para uso interno / GPT Empresa
 * ===========================================================*/

/**
 * POST /api/productos
 * Crea un nuevo producto
 */
exports.createProduct = async (req, res) => {
    try {
        const {
            marca,
            nombre,
            slug,
            dosis,
            forma,
            cantidad_envase,
            imagen,
            peso_neto,
            proposito,
            caracteristicas,
            info_fabricante,
            explicacion_centro,
            posologia,
            stock_teorico,
            pedido_pendiente,
            en_stock_clinica,
            pvp,
            activo = 1,
            orden = 0
        } = req.body;

        if (!nombre || !slug || !pvp)
            return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, slug, pvp)' });

        /* slug único */
        const [dup] = await pool.query(
            'SELECT id_producto FROM productos WHERE slug = ?',
            [slug]
        );
        if (dup.length)
            return res.status(400).json({ error: 'Ya existe un producto con ese slug' });

        const [result] = await pool.query(
            `INSERT INTO productos
       (marca,nombre,slug,dosis,forma,cantidad_envase,imagen,peso_neto,proposito,
        caracteristicas,info_fabricante,explicacion_centro,posologia,stock_teorico,
        pedido_pendiente,en_stock_clinica,pvp,activo,orden)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                marca || null,
                nombre,
                slug,
                dosis || null,
                forma || null,
                cantidad_envase || null,
                imagen || null,
                peso_neto || null,
                proposito || null,
                caracteristicas || null,
                info_fabricante || null,
                explicacion_centro || null,
                posologia || null,
                stock_teorico || 0,
                pedido_pendiente || 0,
                en_stock_clinica || 0,
                pvp,
                activo ? 1 : 0,
                orden
            ]
        );

        res.status(201).json({ message: 'Producto creado', id_producto: result.insertId });
    } catch (err) {
        console.error('createProduct:', err);
        res.status(500).json({ error: 'Error al crear producto' });
    }
};

/**
 * GET /api/productos             (privado, requiere api-key)
 * Devuelve SOLO los campos mínimos para que el GPT Empresa
 * pueda listar y elegir un producto sin sobrecargar contexto.
 *    id_producto, nombre, marca, proposito, pvp
 * Filtros opcionales: ?nombre=…  ?marca=…  ?activo=0|1
 */
exports.getProducts = async (req, res) => {
    try {
        const { nombre, marca, activo } = req.query;

        let sql = `SELECT id_producto,
                      nombre,
                      marca,
                      proposito,
                      pvp,
                      activo
                 FROM productos
                WHERE 1 = 1`;
        const params = [];

        if (nombre) { sql += ' AND nombre LIKE ?'; params.push(`%${nombre}%`); }
        if (marca) { sql += ' AND marca  LIKE ?'; params.push(`%${marca}%`); }
        if (activo !== undefined) { sql += ' AND activo = ?'; params.push(activo); }

        sql += ' ORDER BY orden ASC, id_producto ASC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);                                // [{id_producto,…}, …]
    } catch (err) {
        console.error('getProducts:', err);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

/**
 * GET /api/productos/:id
 * Devuelve un producto por ID (sin restricción de activo)
 */
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM productos WHERE id_producto = ?',
            [id]
        );
        if (!rows.length)
            return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('getProductById:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * PUT /api/productos/:id
 * Actualiza SOLO los campos recibidos en el body.
 * Los que no se envíen permanecen con su valor actual.
 */
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;                      // { campo1:valor1, … }

        /* --- 1) Comprobar existencia ------------------------------------------------ */
        const [[current]] = await pool.query(
            'SELECT * FROM productos WHERE id_producto = ?',
            [id]
        );
        if (!current)
            return res.status(404).json({ error: 'Producto no encontrado' });

        /* --- 2) Validar slug único (si viene) --------------------------------------- */
        if (updates.slug && updates.slug !== current.slug) {
            const [dup] = await pool.query(
                'SELECT id_producto FROM productos WHERE slug = ? AND id_producto <> ?',
                [updates.slug, id]
            );
            if (dup.length)
                return res.status(400).json({ error: 'Ya existe otro producto con ese slug' });
        }

        /* --- 3) Filtrar solo campos permitidos -------------------------------------- */
        const allowed = [
            'marca', 'nombre', 'slug', 'dosis', 'forma', 'cantidad_envase', 'imagen',
            'peso_neto', 'proposito', 'caracteristicas', 'info_fabricante',
            'explicacion_centro', 'posologia', 'stock_teorico', 'pedido_pendiente',
            'en_stock_clinica', 'pvp', 'activo', 'orden'
        ];

        const dataToUpdate = {};
        allowed.forEach(f => {
            if (updates[f] !== undefined) dataToUpdate[f] = updates[f];
        });

        if (Object.keys(dataToUpdate).length === 0)
            return res.status(400).json({ error: 'No se proporcionó ningún campo válido para actualizar' });

        /* --- 4) Ejecutar UPDATE (solo campos cambiados) ----------------------------- */
        await pool.query(
            'UPDATE productos SET ? , updated_at = NOW() WHERE id_producto = ?',
            [dataToUpdate, id]
        );

        res.json({ message: 'Producto actualizado correctamente' });
    } catch (err) {
        console.error('updateProduct:', err);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
};

/**
 * DELETE /api/productos/:id
 * Elimina un producto
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'DELETE FROM productos WHERE id_producto = ?',
            [id]
        );
        if (!result.affectedRows)
            return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ message: 'Producto eliminado' });
    } catch (err) {
        console.error('deleteProduct:', err);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};
