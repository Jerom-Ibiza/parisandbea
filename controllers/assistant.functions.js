/* controllers/assistant.functions.js -------------------------------- */
const pool = require('../database');
const path = require('path');
const { createConsentimientoFusionado } = require('./evaluaciones.controller');
const { generateDocument } = require('./documentos.controller');
const { generateConsentimientoPuncionSeca } = require('./documentos.controller');
const { generateConsentimientoSueloPelvico } = require('./documentos.controller');
const { generateConsentDocument } = require('./documentos.controller');
const { searchPatients, updatePatient } = require('./pacientes.controller');
const { sendMail, getEmailTemplate } = require('./mail.controller');
const { getAllProfesionales } = require('./profesionales.controller');
const { getCurrentDateTime } = require('./home.controller');
const { getLastChats } = require('./chats.controller');
const { listFiles } = require('./files.controller');
const {
  startDraft,
  appendChunk,
  finalizeDraft
} = require('./documentos.controller');

/* controllers/assistant.functions.js */
async function loadSessionInfo(req) {
  /* ── 1. datos de sesión ───────────────────────────── */
  const user = req.session.user || null;
  const patient = req.session.patient || null;
  if (!patient) return { user, patient: null };

  /* ── 2. paciente (solo campos permitidos) ─────────── */
  const [pRows] = await pool.query(
    `SELECT id_paciente,
            fecha_nacimiento,
            fecha_registro,
            genero
       FROM pacientes
      WHERE id_paciente = ?
      LIMIT 1`,
    [patient.id_paciente]
  );

  /* pseudónimo: PAC-00023, por ejemplo */
  const p = pRows[0];
  const safePatient = {
    code: `PAC-${String(p.id_paciente).padStart(5, '0')}`,
    fecha_nacimiento: p.fecha_nacimiento,
    fecha_registro: p.fecha_registro,
    genero: p.genero
  };

  /* ── 3. resto de bloques clínicos ─────────────────── */
  const [hRows] = await pool.query(
    `SELECT motivo_consulta, fecha_inicio_problema,
            antecedentes_personales, antecedentes_familiares,
            tratamientos_previos, medicacion_actual, alergias,
            habitos_vida, profesion
       FROM historial_clinico
      WHERE id_paciente = ? LIMIT 1`,
    [patient.id_paciente]
  );

  const [evRows] = await pool.query(
    `SELECT e.*, pr.nombre AS prof_nombre
       FROM evaluaciones e
       LEFT JOIN profesionales pr ON pr.id_profesional = e.id_profesional
      WHERE e.id_paciente = ?
      ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC
      LIMIT 1`,
    [patient.id_paciente]
  );

  const [trRows] = await pool.query(
    `SELECT t.*, pr.nombre AS prof_nombre
       FROM tratamientos t
       LEFT JOIN profesionales pr ON pr.id_profesional = t.id_profesional
      WHERE t.id_paciente = ?
      ORDER BY t.fecha_inicio DESC, t.id_tratamiento DESC
      LIMIT 1`,
    [patient.id_paciente]
  );

  const [seRows] = await pool.query(
    `SELECT s.*, pr.nombre AS prof_nombre
       FROM sesiones s
       LEFT JOIN profesionales pr ON pr.id_profesional = s.id_profesional
       INNER JOIN tratamientos t ON t.id_tratamiento = s.id_tratamiento
      WHERE t.id_paciente = ?
      ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC, s.id_sesion DESC
      LIMIT 1`,
    [patient.id_paciente]
  );

  /* ── 4. devolvemos todo ya seudonimizado ───────────── */
  return {
    user,
    patient: safePatient,          // ← sin datos personales
    historial: hRows[0] || null,
    evaluacion: evRows[0] || null,
    tratamiento: trRows[0] || null,
    sesion: seRows[0] || null
  };
}

