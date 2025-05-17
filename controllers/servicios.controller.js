const pool = require('../database');

/**
 * Crear un nuevo servicio
 */
exports.createService = async (req, res) => {
  try {
    const {
      nombre,
      slug,
      descripcion,
      detalle,
      categoria,
      precio,
      duracion,
      imagen,
      activo,
      orden
    } = req.body;

    // Validar campos obligatorios
    if (!nombre || !slug || !precio) {
      return res.status(400).json({ error: 'Faltan datos requeridos (nombre, slug, precio)' });
    }

    // Verificar unicidad de slug
    const [slugCheck] = await pool.query(
      'SELECT id_servicio FROM servicios WHERE slug = ?',
      [slug]
    );
    if (slugCheck.length > 0) {
      return res.status(400).json({ error: 'Ya existe un servicio con ese slug' });
    }

    // Insertar servicio
    const query = `
      INSERT INTO servicios
      (nombre, slug, descripcion, detalle, categoria, precio, duracion, imagen, activo, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      nombre,
      slug,
      descripcion || null,
      detalle || null,
      categoria || null,
      precio,
      duracion || null,
      imagen || null,
      activo !== undefined ? activo : 1,
      orden || 0
    ];
    const [result] = await pool.query(query, params);

    res.status(201).json({
      message: 'Servicio creado correctamente',
      id_servicio: result.insertId
    });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
};

/**
 * Obtener la lista de servicios (con búsqueda opcional por nombre, categoría, activo)
 */
exports.getServices = async (req, res) => {
  try {
    const { nombre, categoria, activo } = req.query;

    let query = 'SELECT * FROM servicios WHERE 1=1';
    const params = [];

    if (nombre) {
      query += ' AND nombre LIKE ?';
      params.push(`%${nombre}%`);
    }
    if (categoria) {
      query += ' AND categoria LIKE ?';
      params.push(`%${categoria}%`);
    }
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo); // 0 o 1
    }

    // Ordenar por "orden" asc y luego por id_servicio asc
    query += ' ORDER BY orden ASC, id_servicio ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

/**
 * Obtener un servicio por ID
 */
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM servicios WHERE id_servicio = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener servicio por ID:', error);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
};

/**
 * Actualizar un servicio
 */
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      slug,
      descripcion,
      detalle,
      categoria,
      precio,
      duracion,
      imagen,
      activo,
      orden
    } = req.body;

    // Verificar si existe el servicio
    const [existing] = await pool.query(
      'SELECT * FROM servicios WHERE id_servicio = ?',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    const current = existing[0];

    // Si llega un slug diferente, comprobar que no exista ya
    if (slug && slug !== current.slug) {
      const [slugCheck] = await pool.query(
        'SELECT id_servicio FROM servicios WHERE slug = ? AND id_servicio != ?',
        [slug, id]
      );
      if (slugCheck.length > 0) {
        return res.status(400).json({ error: 'Ya existe otro servicio con ese slug' });
      }
    }

    // Actualizar con fusión de datos
    const newNombre = nombre !== undefined ? nombre : current.nombre;
    const newSlug = slug !== undefined ? slug : current.slug;
    const newDescripcion = descripcion !== undefined ? descripcion : current.descripcion;
    const newDetalle = detalle !== undefined ? detalle : current.detalle;
    const newCategoria = categoria !== undefined ? categoria : current.categoria;
    const newPrecio = precio !== undefined ? precio : current.precio;
    const newDuracion = duracion !== undefined ? duracion : current.duracion;
    const newImagen = imagen !== undefined ? imagen : current.imagen;
    const newActivo = activo !== undefined ? activo : current.activo;
    const newOrden = orden !== undefined ? orden : current.orden;

    const updateQuery = `
      UPDATE servicios
      SET
        nombre = ?,
        slug = ?,
        descripcion = ?,
        detalle = ?,
        categoria = ?,
        precio = ?,
        duracion = ?,
        imagen = ?,
        activo = ?,
        orden = ?
      WHERE id_servicio = ?
    `;
    const params = [
      newNombre,
      newSlug,
      newDescripcion,
      newDetalle,
      newCategoria,
      newPrecio,
      newDuracion,
      newImagen,
      newActivo,
      newOrden,
      id
    ];
    const [result] = await pool.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo actualizar el servicio' });
    }

    res.json({ message: 'Servicio actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
};

/**
 * Eliminar un servicio
 * - Elimina también sus relaciones en servicios_profesionales por ON DELETE CASCADE (si está así configurada).
 */
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM servicios WHERE id_servicio = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json({ message: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
};

/* ------------------------------------------------------------------
   Métodos para la tabla servicios_profesionales
   ------------------------------------------------------------------ */

/**
 * Asignar un profesional a un servicio
 */
exports.assignProfessional = async (req, res) => {
  try {
    const { id_servicio } = req.params;
    const { id_profesional } = req.body;

    if (!id_profesional) {
      return res.status(400).json({ error: 'Falta el id_profesional en el body' });
    }

    // Verificar existencia del servicio
    const [serviceCheck] = await pool.query(
      'SELECT id_servicio FROM servicios WHERE id_servicio = ?',
      [id_servicio]
    );
    if (!serviceCheck.length) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    // Verificar existencia del profesional
    const [profCheck] = await pool.query(
      'SELECT id_profesional FROM profesionales WHERE id_profesional = ?',
      [id_profesional]
    );
    if (!profCheck.length) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    // Verificar si ya existe esa asociación
    const [assocCheck] = await pool.query(
      'SELECT id FROM servicios_profesionales WHERE id_servicio = ? AND id_profesional = ?',
      [id_servicio, id_profesional]
    );
    if (assocCheck.length > 0) {
      return res.status(400).json({ error: 'Este profesional ya está asignado a este servicio' });
    }

    // Insertar la asociación
    await pool.query(
      'INSERT INTO servicios_profesionales (id_servicio, id_profesional) VALUES (?, ?)',
      [id_servicio, id_profesional]
    );

    res.status(201).json({ message: 'Profesional asignado correctamente al servicio' });
  } catch (error) {
    console.error('Error al asignar profesional a servicio:', error);
    res.status(500).json({ error: 'Error al asignar profesional' });
  }
};

/**
 * Eliminar la asociación entre un servicio y un profesional
 */
exports.removeProfessional = async (req, res) => {
  try {
    const { id_servicio, id_profesional } = req.params;

    // Verificar si existe la asociación
    const [assocCheck] = await pool.query(
      'SELECT id FROM servicios_profesionales WHERE id_servicio = ? AND id_profesional = ?',
      [id_servicio, id_profesional]
    );
    if (!assocCheck.length) {
      return res.status(404).json({ error: 'No se encontró esa asociación' });
    }

    // Eliminarla
    await pool.query(
      'DELETE FROM servicios_profesionales WHERE id_servicio = ? AND id_profesional = ?',
      [id_servicio, id_profesional]
    );
    res.json({ message: 'Asociación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar asociación servicio-profesional:', error);
    res.status(500).json({ error: 'Error al eliminar asociación' });
  }
};

/**
 * Obtener todos los profesionales asignados a un servicio  (uso público)
 * Devuelve:
 *   id_profesional, nombre, num_colegiado, especialidad, notas, mail, foto
 *   – Si foto es NULL o cadena vacía, se sustituye por images/profesionales/default.webp
 */
exports.getProfessionalsByService = async (req, res) => {
  try {
    const { id_servicio } = req.params;

    /* 1) Comprobar que el servicio exista */
    const [serviceCheck] = await pool.query(
      'SELECT 1 FROM servicios WHERE id_servicio = ? LIMIT 1',
      [id_servicio]
    );
    if (!serviceCheck.length) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    /* 2) Traer profesionales asociados (con fallback de foto) */
    const [rows] = await pool.query(
      `SELECT
         p.id_profesional,
         p.nombre,
         p.num_colegiado,
         p.especialidad,
         p.notas,
         p.mail,
         IFNULL(NULLIF(p.foto,''), 'images/profesionales/default.webp') AS foto
       FROM profesionales                p
       INNER JOIN servicios_profesionales sp
               ON sp.id_profesional = p.id_profesional
       WHERE sp.id_servicio = ?
       ORDER BY p.nombre`,
      [id_servicio]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener profesionales de un servicio:', error);
    res.status(500).json({ error: 'Error al obtener profesionales' });
  }
};

/**
 * Obtener todos los servicios asignados a un profesional
 */
exports.getServicesByProfessional = async (req, res) => {
  try {
    const { id_profesional } = req.params;

    // Verificar si existe el profesional
    const [profCheck] = await pool.query(
      'SELECT id_profesional FROM profesionales WHERE id_profesional = ?',
      [id_profesional]
    );
    if (!profCheck.length) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    const query = `
      SELECT s.* 
      FROM servicios s
      INNER JOIN servicios_profesionales sp ON s.id_servicio = sp.id_servicio
      WHERE sp.id_profesional = ?
      ORDER BY s.orden ASC, s.id_servicio ASC
    `;
    const [rows] = await pool.query(query, [id_profesional]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener servicios de un profesional:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

/* ------------------------------------------------------------------
   Métodos para la tabla tipos_bonos (CRUD completo)
   ------------------------------------------------------------------ */

/**
 * Crear un nuevo tipo de bono
 */
exports.createTipoBono = async (req, res) => {
  try {
    const {
      id_servicio,
      nombre,
      sesiones,
      precio_total,
      descuento_calculado,
      porcentaje_descuento,
      observaciones,
      activo
    } = req.body;

    // Validamos campos mínimos
    if (!id_servicio || !nombre || !sesiones || !precio_total) {
      return res.status(400).json({
        error: 'Faltan datos requeridos (id_servicio, nombre, sesiones, precio_total)'
      });
    }

    // Verificar que el servicio exista
    const [serviceCheck] = await pool.query(
      'SELECT id_servicio FROM servicios WHERE id_servicio = ?',
      [id_servicio]
    );
    if (!serviceCheck.length) {
      return res.status(404).json({ error: 'El servicio indicado no existe' });
    }

    const query = `
      INSERT INTO tipos_bonos (
        id_servicio, nombre, sesiones, precio_total,
        descuento_calculado, porcentaje_descuento,
        observaciones, activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id_servicio,
      nombre,
      sesiones,
      precio_total,
      descuento_calculado || 0,
      porcentaje_descuento || 0,
      observaciones || null,
      activo !== undefined ? activo : 1
    ];
    const [result] = await pool.query(query, params);

    res.status(201).json({
      message: 'Tipo de bono creado correctamente',
      id_tipo_bono: result.insertId
    });
  } catch (error) {
    console.error('Error al crear tipo de bono:', error);
    res.status(500).json({ error: 'Error al crear tipo de bono' });
  }
};

