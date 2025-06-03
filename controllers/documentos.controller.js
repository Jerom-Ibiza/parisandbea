const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const pool = require('../database');
const { enviarConsentimiento } = require('../utils/viafirma');

const CHUNK_MAX = 15_000;

/**
 * Crea un borrador vac�o y devuelve su id_draft.
 * Body requerido: { tituloDocumento, opcionesJSON? }
 */
exports.startDraft = async (req, res) => {
  try {
    const { tituloDocumento, opcionesJSON } = req.body;
    const id_profesional = req.session?.user?.id_profesional || req.body.profesionalId;

    if (!tituloDocumento) return res.status(400).json({ error: 'Falta tituloDocumento' });
    if (!id_profesional) return res.status(400).json({ error: 'Falta id_profesional' });

    const [result] = await pool.query(
      'INSERT INTO document_drafts SET ?',
      { id_profesional, titulo: tituloDocumento, opciones_json: opcionesJSON || null }
    );

    res.status(201).json({ draftId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar borrador' });
  }
};

/**
 * A�ade un fragmento a un borrador existente.
 * Body requerido: { draftId, texto }
 */
exports.appendChunk = async (req, res) => {
  try {
    let { draftId, texto } = req.body;
    draftId = Number(draftId);
    if (!draftId || !texto) return res.status(400).json({ error: 'draftId y texto son obligatorios' });

    /* l�mite b�sico de tama�o */
    if (texto.length > CHUNK_MAX)
      texto = texto.slice(0, CHUNK_MAX);

    /* calcula orden = �ltimo+1 */
    const [[{ next }]] = await pool.query(
      'SELECT IFNULL(MAX(orden),0)+1 AS next FROM document_chunks WHERE id_draft = ?',
      [draftId]
    );

    await pool.query(
      'INSERT INTO document_chunks SET ?',
      { id_draft: draftId, orden: next, texto }
    );

    res.json({ ok: true, orden: next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al a�adir chunk' });
  }
};

/**
 * Compone el PDF con todos los chunks, llama a generateDocument()
 * y elimina el borrador. Body requerido: { draftId }
 */
exports.finalizeDraft = async (req, res) => {
  try {
    const draftId = Number(req.body.draftId);
    if (!draftId) return res.status(400).json({ error: 'draftId requerido' });

    /* cabecera + opciones */
    const [[draft]] = await pool.query(
      'SELECT * FROM document_drafts WHERE id_draft = ?',
      [draftId]
    );
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });

    /* chunks en orden */
    const [rows] = await pool.query(
      'SELECT texto FROM document_chunks WHERE id_draft = ? ORDER BY orden',
      [draftId]
    );
    if (!rows.length) return res.status(400).json({ error: 'Borrador vac�o' });

    const contenido = rows.map(r => r.texto);

    /* armamos payload reutilizando tu funci�n existente */
    req.body = {
      tituloDocumento: draft.titulo,
      contenido,
      ...JSON.parse(draft.opciones_json || '{}'),
      profesionalId: draft.id_profesional
    };

    /* delegamos en generateDocument y esperamos su JSON */
    const mockSend = data => {
      /* borramos borrador */
      pool.query('DELETE FROM document_drafts WHERE id_draft = ?', [draftId]).catch(console.error);
      pool.query('DELETE FROM document_chunks WHERE id_draft = ?', [draftId]).catch(console.error);
      res.json(data);                     // devolvemos al cliente
    };

    // usamos la l�gica ya existente
    await exports.generateDocument(
      { ...req, body: req.body },
      { json: mockSend, status: () => ({ json: mockSend }) }
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al finalizar borrador' });
  }
};

/**
 * Genera un documento PDF corporativo y lo guarda en /documentos.
 */
exports.generateDocument = async (req, res) => {
  try {
    /* ───────────── 0. Entrada y validación ───────────── */
    const {
      tituloDocumento,
      contenido,
      fechaDocumento,
      nombreArchivo,
      colorTitulo,
      colorTexto,
      colorDatos,
      imagenes
    } = req.body;

    if (!tituloDocumento) return res.status(400).json({ error: "Falta 'tituloDocumento'." });
    if (!contenido) return res.status(400).json({ error: "Falta 'contenido'." });

    /* helper: quita guiones largos que provocaban □ */
    const fixDash = str => typeof str === 'string'
      ? str.replace(/[‐-‒–—−]/g, '-')
      : str;

    /* ───────────── 1. Fecha mostrada ───────────── */
    const hoy = new Date();
    const fechaMostrada = fechaDocumento ||
      `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

    /* ───────────── 2. Datos corporativos ───────────── */
    const [homeRows] = await db.query('SELECT * FROM home ORDER BY id_home DESC LIMIT 1');
    const hd = homeRows[0] || {};

    const centerCIF = fixDash(hd.cif || 'B12345678');
    const centerAddress = fixDash(hd.direccion_centro || 'C/ Ejemplo, nº 1. Ibiza.');
    const centerMail = fixDash(hd.mail || 'info@parisandbea.es');
    const titColor = colorTitulo || hd.titulos_color || '#aed3c1';
    const datosColor = colorDatos || hd.texto_botones_color || '#000000';
    const textoColor = colorTexto || '#000000';

    const fontBase = hd.tipografia || 'Montserrat';
    const regFont = fs.existsSync(path.join(__dirname, '..', 'fonts', `${fontBase}-Regular.ttf`))
      ? path.join(__dirname, '..', 'fonts', `${fontBase}-Regular.ttf`)
      : path.join(__dirname, '..', 'fonts', 'Montserrat-Regular.ttf');
    const boldFont = fs.existsSync(path.join(__dirname, '..', 'fonts', `${fontBase}-Bold.ttf`))
      ? path.join(__dirname, '..', 'fonts', `${fontBase}-Bold.ttf`)
      : path.join(__dirname, '..', 'fonts', 'Montserrat-Bold.ttf');

    /* ───────────── 3. Crear PDF ───────────── */
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = nombreArchivo || `Documento_${Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, '..', 'documentos', pdfName);
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.registerFont('Reg', regFont);
    doc.registerFont('Bold', boldFont);
    doc.font('Reg');

    /* logo opcional */
    const logo = path.join(__dirname, '..', 'images', 'recursos', 'parisandbealogo.png');
    if (fs.existsSync(logo)) doc.image(logo, 440, 40, { width: 100 });

    /* cabecera */
    doc.fontSize(12).fillColor(datosColor);
    doc.font('Bold')
      .text(`NIF/CIF: ${centerCIF}`, 340, 100, { align: 'right' })
      .moveDown(0.5)
      .font('Reg')
      .text(centerAddress, 340, doc.y, { align: 'right', width: 220 })
      .text(`Fecha: ${fechaMostrada}`, 50, Math.max(doc.y, 140));

    /* línea separadora */
    doc.moveDown(1)
      .strokeColor(titColor).lineWidth(1)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      .moveDown(1);

    /* ───────────── 3 bis. Título dinámico con fondo 🔄 ───────────── */
    const rectWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rectX = doc.page.margins.left;
    const rectYStart = doc.y;                         // posición actual
    const radius = 8;
    const paddingY = 10;                            // padding vertical

    doc.font('Bold').fontSize(14);                    // mismas características que usaremos
    const textHeight = doc.heightOfString(
      fixDash(tituloDocumento),
      { width: rectWidth, align: 'center' }
    );
    const rectHeight = textHeight + paddingY * 2;     // contenedor dinámico

    /* Comprobamos que cabe en la página antes de dibujar */
    if (rectYStart + rectHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    // Dibujar rectángulo de fondo corporativo
    doc.save()
      .roundedRect(rectX, rectYStart, rectWidth, rectHeight, radius)
      .fill(titColor)
      .restore();

    // Escribir título (blanco, centrado)
    doc.fillColor('#FFFFFF')
      .text(
        fixDash(tituloDocumento),
        rectX,
        rectYStart + paddingY,
        { width: rectWidth, align: 'center' }
      );

    // Situar el cursor debajo del contenedor
    doc.y = rectYStart + rectHeight + 20;

    /* ───────────── 4. Contenido & texto                       ─── */
    doc.font('Reg').fontSize(12).fillColor(textoColor);

    const pageH = doc.page.height;
    const botMarg = doc.page.margins.bottom;
    const ensureRoom = extra => {
      if (doc.y + extra > pageH - botMarg) doc.addPage();
    };

    /* texto (array o string) – ahora justificado 🔄 */
    (Array.isArray(contenido) ? contenido : [contenido]).forEach(p => {
      if (typeof p !== 'string') return;
      doc.text(
        fixDash(p.trim()),
        { align: 'justify', lineGap: 4 }
      ).moveDown();
      ensureRoom(0);
    });

    /* ───────────── 5. Imágenes opcionales ───────────── */
    const imgs = Array.isArray(imagenes) ? imagenes : [];
    const MAX_W = 460, MAX_H = 520;
    imgs.forEach(rel => {
      const abs = path.join(__dirname, '..', rel.replace(/^[\\/]/, ''));
      if (!fs.existsSync(abs)) return;

      let { width, height } = (() => { try { return sizeOf(abs); } catch { return { width: MAX_W, height: MAX_H }; } })();
      const scale = Math.min(MAX_W / width, MAX_H / height);
      width *= scale; height *= scale;

      ensureRoom(height + 20);
      const x = (doc.page.width - width) / 2;
      doc.image(abs, x, doc.y, { width }).moveDown();
    });

    /* ───────────── 6. Cerrar PDF ───────────── */
    doc.end();
    stream.on('finish', () =>
      res.json({
        message: 'Documento PDF generado correctamente',
        pdfURL: `https://parisandbea.es/documentos/${pdfName}`
      })
    );
    stream.on('error', () =>
      res.status(500).json({ error: 'Error al generar el PDF' })
    );

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
};

/* ────────────────────────────────────────────────────────────────
   1. GENERAR CONSENTIMIENTO INFORMADO (LOPD)
   ---------------------------------------------------------------- */
exports.generateConsentDocument = async (req, res) => {
  try {
    /* 1.1  datos de entrada */
    const {
      id_paciente,          // ← NUEVO  (recomendado)
      fechaDocumento,
      nombreArchivo,
      sendViafirma = true
    } = req.body || {};

    /* 1.2  obtenemos datos del paciente directamente de BD
            (solo nombre, apellidos, dni, email)               */
    let paciente = {};
    if (id_paciente) {
      const [rows] = await db.query(
        `SELECT id_paciente, nombre, apellidos, dni, email, telefono
           FROM pacientes
          WHERE id_paciente = ? LIMIT 1`,
        [id_paciente]
      );
      if (!rows.length)
        return res.status(404).json({ error: 'Paciente no encontrado.' });
      paciente = rows[0];
    }

    /* 1.3  aseguramos campos mínimos para el PDF                    */
    const nombrePaciente = `${paciente.nombre || ''} ${paciente.apellidos || ''}`.trim();
    const dniPaciente = paciente.dni || '—';
    const emailPaciente = paciente.email || 'info@parisandbea.es';

    if (!nombrePaciente || dniPaciente === '—') {
      return res
        .status(400)
        .json({ error: 'Faltan datos del paciente (nombre o DNI).' });
    }

    /* 1.4  pseudónimo para nombre de archivo anónimo */
    const pseudo = id_paciente
      ? `PAC-${String(id_paciente).padStart(5, '0')}`
      : `ANON-${Date.now()}`;
    const defaultFileName = `${pseudo}_LOPD.pdf`;
    const pdfFileName = nombreArchivo || defaultFileName;

    /* 2. ruta y stream para el PDF en disco ----------------------- */
    const consentFolder = path.join(__dirname, '..', 'documentos', 'consentimientos');
    if (!fs.existsSync(consentFolder)) fs.mkdirSync(consentFolder, { recursive: true });
    const pdfFilePath = path.join(consentFolder, pdfFileName);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(pdfFilePath);
    doc.pipe(stream);

    /* 3. tipografías y logo --------------------------------------- */
    const fontRegular = path.join(__dirname, '..', 'fonts', 'Raleway-Regular.ttf');
    const fontBold = path.join(__dirname, '..', 'fonts', 'Raleway-Bold.ttf');
    if (fs.existsSync(fontRegular)) doc.registerFont('Raleway', fontRegular);
    if (fs.existsSync(fontBold)) doc.registerFont('Raleway-Bold', fontBold);

    const logoPath = path.join(__dirname, '..', 'images', 'recursos', 'parisandbealogo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 75, 40, { width: 150 });
    }

    /* 4. datos dinámicos de la BBDD (tabla home) ----------------- */
    const [homeRows] = await db.query('SELECT * FROM home ORDER BY id_home DESC LIMIT 1');
    const home = homeRows[0] || {};
    const nombreResponsable = home.responsable_datos || 'PARIS AGUIRREZABALA ARMBRUSTER';
    const cifResponsable = home.cif_responsable_datos || '51067638W';
    const direccionCentro = home.direccion_centro || 'Carrer d’Atenes, 18. C.P. 07817. Sant Josep de sa Talaia, Illes Balears.';
    const mailCentro = home.mail || 'info@parisandbea.es';

    /* 5. fecha mostrada en el documento -------------------------- */
    const hoy = new Date();
    const fechaMostrada = fechaDocumento
      ? fechaDocumento.split('-').reverse().join('-')      // yyyy-mm-dd → dd-mm-yyyy
      : `${String(hoy.getDate()).padStart(2, '0')}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`;

    /* 6. contenido del PDF (igual que antes) --------------------- */
    const secciones = [
      ['A. RESPONSABLE:', [
        `• ${nombreResponsable} (${cifResponsable})`,
        `• ${direccionCentro}`,
        `• ${mailCentro}`
      ]],
      ['B. FINALIDADES:', [
        '• Prestación asistencial al paciente (visitas médicas, intervenciones, pruebas).',
        '• Gestión del paciente y su historia clínica.',
        '• Tareas administrativas derivadas de la prestación asistencial.',
        '• Apoyo al diagnóstico, redacción de informes y transcripción de notas clínicas mediante sistemas de inteligencia artificial externos (p. ej., OpenAI Ireland Ltd. – “ChatGPT/Whisper” – y ViaFirma en España), siempre bajo la supervisión de un profesional sanitario y con fines exclusivos de asistencia',
        '• Informarle de nuestros productos y servicios vía electrónica y postal.'
      ]],
      ['C. LEGITIMACIÓN:', [
        '• Ejecución de contrato de prestación de servicios entre el sanitario y el paciente.',
        '• Ejecución de un contrato con su mutua médica.',
        '• Tratamiento necesario para fines de diagnóstico y asistencia sanitaria realizado por profesional sujeto a secreto.',
        '• Ley reguladora de la autonomía del paciente y de derechos y obligaciones en materia de información y documentación clínica.',
        '• Consentimiento explícito del interesado para que sus datos clínicos anomizados puedan ser tratados por herramientas de IA y, en su caso, ser transferidos dentro del EEE (ver apartado E).',
        '• Interés legítimo en informar a nuestros pacientes de nuestros productos y servicios sanitarios.'
      ]],
      ['D. DESTINATARIOS:', [
        '• Compañías responsables de su cobertura médica para que ésta pueda conocer el acto prestado y hacer frente a su responsabilidad.',
        '• Centros o profesionales sanitarios responsables del paciente o necesarios para la prestación de los servicios solicitados.',
        '• Casos legalmente previstos.',
        '• Proveedores tecnológicos que prestan servicios de IA y alojamiento, actuando como encargados del tratamiento: OpenAI Ireland Ltd. (operador de ChatGPT/Whisper) y ViaFirma en España. Dichos proveedores han suscrito contrato de encargo con la clínica y aplican Cláusulas Contractuales Estándar y otras salvaguardas para garantizar un nivel de protección equivalente al europeo.'
      ]],
      ['E. CONSERVACIÓN DE LOS DATOS:', [
        '• Serán conservados durante la vigencia del acuerdo asistencial.',
        '• Se conservarán en todo caso según las exigencias de conservación de la documentación clínica de la Ley reguladora de la autonomía del paciente.',
        '• Datos comerciales: cuando el usuario solicite su baja.'
      ]],
      ['F. CONSENTIMIENTO EXPLÍCITO PARA EL USO DE IA Y TRANSFERENCIA INTERNACIONAL:', [
        'Marque lo que proceda:',
        '[   ] ACEPTO Autorizo expresamente que PARIS & BEA envíe mis datos de salud (anomizados) a OpenAI Ireland Ltd. y otros encargados equivalentes, con la única finalidad de apoyar el diagnóstico y/o documentar mi asistencia mediante herramientas de inteligencia artificial. Y entiendo que la decisión clínica final será siempre del profesional sanitario.',
        '[   ] NO ACEPTO No autorizo el uso de mis datos por sistemas de IA externos. Reconozco que la clínica podrá seguir prestándome asistencia, pero las funcionalidades de IA no se aplicarán a mi caso.'
      ]],
      ['G. DERECHOS:', [
        '• Tiene derecho a solicitar el acceso, rectificación, supresión, oposición, limitación y portabilidad de sus datos personales.',
        '• Puede solicitarlos dirigiéndose a los datos de contacto del responsable.',
        '• En caso de divergencias, puede presentar una reclamación ante la Autoridad de Protección de Datos (www.agpd.es).'
      ]]
    ];

    /* 7. maquetación ------------------------------------------------ */
    doc.moveDown(6);
    doc.fontSize(14).fillColor('#000').font('Raleway-Bold')
      .text('INFORMACIÓN SOBRE PROTECCIÓN DE DATOS DEL PACIENTE', { align: 'center' })
      .moveDown(1);

    doc.fontSize(11).fillColor('#000');
    secciones.forEach(([tit, parrs]) => {
      doc.font('Raleway-Bold').text(tit);
      doc.font('Raleway');
      parrs.forEach(p => doc.text(p));
      doc.moveDown(0.5);
    });

    doc.moveDown(0.5);
    doc.font('Raleway').text('[   ] NO DESEO RECIBIR INFORMACIONES COMERCIALES');
    doc.moveDown(1.2);

    // Datos firma manual
    doc.fontSize(11).font('Raleway-Bold')
      .text('NOMBRE Y APELLIDOS / DNI*:', { align: 'left' });
    doc.font('Raleway')
      .text(`${nombrePaciente} / ${dniPaciente}`, { align: 'left' });
    doc.moveDown(0.6);
    const yFirma = doc.y;
    doc.text(`Fecha: ${fechaMostrada}`, 50, yFirma, { continued: true });
    doc.text('   Firma: _____________________________', 250, yFirma);

    doc.moveDown(1);
    doc.fontSize(9).fillColor('#444')
      .text('Está prohibida la entrega de resultados médicos a personas distintas de los pacientes, salvo presentación del DNI del paciente y una autorización firmada.', { align: 'justify' })
      .moveDown(0.3)
      .text('*En caso de que el paciente sea menor de 16 años, se deberá incluir el nombre del menor y el nombre y firma de su representante legal (madre, padre o tutor).', { align: 'justify' });

    doc.moveDown(0.8);
    doc.fontSize(10).fillColor('#000')
      .text(`© ${hoy.getFullYear()} - Paris & Bea - ${mailCentro}`, { align: 'center' });

    doc.end();

    /* 8. finalizar y enviar a Viafirma ----------------------------- */
    stream.once('finish', async () => {
      try {
        const pdfURL = `https://parisandbea.es/documentos/consentimientos/${pdfFileName}`;

        let setCode = null;
        if (sendViafirma) {
          setCode = await enviarConsentimiento(pdfURL, { nombre: nombrePaciente, phone: paciente.telefono });

          // guarda estado en BD si hace falta
          if (id_paciente)
            await db.query(
              'UPDATE pacientes SET lopd_setcode=?, lopd_estado="pendiente" WHERE id_paciente=?',
              [setCode, id_paciente]
            );
        }

        await db.query(
          'UPDATE pacientes SET lopd_setcode=?, lopd_estado="pendiente" WHERE id_paciente=?',
          [setCode, id_paciente]
        );

        return res.json({
          message: 'Documento de consentimiento generado y enviado a firma',
          pdfURL,
          setCode
        });
      } catch (vfErr) {
        console.error('Error enviando a Viafirma:', vfErr);
        return res.status(500).json({ error: 'PDF creado, pero falló el envío a Viafirma' });
      }
    });

    stream.on('error', (err) => {
      console.error('Error al guardar el PDF:', err);
      return res.status(500).json({ error: 'Error al generar el PDF' });
    });

  } catch (error) {
    console.error('Error en generateConsentDocument:', error);
    return res.status(500).json({ error: error.toString() });
  }
};

/**
 * Genera el PDF de consentimiento para tratamiento de PUNCIÓN SECA
 */
exports.generateConsentimientoPuncionSeca = async (req, res) => {
  try {
    const { id_paciente, id_profesional, revocar } = req.body;

    if (!id_paciente) {
      return res.status(400).json({
        error: 'Falta el id_paciente para crear el consentimiento de punción seca.'
      });
    }

    // 1. Paciente
    const [pacienteRows] = await db.query('SELECT * FROM pacientes WHERE id_paciente = ?', [
      id_paciente
    ]);
    if (!pacienteRows.length) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const paciente = pacienteRows[0];

    // 2. Profesional
    let profesional = null;
    if (id_profesional) {
      const [profRows] = await db.query(
        'SELECT * FROM profesionales WHERE id_profesional = ?',
        [id_profesional]
      );
      if (profRows.length) {
        profesional = profRows[0];
      }
    }

    // 3. Home
    const [homeRows] = await db.query('SELECT * FROM home ORDER BY id_home DESC LIMIT 1');
    const home = homeRows[0] || {};

    // 4. Archivo
    const timestamp = Date.now();
    const fileName = `consentimiento_puncionseca_${id_paciente}_${timestamp}.pdf`;
    const consentFolder = path.join(__dirname, '..', 'documentos', 'consentimientos');
    if (!fs.existsSync(consentFolder)) {
      fs.mkdirSync(consentFolder, { recursive: true });
    }
    const filePath = path.join(consentFolder, fileName);

    // 5. PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // 6. Tipografías
    try {
      const ralewayPath = path.join(__dirname, '..', 'fonts', 'Raleway-Regular.ttf');
      const ralewayBoldPath = path.join(__dirname, '..', 'fonts', 'Raleway-Bold.ttf');
      if (fs.existsSync(ralewayPath)) {
        doc.registerFont('Raleway', ralewayPath);
      }
      if (fs.existsSync(ralewayBoldPath)) {
        doc.registerFont('Raleway-Bold', ralewayBoldPath);
      }
      doc.font('Raleway');
    } catch (err) {
      console.warn('No se pudo registrar la fuente Raleway. Se usará la fuente por defecto.', err);
    }

    // Función para centrar logo
    const logoCenter = () => {
      if (home.logo) {
        try {
          const fullLogoPath = path.join(__dirname, '..', home.logo);
          if (fs.existsSync(fullLogoPath)) {
            const logoImg = doc.openImage(fullLogoPath);
            const desiredWidth = 150;
            const aspectRatio = logoImg.height / logoImg.width;
            const desiredHeight = desiredWidth * aspectRatio;
            const centerX = (doc.page.width - desiredWidth) / 2;
            const currentY = doc.y;
            doc.image(logoImg, centerX, currentY, { width: desiredWidth });
            doc.y = currentY + desiredHeight + 20;
          }
        } catch (error) {
          console.warn('No se pudo cargar el logo:', error);
        }
      }
    };

    // Página 1
    logoCenter();

    doc
      .fontSize(13)
      .font('Raleway-Bold')
      .text('CONSENTIMIENTO INFORMADO\nPARA LA APLICACIÓN DE PUNCIÓN SECA', {
        align: 'center'
      })
      .moveDown(3);

    doc.fontSize(11).font('Raleway');

    doc.font('Raleway-Bold').text('PROCEDIMIENTO', { align: 'left' });
    doc.moveDown(0.5);
    doc.font('Raleway').text(
      'La punción seca es una técnica invasiva en el tratamiento de las alteraciones musculares, con el objetivo de disminuir o hacer desaparecer el dolor y restablecer la función. ' +
      'La aplicación de la técnica se realiza con agujas específicas de punción seca, similares a las agujas de acupuntura, sin infiltrar ningún tipo de sustancia en el organismo. ' +
      'En una misma sesión pueden ser necesarias varias punciones en diferentes localizaciones corporales.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    doc.font('Raleway-Bold').text('ALTERNATIVAS', { align: 'left' });
    doc.moveDown(0.5);
    doc.font('Raleway').text(
      'Si el paciente no puede o no quiere que se le aplique la punción seca, existen dentro de la fisioterapia manual otras técnicas no invasivas (masaje, estiramientos, movilizaciones...) que podrían ser utilizadas. ' +
      'Estas técnicas pueden alternarse con la punción seca.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    doc.font('Raleway-Bold').text('POSIBLES RIESGOS', { align: 'left' });
    doc.moveDown(0.5);
    doc.font('Raleway').text(
      'La aplicación de la técnica ha demostrado que el paciente puede experimentar dolor durante la punción, así como un ligero o moderado dolor después de la misma. ' +
      'Generalmente, este dolor no supera las 48 horas. A veces puede aparecer un pequeño sangrado sobre la zona, pudiendo ocasionar un hematoma.\n\n' +
      'Existe la posibilidad de sufrir mareos durante el tratamiento, sin suponer un riesgo grave para la salud. ' +
      'Son posibles otros efectos secundarios como dermatitis por contacto, hematomas o mioedemas, aunque estos son poco frecuentes.\n\n' +
      'Al tratar la musculatura costal existe el riesgo de provocar un neumotórax (entrada de aire en el espacio pleural), aunque este riesgo es mínimo. ' +
      'El riesgo de pinchar otras zonas sensibles (por ejemplo, el riñón en caso de tratamientos en la región lumbar) es también mínimo.\n\n' +
      'Al ser una técnica invasiva, puede existir riesgo de infección. ' +
      'Al tratar en zonas donde hay compromiso neural, la penetración de la aguja puede provocar una sensación eléctrica desagradable. ' +
      'Debe avisar al/la fisioterapeuta para que modifique la zona o la forma del abordaje y evitar así que el nervio se lesione.\n\n' +
      'Debe avisar en caso de: embarazo, alergia a metales, hipotiroidismo, neumotórax anterior, uso de anticoagulantes o antiagregantes, procesos neoplásicos, enfermedades infecciosas (VIH, hepatitis...), ' +
      'u otra patología que el terapeuta deba conocer.',
      { align: 'justify' }
    );

    doc.moveDown(5);
    doc.fontSize(10).fillColor('#000');
    doc.text('© 2025 - Paris & Bea - info@parisandbea.es - pág. 1', { align: 'center' });

    // Página 2
    doc.addPage();
    logoCenter();

    doc.moveDown(1);
    doc.fontSize(11);

    doc.font('Raleway-Bold').text('DECLARO', { align: 'left' });
    doc.moveDown(0.5);
    doc.font('Raleway').text(
      'Haber recibido información escrita mediante el presente consentimiento informado sobre el tratamiento, así como aclaraciones e información detallada verbal clara, concisa y sencilla sobre el procedimiento que se me va a realizar, y he leído el presente escrito. ' +
      'Declaro que todas mis dudas han sido aclaradas y que he comprendido toda la información que se me ha proporcionado. Por ello, libremente, doy mi consentimiento para que el/la fisioterapeuta especialista en punción seca me aplique esta técnica.\n\n' +
      'Soy informado/a de que, sin necesidad de dar ninguna explicación, puedo revocar el consentimiento que ahora presto. Pudiendo solicitar una copia del presente consentimiento informado.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    doc.font('Raleway-Bold').text('Centro de Fisioterapia:');
    doc
      .moveDown(0.3)
      .font('Raleway')
      .text(`Nombre del Centro: Paris & Bea`)
      .text(`Dirección: ${home.direccion_centro || '---'}`)
      .text(`Teléfono: ${home.telefono || '---'}`);
    doc.moveDown(1);

    doc.font('Raleway-Bold').text('Datos del Paciente:');
    doc
      .moveDown(0.3)
      .font('Raleway')
      .text(`Nombre y Apellidos: ${paciente.nombre} ${paciente.apellidos}`)
      .text(`Número de Documento de Identidad: ${paciente.dni || '---'}`)
      .text(`Dirección: ${paciente.direccion || '---'}`)
      .text(`Teléfono de Contacto: ${paciente.telefono || '---'}`);
    doc.moveDown(1);

    doc.font('Raleway-Bold').text('Datos del Fisioterapeuta:');
    doc
      .moveDown(0.3)
      .font('Raleway')
      .text(`Nombre y Apellidos: ${profesional ? profesional.nombre : '---'}`)
      .text(`DNI: ${profesional ? profesional.dni || '---' : '---'}`)
      .text(`Número de Colegiado/a: ${profesional ? profesional.num_colegiado || '---' : '---'}`);
    doc.moveDown(1);

    // Fecha/hora actuales
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const fechaHoraActual = `${day}/${month}/${year} ${hours}:${minutes}`;

    doc.font('Raleway-Bold').text('Fecha/Hora:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(`${fechaHoraActual}`);
    doc.moveDown(1);

    if (revocar) {
      doc
        .font('Raleway-Bold')
        .text('Revocación del Consentimiento:')
        .moveDown(0.3)
        .font('Raleway')
        .text(
          'Revoco mi consentimiento y NO deseo continuar con el tratamiento de punción seca.',
          { align: 'justify' }
        )
        .moveDown(1);
    }

    doc
      .moveDown(1)
      .fontSize(11)
      .font('Raleway')
      .text('Firma del Paciente:                                      ', { continued: true })
      .text('           Firma del Fisioterapeuta:', { align: 'right' })
      .moveDown(12);

    doc.fontSize(10).fillColor('#000');
    doc.text('© 2025 - Paris & Bea - info@parisandbea.es - pág. 2', { align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      const publicUrl = `https://parisandbea.es/documentos/consentimientos/${fileName}`;
      return res.status(201).json({
        message: 'Consentimiento de punción seca creado correctamente',
        pdfFile: fileName,
        pdfUrl: publicUrl
      });
    });

    writeStream.on('error', (err) => {
      console.error('Error al guardar el PDF:', err);
      return res.status(500).json({ error: 'Error al guardar el PDF' });
    });
  } catch (error) {
    console.error('Error al generar consentimiento de punción seca:', error);
    return res.status(500).json({ error: 'Error interno al generar consentimiento de punción seca' });
  }
};

/**
 * Genera el PDF de consentimiento para tratamiento de SUELO PÉLVICO
 */
exports.generateConsentimientoSueloPelvico = async (req, res) => {
  try {
    const { id_paciente, id_profesional, nombreArchivo, representanteLegal } = req.body;

    if (!id_paciente) {
      return res.status(400).json({
        error: 'Falta el id_paciente para crear el consentimiento de suelo pélvico.'
      });
    }

    // 1. Paciente
    const [pacienteRows] = await db.query('SELECT * FROM pacientes WHERE id_paciente = ?', [
      id_paciente
    ]);
    if (!pacienteRows.length) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const paciente = pacienteRows[0];

    // 2. Profesional
    let profesional = null;
    if (id_profesional) {
      const [profRows] = await db.query(
        'SELECT * FROM profesionales WHERE id_profesional = ?',
        [id_profesional]
      );
      if (profRows.length) {
        profesional = profRows[0];
      }
    }

    // 3. Home
    const [homeRows] = await db.query('SELECT * FROM home ORDER BY id_home DESC LIMIT 1');
    const home = homeRows[0] || {};

    // 4. Archivo
    const timestamp = Date.now();
    const fileName = nombreArchivo || `consentimiento_suelopelvico_${id_paciente}_${timestamp}.pdf`;
    const consentFolder = path.join(__dirname, '..', 'documentos', 'consentimientos');
    if (!fs.existsSync(consentFolder)) {
      fs.mkdirSync(consentFolder, { recursive: true });
    }
    const filePath = path.join(consentFolder, fileName);

    // 5. PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // 6. Tipografías
    try {
      const ralewayPath = path.join(__dirname, '..', 'fonts', 'Raleway-Regular.ttf');
      const ralewayBoldPath = path.join(__dirname, '..', 'fonts', 'Raleway-Bold.ttf');
      if (fs.existsSync(ralewayPath)) {
        doc.registerFont('Raleway', ralewayPath);
      }
      if (fs.existsSync(ralewayBoldPath)) {
        doc.registerFont('Raleway-Bold', ralewayBoldPath);
      }
      doc.font('Raleway');
    } catch (err) {
      console.warn('No se pudo registrar la fuente Raleway. Se usará la fuente por defecto.', err);
    }

    // Función para centrar logo
    const logoCenter = () => {
      if (home.logo) {
        try {
          const fullLogoPath = path.join(__dirname, '..', home.logo);
          if (fs.existsSync(fullLogoPath)) {
            const logoImg = doc.openImage(fullLogoPath);
            const desiredWidth = 150;
            const aspectRatio = logoImg.height / logoImg.width;
            const desiredHeight = desiredWidth * aspectRatio;
            const centerX = (doc.page.width - desiredWidth) / 2;
            const currentY = doc.y;
            doc.image(logoImg, centerX, currentY, { width: desiredWidth });
            doc.y = currentY + desiredHeight + 20;
          }
        } catch (error) {
          console.warn('No se pudo cargar el logo:', error);
        }
      }
    };

    // Fecha/hora
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const fechaHora = `${dia}-${mes}-${anio} ${horas}:${minutos}`;

    // PÁGINA 1
    logoCenter();
    doc
      .fontSize(14)
      .font('Raleway-Bold')
      .text('CONSENTIMIENTO INFORMADO FISIOTERAPIA PERINEAL', { align: 'center' })
      .moveDown(2);

    // Datos PACIENTE + fecha
    doc.fontSize(11).font('Raleway-Bold');
    doc.text('PACIENTE', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway');
    doc.text(`Nombre: ${paciente.nombre || ''}`);
    doc.text(`Apellidos: ${paciente.apellidos || ''}`);
    doc.text(`DNI: ${paciente.dni || ''}`);
    doc.moveDown(0.3);
    doc.text(`Fecha: ${fechaHora}`, { align: 'left' });
    doc.moveDown(5);

    // Texto INFORMACION
    doc.font('Raleway-Bold').text('INFORMACION', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'La Fisioterapia Perineal es una disciplina terapéutica que permite evaluar y tratar disfunciones del suelo pélvico (incontinencia urinaria y / o anal, dolor perineal, prolapsos, etc.) y otros de la esfera sexual (dispareunias, vaginismo, etc.) y que especialmente acompañan a la mujer en el post parto, la menopausia y el hombre después de la cirugía de próstata.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Texto EL TRATAMIENTO
    doc.font('Raleway-Bold').text('EL TRATAMIENTO', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'Al igual que otras especialidades en fisioterapia, la fisioterapia perineal se utiliza como tratamiento la electroterapia, biofeedback, técnicas manuales, masaje perineal, cinesiterapia y técnicas comportamentales. Muchos de estos procedimientos son intracavitarios, es decir intravaginales y / o ano / rectales. Deberá ser realizado por fisioterapeutas especializados y con garantías máxima de higiene, siendo los electrodos intracavitarios de uso individual. El tratamiento no garantiza la curación del paciente.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Texto RIESGOS
    doc.font('Raleway-Bold').text('RIESGOS', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'La mayoría de las técnicas empleadas en fisioterapia perineal no presentan efectos adversos. La electroterapia / Electroestimulación puede provocar una sensación de cosquilleo u hormigueo que normalmente es bien tolerado por los pacientes. Ocasionalmente puede producir molestia o dolor por fenómenos de hipersensibilidad o mal contacto del electrodo.',
      { align: 'justify' }
    );
    doc.moveDown(5);

    doc.moveDown(6);
    doc.fontSize(10).fillColor('#000');
    doc.text('© 2025 - Paris & Bea - info@parisandbea.es - pág. 1', { align: 'center' });

    // PÁGINA 2
    doc.addPage();
    logoCenter();

    // Texto EL/LA PACIENTE
    doc.fontSize(11).font('Raleway-Bold').text('EL / LA PACIENTE', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'Debe advertirse al fisioterapeuta si tiene implantado un marcapasos, sospechas de infección actual o de embarazo, hipertensión arterial o cualquier otro proceso que pueda contraindicar el tratamiento. Demandará de forma verbal toda la información que necesite para entender correctamente su proceso terapéutico. Podrá retirar su consentimiento en cualquier momento del tratamiento.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Texto EL / LA PACIENTE / DECLARO
    doc.font('Raleway-Bold').text('EL / LA PACIENTE / DECLARO:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'Que he recibido y comprendido la información verbal sobre el tratamiento, y pudiendo realizar todas las preguntas he considerado oportunas.\nQue en cualquier momento puedo revocar mi consentimiento.\nEn consecuencia:\nDOY MI CONSENTIMIENTO PARA REALIZAR EL TRATAMIENTO DE FISIOTERAPIA PERINEAL.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Texto EL/LA FISIOTERAPEUTA / DECLARO
    doc.font('Raleway-Bold').text('EL / LA FISIOTERAPEUTA / DECLARO:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(
      'Que he facilitado la información adecuada al paciente y he dado respuesta a las dudas planteadas.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Datos Centro
    doc.font('Raleway-Bold').text('Centro de Fisioterapia:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(`Nombre del Centro: Paris & Bea`);
    doc.text(`Dirección: ${home.direccion_centro || '---'}`);
    doc.text(`Teléfono: ${home.telefono || '---'}`);
    doc.moveDown(1);

    // Datos Paciente
    doc.font('Raleway-Bold').text('Datos del Paciente:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(`Nombre y Apellidos: ${paciente.nombre} ${paciente.apellidos}`);
    doc.text(`Número de Documento de Identidad: ${paciente.dni || '---'}`);
    doc.text(`Dirección: ${paciente.direccion || '---'}`);
    doc.text(`Teléfono de Contacto: ${paciente.telefono || '---'}`);
    doc.moveDown(1);

    // Datos Fisio
    doc.font('Raleway-Bold').text('Datos del Fisioterapeuta:', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Raleway').text(`Nombre y Apellidos: ${profesional ? profesional.nombre : '---'}`);
    doc.text(`DNI: ${profesional ? profesional.dni || '---' : '---'}`);
    doc.text(`Número de Colegiado/a: ${profesional ? profesional.num_colegiado || '---' : '---'}`);
    doc.moveDown(1);

    doc.moveDown(0.5);
    doc.text('Firma del Paciente:                                                      ', { continued: true })
      .text('Firma del Fisioterapeuta:', { align: 'right' });
    doc.moveDown(2);

    // REPRESENTANTE LEGAL (opcional)
    if (representanteLegal && representanteLegal.nombre) {
      doc
        .font('Raleway-Bold')
        .text('REPRESENTANTE LEGAL: (en caso de incapacidad del paciente)', { align: 'left' })
        .moveDown(0.3)
        .font('Raleway')
        .text(`NOMBRE: ${representanteLegal.nombre}`)
        .text(`DNI: ${representanteLegal.dni || ''}`)
        .text(`PARENTESCO: ${representanteLegal.parentesco || ''}`)
        .moveDown(2);

      doc.text('Firma del Paciente:                                                      ', { continued: true })
        .text('Firma del Fisioterapeuta:', { align: 'right' });
      doc.moveDown(2);
    }

    doc.moveDown(5);
    doc.fontSize(10).fillColor('#000');
    doc.text('© 2025 - Paris & Bea - info@parisandbea.es - pág. 2', { align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      const publicUrl = `https://parisandbea.es/documentos/consentimientos/${fileName}`;
      return res.status(201).json({
        message: 'Consentimiento de suelo pélvico creado correctamente',
        pdfFile: fileName,
        pdfUrl: publicUrl
      });
    });

    writeStream.on('error', (err) => {
      console.error('Error al guardar el PDF:', err);
      return res.status(500).json({ error: 'Error al guardar el PDF' });
    });
  } catch (error) {
    console.error('Error al generar consentimiento suelo pélvico:', error);
    return res.status(500).json({ error: 'Error interno al generar consentimiento de suelo pélvico' });
  }
};