/* ---- el mismo objeto LOCAL_FUNCTIONS tal cual ---- */
const LOCAL_FUNCTIONS = {
  /* ────────── INFO DE CONTEXTO ────────── */
  async get_session_info(_a, req) { return await loadSessionInfo(req); },

  async get_prof_preferences(_a, req) {
    const id = req.session.user.id_profesional;
    const [rows] = await pool.query(
      'SELECT preferencias FROM profesionales WHERE id_profesional = ? LIMIT 1', [id]);
    return rows[0]?.preferencias || null;
  },

  /* ────────── HISTORIAL ────────── */
  async add_historial(args, req) {
    const id_paciente = req.session.patient.id_paciente;
    await pool.query(
      'INSERT INTO historial_clinico SET ? ON DUPLICATE KEY UPDATE ?',
      [{ ...args, id_paciente }, { ...args }]
    );
    return { ok: true, message: 'Historial clínico registrado correctamente' };
  },

  async update_historial({ campo, valor }, req) {
    const allowed = ['motivo_consulta', 'fecha_inicio_problema', 'antecedentes_personales',
      'antecedentes_familiares', 'tratamientos_previos', 'medicacion_actual', 'alergias',
      'habitos_vida', 'profesion'];
    if (!allowed.includes(campo)) throw new Error('Campo no permitido');

    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      'SELECT 1 FROM historial_clinico WHERE id_paciente = ? LIMIT 1', [id_paciente]);
    if (!rows.length) throw new Error('El paciente no tiene historial');

    await pool.query(`UPDATE historial_clinico SET ${campo} = ? WHERE id_paciente = ?`,
      [valor, id_paciente]);
    return { ok: true, message: 'Historial clínico actualizado correctamente' };
  },

  /* ────────── EVALUACIONES ────────── */
  async add_evaluacion(args, req) {
    const id_paciente = req.session.patient.id_paciente;
    const id_profesional = req.session.user.id_profesional;
    await pool.query('INSERT INTO evaluaciones SET ?', { ...args, id_paciente, id_profesional });
    return { ok: true, message: 'Evaluación registrada correctamente' };
  },

  async update_evaluacion({ campo, valor }, req) {
    const allowed = ['fecha_evaluacion', 'dolor_localizacion', 'dolor_intensidad', 'dolor_tipo',
      'dolor_irradia', 'dolor_descripcion', 'inspeccion_visual', 'palpacion', 'movilidad_articular',
      'pruebas_funcionales', 'valoracion_neurologica', 'valoracion_postural',
      'evaluacion_funcional', 'diagnostico', 'objetivos_terapeuticos'];
    if (!allowed.includes(campo)) throw new Error('Campo no permitido');

    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT id_evaluacion FROM evaluaciones
       WHERE id_paciente = ? ORDER BY fecha_evaluacion DESC, id_evaluacion DESC LIMIT 1`,
      [id_paciente]);
    if (!rows.length) throw new Error('No hay evaluaciones para actualizar');

    await pool.query(`UPDATE evaluaciones SET ${campo} = ? WHERE id_evaluacion = ?`,
      [valor, rows[0].id_evaluacion]);
    return { ok: true, message: 'Evaluación actualizada correctamente' };
  },

  async get_last_evaluaciones({ n = 1 }, req) {
    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT * FROM evaluaciones
       WHERE id_paciente = ?
       ORDER BY fecha_evaluacion DESC, id_evaluacion DESC LIMIT ?`,
      [id_paciente, Math.min(Number(n) || 1, 5)]);
    return rows;
  },

  /* ────────── TRATAMIENTOS ────────── */
  async add_tratamiento(args, req) {
    const id_paciente = req.session.patient.id_paciente;
    const id_profesional = req.session.user.id_profesional;
    await pool.query('INSERT INTO tratamientos SET ?', { ...args, id_paciente, id_profesional });
    return { ok: true, message: 'Tratamiento registrado correctamente' };
  },

  async update_tratamiento({ campo, valor }, req) {
    const allowed = ['fecha_inicio', 'fecha_fin', 'tecnicas_aplicadas', 'frecuencia_sesiones',
      'duracion_sesion', 'recomendaciones', 'estado', 'suplemento_prescrito', 'capsulas_por_bote',
      'dosis_diaria', 'fecha_inicio_suplementacion', 'dias_alerta'];
    if (!allowed.includes(campo)) throw new Error('Campo no permitido');

    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT id_tratamiento FROM tratamientos
       WHERE id_paciente = ? ORDER BY fecha_inicio DESC, id_tratamiento DESC LIMIT 1`,
      [id_paciente]);
    if (!rows.length) throw new Error('No hay tratamientos para actualizar');

    await pool.query(`UPDATE tratamientos SET ${campo} = ? WHERE id_tratamiento = ?`,
      [valor, rows[0].id_tratamiento]);
    return { ok: true, message: 'Tratamiento actualizado correctamente' };
  },

  async get_last_tratamientos({ n = 1 }, req) {
    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT * FROM tratamientos
       WHERE id_paciente = ?
       ORDER BY fecha_inicio DESC, id_tratamiento DESC LIMIT ?`,
      [id_paciente, Math.min(Number(n) || 1, 5)]);
    return rows;
  },

  /* ────────── SESIONES ────────── */
  async add_sesion(args, req) {
    const id_profesional = req.session.user.id_profesional;
    const id_paciente = req.session.patient.id_paciente;

    const [rows] = await pool.query(
      `SELECT id_tratamiento FROM tratamientos
       WHERE id_paciente = ? ORDER BY fecha_inicio DESC, id_tratamiento DESC LIMIT 1`,
      [id_paciente]);
    if (!rows.length) throw new Error('El paciente no tiene tratamientos');

    await pool.query('INSERT INTO sesiones SET ?', {
      ...args, id_tratamiento: rows[0].id_tratamiento, id_profesional
    });
    return { ok: true, message: 'Sesión registrada correctamente' };
  },

  async update_sesion({ campo, valor }, req) {
    /* columnas que SÍ se pueden tocar */
    const allowed = [
      'fecha_sesion', 'hora_sesion', 'tecnicas_utilizadas', 'evolucion',
      'modificaciones_tratamiento', 'observaciones', 'id_bono'
    ];
    if (!allowed.includes(campo)) throw new Error('Campo no permitido');

    /* última sesión del paciente (la más reciente) */
    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT s.id_sesion FROM sesiones s
		   INNER JOIN tratamientos t ON t.id_tratamiento = s.id_tratamiento
		 WHERE t.id_paciente = ?
		 ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC, s.id_sesion DESC
		 LIMIT 1`,
      [id_paciente]
    );
    if (!rows.length) throw new Error('No hay sesiones para actualizar');

    await pool.query(`UPDATE sesiones SET ${campo} = ? WHERE id_sesion = ?`,
      [valor, rows[0].id_sesion]);

    return { ok: true, message: 'Sesión actualizada correctamente' };
  },


  async get_last_sesiones({ n = 1 }, req) {
    const id_paciente = req.session.patient.id_paciente;
    const [rows] = await pool.query(
      `SELECT s.* FROM sesiones s
       INNER JOIN tratamientos t ON t.id_tratamiento = s.id_tratamiento
       WHERE t.id_paciente = ?
       ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC, s.id_sesion DESC LIMIT ?`,
      [id_paciente, Math.min(Number(n) || 1, 10)]);
    return rows;
  },

  /* ────────── CONSENTIMIENTO PDF ────────── */
  /**
   * Genera el PDF de consentimiento (fisioterapia ↔ osteopatía) y
   * devuelve la misma respuesta JSON que la ruta /api/consentimientos.
   *
   * Args opcionales:
   *   - nombre_representado
   *   - calidad_representante
   *   - dni_representante
   */
  async create_consentimiento(args = {}, req) {
    if (!req.session.user || !req.session.patient)
      throw new Error('Sesión no válida');

    const payload = {
      id_paciente: req.session.patient.id_paciente,
      id_profesional: req.session.user.id_profesional,
      ...args
    };

    /* devolvemos una Promise que se resuelve en mockRes.json() */
    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload };

      const mockRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(obj) {
          /* 2xx ⇒ OK, cualquier otro ⇒ rechazar */
          if (this.statusCode >= 200 && this.statusCode < 300)
            return resolve(obj);
          return reject(new Error(obj?.error || 'Error generando consentimiento'));
        }
      };

      /* cualquier throw dentro de createConsentimientoFusionado */
      createConsentimientoFusionado(mockReq, mockRes)
        .catch(err => reject(err));
    });
  },
  /* ────────── PDF CORPORATIVO GENÉRICO ────────── */
  /**
   * Crea un PDF corporativo a partir de título + contenido y devuelve:
   *   { message, pdfURL }
   *
   * Args obligatorios:
   *   - tituloDocumento (string)
   *   - contenido       (string | string[])
   *
   * Args opcionales:
   *   - fechaDocumento  (string dd/mm/aaaa)
   *   - nombreArchivo   (string, con .pdf)
   *   - colorTitulo     (hex o rgb)
   *   - colorTexto      (hex o rgb)
   *   - colorDatos      (hex o rgb)
   *   - imagenes        (array de rutas/URLs relativas)
   */
  async generate_document(args = {}, req) {
    if (!req.session.user)
      throw new Error('Sesión no válida');

    /* completamos datos que el asistente no tiene por qué pedir */
    const payload = {
      profesionalId: req.session.user.id_profesional,
      ...args
    };

    /* devolvemos una Promise que se resuelve cuando el PDF está listo */
    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload };
      const mockRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300)
            return resolve(obj);
          return reject(new Error(obj?.error || 'Error generando documento'));
        }
      };

      generateDocument(mockReq, mockRes)
        .catch(err => reject(err));
    });
  },
  /* ────────── CONSENTIMIENTO | PUNCIÓN SECA ────────── */
  /**
   * Genera el consentimiento informado de punción seca
   * y devuelve { message, pdfFile, pdfUrl } cuando está listo.
   *
   * Args opcionales:
   *   - revocar  (boolean) → true si el paciente revoca el consentimiento
   */
  async create_consentimiento_puncionseca(args = {}, req) {
    if (!req.session.user || !req.session.patient)
      throw new Error('Sesión no válida');

    const payload = {
      id_paciente: req.session.patient.id_paciente,
      id_profesional: req.session.user.id_profesional,
      ...args
    };

    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload };
      const mockRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300)
            return resolve(obj);
          return reject(new Error(obj?.error || 'Error generando consentimiento punción seca'));
        }
      };

      generateConsentimientoPuncionSeca(mockReq, mockRes)
        .catch(reject);
    });
  },
  /* ────────── CONSENTIMIENTO | SUELO PÉLVICO ────────── */
  /**
   * Genera el consentimiento informado de fisioterapia de suelo pélvico
   * y devuelve { message, pdfFile, pdfUrl } cuando el PDF está listo.
   *
   * Args opcionales:
   *   - nombreArchivo        (string .pdf)
   *   - representanteLegal : { nombre, dni, parentesco }
   */
  async create_consentimiento_suelopelvico(args = {}, req) {
    if (!req.session.user || !req.session.patient)
      throw new Error('Sesión no válida');

    const payload = {
      id_paciente: req.session.patient.id_paciente,
      id_profesional: req.session.user.id_profesional,
      ...args
    };

    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload };
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300)
            return resolve(obj);
          return reject(new Error(obj?.error || 'Error generando consentimiento suelo pélvico'));
        }
      };

      generateConsentimientoSueloPelvico(mockReq, mockRes)
        .catch(reject);
    });
  },
  /* ────────── CONSENTIMIENTO | LOPD ────────── */
  /**
   * Crea el PDF de consentimiento LOPD y devuelve
   * { message, pdfURL, setCode }.
   *
   * Args opcionales (enviados al controlador):
   *   - nombreArchivo   (string .pdf)
   *   - fechaDocumento  (string yyyy-mm-dd)
   */
  async create_consentimiento_lopd(args = {}, req) {
    if (!req.session.user || !req.session.patient)
      throw new Error('Sesión no válida');

    /* ahora solo pasamos los IDs y los opcionales que nos lleguen */
    const payload = {
      id_paciente: req.session.patient.id_paciente,
      id_profesional: req.session.user.id_profesional,  // por si tuvieras lógica futura
      ...args                                          // nombreArchivo, fechaDocumento…
    };

    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload };
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
          reject(new Error(obj?.error || 'Error generando consentimiento LOPD'));
        }
      };
      generateConsentDocument(mockReq, mockRes).catch(reject);
    });
  },

  /* ────────── ENVIAR EMAIL ────────── */
  async send_mail(args = {}, req) {
    const { to, subject, text, htmlContent, attachments } = args;
    if (!to || !subject) throw new Error('Faltan "to" o "subject"');

    /* Generamos SIEMPRE el HTML con la plantilla corporativa  */
    const html = getEmailTemplate(
      subject,
      htmlContent || (text ? `<p>${text}</p>` : '')
    );

    const payload = {
      id_profesional: req.session.user?.id_profesional ?? null,   // ← clave que el controlador espera
      to,
      subject,
      text: 'Visualiza este correo en un cliente que soporte HTML.',
      htmlContent: html,
      attachments
    };

    return await new Promise((resolve, reject) => {
      const mockReq = { body: payload, session: req.session };  // pasamos la sesión por si acaso
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
          reject(new Error(obj?.error || 'Error enviando email'));
        }
      };
      sendMail(mockReq, mockRes).catch(reject);
    });
  },
  /* ────────── LISTAR PROFESIONALES ────────── */
  /**
   * Devuelve la lista completa de profesionales del centro
   * (máx. 5 registros).
   */
  async get_profesionales() {
    return await new Promise((resolve, reject) => {
      const mockReq = {};       // no necesita query ni body
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
          reject(new Error(obj?.error || 'Error obteniendo profesionales'));
        }
      };
      getAllProfesionales(mockReq, mockRes).catch(reject);
    });
  },

  /* ────────── PRODUCTOS ────────── */
  /**
   * Devuelve todos los productos activos con campos mínimos
   *   id_producto, nombre, marca, proposito, imagen y pvp
   */
  async get_active_products() {
    const [rows] = await pool.query(
      `SELECT id_producto, nombre, marca, proposito, imagen, pvp
         FROM productos
        WHERE activo = 1
     ORDER BY orden ASC, id_producto ASC`
    );
    const base = process.env.PUBLIC_HOST || 'https://parisandbea.es';
    return rows.map(r => {
      if (r.imagen)
        r.imagen = `${base}/${r.imagen.replace(/^\/+/, '')}`;
      return r;
    });               // [{ id_producto, nombre, marca, ... }, …]
  },

  /**
   * Devuelve la información completa de un producto por ID
   *   marca, nombre, dosis, forma, cantidad_envase,
   *   imagen, peso_neto, proposito, caracteristicas,
   *   info_fabricante, explicacion_centro, posologia,
   *   en_stock_clinica y pvp
   */
  async get_product_by_id({ id_producto }) {
    if (!id_producto) throw new Error('Falta id_producto');

    const [rows] = await pool.query(
      `SELECT marca, nombre, dosis, forma, cantidad_envase,
              imagen, peso_neto, proposito, caracteristicas,
              info_fabricante, explicacion_centro, posologia,
              en_stock_clinica, pvp
         FROM productos
        WHERE id_producto = ?
        LIMIT 1`,
      [id_producto]
    );

    if (!rows.length) throw new Error('Producto no encontrado');
    const base = process.env.PUBLIC_HOST || 'https://parisandbea.es';
    if (rows[0].imagen)
      rows[0].imagen = `${base}/${rows[0].imagen.replace(/^\/+/, '')}`;
    return rows[0];
  },

  /* ────────── FECHA / HORA ACTUAL ────────── */
  /**
   * Devuelve la fecha y hora actuales en formato ISO-8601
   *   { currentDateTime: "2025-05-04T09:41:15.123Z" }
   */
  async get_datetime() {
    return await new Promise((resolve, reject) => {
      const mockReq = {};
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(obj) {
          if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
          reject(new Error('Error obteniendo fecha/hora'));
        }
      };
      getCurrentDateTime(mockReq, mockRes).catch(reject);
    });
  },
  /* ────────── CHATS (conversaciones) ────────── */
  /**
   * Devuelve la última o las N (máx. 3) conversaciones guardadas
   * del profesional y el paciente en sesión.
   *
   * Args opcional:
   *   - limit  (int 1-3)  ← por defecto 1
   *
   * Respuesta: array ordenado ↓ más reciente primero
   *   [{ id_chat, conversacion, fecha_hora, estado }, …]
   */
  async get_last_chats({ limit = 1 } = {}, req) {
    if (!req.session.user || !req.session.patient)
      throw new Error('Sesión no válida');

    const id_profesional = req.session.user.id_profesional;
    const id_paciente = req.session.patient.id_paciente;
    const n = Math.max(1, Math.min(Number(limit) || 1, 3));

    const [rows] = await pool.query(
      `SELECT id_chat, conversacion, fecha_hora, estado
         FROM chats
        WHERE id_profesional = ? AND id_paciente = ?
        ORDER BY fecha_hora DESC
        LIMIT ?`,
      [id_profesional, id_paciente, n]
    );

    return rows;             // ← el asistente los resumirá
  },
  /* ────────── BORRADOR PDF CHUNKED ────────── */
  async start_document(args, req) {
    const payload = {
      tituloDocumento: args.tituloDocumento,
      opcionesJSON: JSON.stringify(args.opciones || null),
      profesionalId: req.session.user.id_profesional
    };
    return await new Promise((resolve, reject) =>
      startDraft({ body: payload, session: req.session }, {
        status: c => ({ json: o => c >= 200 && c < 300 ? resolve(o) : reject(o) }),
        json: o => resolve(o)
      }).catch(reject)
    );
  },

  async append_chunk(args, _req) {
    return await new Promise((resolve, reject) =>
      appendChunk({ body: args }, {
        status: c => ({ json: o => c >= 200 && c < 300 ? resolve(o) : reject(o) }),
        json: o => resolve(o)
      }).catch(reject)
    );
  },

  async finalize_document(args, _req) {
    return await new Promise((resolve, reject) =>
      finalizeDraft({ body: args }, {
        status: c => ({ json: o => c >= 200 && c < 300 ? resolve(o) : reject(o) }),
        json: o => resolve(o)
      }).catch(reject)
    );
  },

  /* ────────── LISTAR ARCHIVOS TEMPORALES (/tmp) ────────── */
  async list_tmp_files(_args, req) {
    return req.session.tmpFiles || [];
  },

  /* ────────── LISTAR ADJUNTOS PERMANENTES DEL PACIENTE ────────── */
  async list_patient_files({ limit = 10 } = {}, req) {
    if (!req.session.patient) throw new Error('Sin paciente en la sesión');

    const id_paciente = req.session.patient.id_paciente;
    const n = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

    const [rows] = await pool.query(
      `SELECT id_file, filename, filepath, mime_type, uploaded_at
		   FROM patient_files
		  WHERE id_paciente = ?
		  ORDER BY uploaded_at DESC
		  LIMIT ?`,
      [id_paciente, n]
    );

    const base = process.env.PUBLIC_HOST || `${req.protocol}://${req.get('host')}`;

    // Devolver al modelo un array de frases directamente linkeables
    return {
      ok: true,
      files: rows.map(f => {
        const fullUrl = `${base}/${f.filepath.replace(/^\/+/, '')}`;
        return `📎 ${f.filename} → ${fullUrl}`;
      })
    };
  },

  /* ────────── OBTENER UN ADJUNTO POR id_file ────────── */
  async get_patient_file({ id_file }, req) {
    if (!id_file) throw new Error('Falta id_file');

    const [rows] = await pool.query(
      `SELECT filepath, filename
         FROM patient_files
        WHERE id_file = ?
        LIMIT 1`,
      [id_file]
    );
    if (!rows.length) throw new Error('Archivo no encontrado');

    /* construimos URL absoluta accesible por OpenAI */
    const base = process.env.PUBLIC_HOST ||            // ej. https://parisandbea.es
      `${req.protocol}://${req.get('host')}`;
    return {
      filename: rows[0].filename,
      url: `${base}/${rows[0].filepath.replace(/^[\\/]/, '')}`
    };
  },

  /* ────────── LISTADO DE ARCHIVOS EN EL SERVIDOR ────────── */
  async list_files({ folder }, req) {
    if (!folder) throw new Error('Parametro folder obligatorio');

    return await new Promise((resolve, reject) => {
      listFiles(
        { params: { folder }, session: req.session },
        {
          json: obj => resolve(obj),
          status: c => ({ json: o => reject(new Error(o?.error || 'Error')) })
        }
      );
    });
  },
};

module.exports = { LOCAL_FUNCTIONS, loadSessionInfo };