/**
 * Obtener todos los tipos de bonos (con filtros opcionales)
 */
exports.getTiposBonos = async (req, res) => {
  try {
    const { nombre, id_servicio, activo } = req.query;

    let query = 'SELECT * FROM tipos_bonos WHERE 1=1';
    const params = [];

    if (nombre) {
      query += ' AND nombre LIKE ?';
      params.push(`%${nombre}%`);
    }
    if (id_servicio) {
      query += ' AND id_servicio = ?';
      params.push(id_servicio);
    }
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo);
    }

    // Ordenar por id_tipo_bono ASC
    query += ' ORDER BY id_tipo_bono ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de bonos:', error);
    res.status(500).json({ error: 'Error al obtener tipos de bonos' });
  }
};

/**
 * Obtener un tipo de bono por su ID
 */
exports.getTipoBonoById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      'SELECT * FROM tipos_bonos WHERE id_tipo_bono = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Tipo de bono no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener tipo de bono:', error);
    res.status(500).json({ error: 'Error al obtener tipo de bono' });
  }
};

/**
 * Actualizar un tipo de bono
 */
exports.updateTipoBono = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      id_servicio,
      nombre,
      sesiones,
      precio_total,
      descuento_calculado,
      porcentaje_descuento,
      observaciones,
      activo
    } = req.body;

    // Verificar si existe el tipo de bono
    const [existing] = await pool.query(
      'SELECT * FROM tipos_bonos WHERE id_tipo_bono = ?',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Tipo de bono no encontrado' });
    }
    const current = existing[0];

    // Si se pasa un id_servicio diferente, verificar que exista en servicios
    if (id_servicio && id_servicio !== current.id_servicio) {
      const [serviceCheck] = await pool.query(
        'SELECT id_servicio FROM servicios WHERE id_servicio = ?',
        [id_servicio]
      );
      if (!serviceCheck.length) {
        return res.status(404).json({ error: 'El servicio indicado no existe' });
      }
    }

    // Mezclar campos
    const newIdServicio = id_servicio !== undefined ? id_servicio : current.id_servicio;
    const newNombre = nombre !== undefined ? nombre : current.nombre;
    const newSesiones = sesiones !== undefined ? sesiones : current.sesiones;
    const newPrecioTotal = precio_total !== undefined ? precio_total : current.precio_total;
    const newDescuentoCalculado = descuento_calculado !== undefined ? descuento_calculado : current.descuento_calculado;
    const newPorcentajeDescuento = porcentaje_descuento !== undefined ? porcentaje_descuento : current.porcentaje_descuento;
    const newObservaciones = observaciones !== undefined ? observaciones : current.observaciones;
    const newActivo = activo !== undefined ? activo : current.activo;

    const updateQuery = `
      UPDATE tipos_bonos
      SET
        id_servicio = ?,
        nombre = ?,
        sesiones = ?,
        precio_total = ?,
        descuento_calculado = ?,
        porcentaje_descuento = ?,
        observaciones = ?,
        activo = ?
      WHERE id_tipo_bono = ?
    `;
    const params = [
      newIdServicio,
      newNombre,
      newSesiones,
      newPrecioTotal,
      newDescuentoCalculado,
      newPorcentajeDescuento,
      newObservaciones,
      newActivo,
      id
    ];
    const [result] = await pool.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo actualizar el tipo de bono' });
    }

    res.json({ message: 'Tipo de bono actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar tipo de bono:', error);
    res.status(500).json({ error: 'Error al actualizar tipo de bono' });
  }
};

/**
 * Eliminar un tipo de bono
 */
exports.deleteTipoBono = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM tipos_bonos WHERE id_tipo_bono = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de bono no encontrado' });
    }

    res.json({ message: 'Tipo de bono eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tipo de bono:', error);
    res.status(500).json({ error: 'Error al eliminar tipo de bono' });
  }
};

/**
 * Listar servicios activos (uso público)
 * Solo campos necesarios y ordenados
 */
exports.getPublicServices = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_servicio, nombre, slug, imagen
       FROM servicios
       WHERE activo = 1
       ORDER BY orden ASC, id_servicio ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener servicios públicos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Obtener un servicio (uso público) buscándolo por slug
 *   GET /api/servicios/public/:slug
 */
exports.getPublicServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM servicios WHERE slug = ? AND activo = 1 LIMIT 1',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error:'Servicio no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener servicio público:', err);
    res.status(500).json({ error:'Error interno del servidor' });
  }
};

/**
 *  Profesionales públicos por *slug* del servicio
 *  GET /api/servicios/public/:slug/profesionales
 */
exports.getPublicProfessionals = async (req, res) => {
  try{
    const { slug } = req.params;

    // 1) id del servicio (activo)
    const [[svc]] = await pool.query(
      'SELECT id_servicio FROM servicios WHERE slug = ? AND activo = 1',
      [slug]
    );
    if (!svc) return res.status(404).json({ error:'Servicio no encontrado' });

    // 2) profesionales enlazados
    const [rows] = await pool.query(
      `SELECT p.nombre,
              p.num_colegiado,
              p.especialidad,
              p.notas,
              p.mail,
			  p.foto
       FROM profesionales p
       JOIN servicios_profesionales sp
         ON p.id_profesional = sp.id_profesional
      WHERE sp.id_servicio = ?
      ORDER BY p.nombre`,          // orden alfabético
      [svc.id_servicio]
    );

    res.json(rows);                // [{nombre,…}, …]
  }catch(err){
    console.error('Error profesionales público:',err);
    res.status(500).json({ error:'Error interno' });
  }
};

/* ------------------------------------------------------------------
   Bonos asociados a un servicio  (uso público – sin api-key)
   GET /api/servicios/:id_servicio/bonos
-------------------------------------------------------------------*/
exports.getBonosByService = async (req, res) => {
  try {
    const { id_servicio } = req.params;

    // 1) ¿existe el servicio y está activo?
    const [[svc]] = await pool.query(
      'SELECT id_servicio FROM servicios WHERE id_servicio = ? AND activo = 1',
      [id_servicio]
    );
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });

    // 2) traer los bonos activos
    const [rows] = await pool.query(
      `SELECT
         id_tipo_bono,
         nombre,
         sesiones,
         precio_total,
         descuento_calculado,
         porcentaje_descuento,
         observaciones
       FROM tipos_bonos
       WHERE id_servicio = ?
         AND activo = 1
       ORDER BY sesiones`,
      [id_servicio]
    );

    res.json(rows);                // ∅ → []
  } catch (err) {
    console.error('Error bonos servicio:', err);
    res.status(500).json({ error: 'Error al obtener bonos' });
  }
};

