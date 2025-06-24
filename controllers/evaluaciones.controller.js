const pool = require('../database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const FISIO_TPL = require('../utils/fisioOstioTemplates');

/* ───────── helpers generales ───────── */
const MESES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni', 'Juli', 'August',
    'September', 'Oktober', 'November', 'Dezember'],
  fr: ['janvier', 'f\u00e9vrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'ao\u00fbt',
    'septembre', 'octobre', 'novembre', 'd\u00e9cembre']
};

const hoyYHora = (lang = 'es') => {
  const now = new Date();
  const meses = MESES[lang] || MESES.es;
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = meses[now.getMonth()];
  const yyyy = now.getFullYear();
  let hoy;
  switch (lang) {
    case 'en':
      hoy = `${dd} ${mm} ${yyyy}`;
      break;
    case 'de':
      hoy = `${dd}. ${mm} ${yyyy}`;
      break;
    case 'fr':
      hoy = `${dd} ${mm} ${yyyy}`;
      break;
    default:
      hoy = `${dd} de ${mm} de ${yyyy}`;
  }
  const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { hoy, hora };
};

const normaliza = txt => (txt || '').trim();

const HEADINGS = {
  es: {
    centro: '· CENTRO DE OSTEOPATÍA INTEGRAL Y FISIOTERAPIA:',
    profesional: '· PROFESIONAL:',
    otrosProfesionales: '· OTROS PROFESIONALES DEL CENTRO:',
    paciente: '· IDENTIFICACIÓN DEL PACIENTE:',
    naturaleza: '· NATURALEZA, OBJETIVO Y PLAN DE TRATAMIENTO',
    dataProtection: '· PROTECCIÓN DE DATOS',
    patientRights: '· DERECHOS DEL PACIENTE',
    declaration: '· DECLARACIÓN DEL PACIENTE',
    tecar1: 'TECAR. 1 - PROCEDIMIENTO',
    tecar2: 'TECAR. 2 - CONSECUENCIAS SEGURAS',
    tecar3: 'TECAR. 3 - DESCRIPCIÓN DE LAS CONTRAINDICACIONES',
    tecar4: 'TECAR. 4 - EFECTOS SECUNDARIOS',
    cryo1: 'CRYO. 1 - PROCEDIMIENTO',
    cryo2: 'CRYO. 2 - DESCRIPCIÓN DE LAS CONTRAINDICACIONES',
    cryo3: 'CRYO. 3 - EFECTOS SECUNDARIOS'
  },
  en: {
    centro: '· INTEGRAL OSTEOPATHY & PHYSIOTHERAPY CENTRE:',
    profesional: '· PRACTITIONER:',
    otrosProfesionales: '· OTHER CENTRE PRACTITIONERS:',
    paciente: '· PATIENT IDENTIFICATION:',
    naturaleza: '· NATURE, PURPOSE AND TREATMENT PLAN',
    dataProtection: '· DATA PROTECTION',
    patientRights: '· PATIENT RIGHTS',
    declaration: '· PATIENT DECLARATION',
    tecar1: 'TECAR. 1 - PROCEDURE',
    tecar2: 'TECAR. 2 - EXPECTED CONSEQUENCES',
    tecar3: 'TECAR. 3 - CONTRAINDICATIONS',
    tecar4: 'TECAR. 4 - SIDE EFFECTS',
    cryo1: 'CRYO. 1 - PROCEDURE',
    cryo2: 'CRYO. 2 - CONTRAINDICATIONS',
    cryo3: 'CRYO. 3 - SIDE EFFECTS'
  },
  de: {
    centro: '· ZENTRUM FÜR OSTEOPATHIE UND PHYSIOTHERAPIE:',
    profesional: '· BEHANDLER:',
    otrosProfesionales: '· WEITERE MITARBEITER DES ZENTRUMS:',
    paciente: '· PATIENTENIDENTIFIKATION:',
    naturaleza: '· ART, ZIEL UND BEHANDLUNGSPLAN',
    dataProtection: '· DATENSCHUTZ',
    patientRights: '· RECHTE DES PATIENTEN',
    declaration: '· ERKLÄRUNG DES PATIENTEN',
    tecar1: 'TECAR. 1 - VERFAHREN',
    tecar2: 'TECAR. 2 - SICHERE FOLGEN',
    tecar3: 'TECAR. 3 - KONTRAINDIKATIONEN',
    tecar4: 'TECAR. 4 - NEBENWIRKUNGEN',
    cryo1: 'CRYO. 1 - VERFAHREN',
    cryo2: 'CRYO. 2 - KONTRAINDIKATIONEN',
    cryo3: 'CRYO. 3 - NEBENWIRKUNGEN'
  },
  fr: {
    centro: '· CENTRE D\u2019OST\u00c9OPATHIE ET DE PHYSIOTH\u00c9RAPIE :',
    profesional: '· PROFESSIONNEL :',
    otrosProfesionales: '· AUTRES PROFESSIONNELS DU CENTRE :',
    paciente: '· IDENTIFICATION DU PATIENT :',
    naturaleza: '· NATURE, OBJECTIF ET PLAN DE TRAITEMENT',
    dataProtection: '· PROTECTION DES DONN\u00c9ES',
    patientRights: '· DROITS DU PATIENT',
    declaration: '· D\u00c9CLARATION DU PATIENT',
    tecar1: 'TECAR. 1 - PROC\u00c9DURE',
    tecar2: 'TECAR. 2 - CONS\u00c9QUENCES ATTENDUES',
    tecar3: 'TECAR. 3 - CONTRE-INDICATIONS',
    tecar4: 'TECAR. 4 - EFFETS SECONDAIRES',
    cryo1: 'CRYO. 1 - PROC\u00c9DURE',
    cryo2: 'CRYO. 2 - CONTRE-INDICATIONS',
    cryo3: 'CRYO. 3 - EFFETS SECONDAIRES'
  }
};

const INTRO = {
  es: 'Con el fin de que disponga de la información necesaria y otorgue su consentimiento de forma libre y voluntaria antes de iniciar cualquier intervención, se le facilita el presente documento. Lea detenidamente cada apartado y pregunte cualquier duda.',
  en: 'To ensure you have all the necessary information and give your consent freely and voluntarily before starting any procedure, we provide this document. Please read each section carefully and ask any questions.',
  de: 'Damit Sie über alle notwendigen Informationen verfügen und Ihre Einwilligung frei und freiwillig vor Beginn jeder Maßnahme erteilen können, stellen wir Ihnen dieses Dokument zur Verfügung. Lesen Sie jeden Abschnitt sorgfältig durch und stellen Sie eventuelle Fragen.',
  fr: 'Afin que vous disposiez des informations nécessaires et donniez votre consentement libre et volontaire avant de commencer toute intervention, nous vous remettons le présent document. Lisez chaque section attentivement et posez toutes vos questions.'
};

const LABELS = {
  es: {
    place: (d, h) => `En Ibiza, ${d}   Hora: ${h}`,
    firmaPaciente: 'Firma del/la Paciente: ________________________________',
    firmaProfesional: 'Firma del/la Profesional: _____________________________',
    repText: (n, d, c) => `Yo, ${n}, con DNI/NIE/Pasaporte ${d}, actuando como representante legal del paciente, en calidad de ${c}, manifiesto que he recibido la información anterior y considero beneficiosa la realización del tratamiento descrito. Por ello, otorgo mi consentimiento en su nombre.`,
    repFirma: 'Firma del/de la Representante: ________________________'
  },
  en: {
    place: (d, h) => `In Ibiza, ${d}   Time: ${h}`,
    firmaPaciente: 'Patient signature: ________________________________',
    firmaProfesional: 'Practitioner signature: _____________________________',
    repText: (n, d, c) => `I, ${n}, with ID/Passport ${d}, acting as the patient's legal representative in the capacity of ${c}, confirm that I have received the above information and consider the described treatment beneficial. Therefore, I give my consent on their behalf.`,
    repFirma: 'Representative signature: ________________________'
  },
  de: {
    place: (d, h) => `In Ibiza, ${d}   Uhrzeit: ${h}`,
    firmaPaciente: 'Unterschrift des/der Patienten/in: ________________________________',
    firmaProfesional: 'Unterschrift des/der Therapeuten/in: _____________________________',
    repText: (n, d, c) => `Ich, ${n}, mit Ausweis/Pas ${d}, handelnd als gesetzlicher Vertreter des Patienten in meiner Eigenschaft als ${c}, bestätige, dass ich die obigen Informationen erhalten habe und die Durchführung der beschriebenen Behandlung für vorteilhaft halte. Daher erteile ich in seinem/ihrem Namen meine Einwilligung.`,
    repFirma: 'Unterschrift des/der Vertreters/in: ________________________'
  },
  fr: {
    place: (d, h) => `À Ibiza, le ${d}   Heure: ${h}`,
    firmaPaciente: 'Signature du/de la patient(e) : ________________________________',
    firmaProfesional: 'Signature du/de la professionnel(le) : _____________________________',
    repText: (n, d, c) => `Je, ${n}, titulaire de la pièce d’identité/passeport ${d}, agissant en tant que représentant légal du patient en qualité de ${c}, déclare avoir reçu les informations ci-dessus et considérer bénéfique la réalisation du traitement décrit. Par conséquent, je donne mon consentement en son nom.`,
    repFirma: 'Signature du/de la représentant(e) : ________________________'
  }
};

const winbackFromTpl = (tpl, addTitulo, addListaSafe, lang) => {
  const h = HEADINGS[lang] || HEADINGS.es;
  addTitulo(h.tecar1); addListaSafe(tpl.tecar1);
  addTitulo(h.tecar2); addListaSafe(tpl.tecar2);
  addTitulo(h.tecar3); addListaSafe(tpl.tecar3);
  addTitulo(h.tecar4); addListaSafe(tpl.tecar4);
  addTitulo(h.cryo1); addListaSafe(tpl.cryo1);
  addTitulo(h.cryo2); addListaSafe(tpl.cryo2);
  addTitulo(h.cryo3); addListaSafe(tpl.cryo3);
};

/* ───────────── función principal ───────────── */
exports.createConsentimientoFusionado = async (req, res) => {
  try {
    const {
      id_paciente,
      id_profesional,
      nombre_representante,
      dni_representante,
      calidad_representante
    } = req.body;

    if (!id_paciente || !id_profesional) {
      return res.status(400).json({ error: 'Faltan id_paciente y/o id_profesional' });
    }

    /* alias para los datos del representante */
    const repNombre = nombre_representante || req.body.nombre_representado || '________________';
    const repDni = dni_representante || req.body.dni_representado || '________';
    const repCalidad = calidad_representante || req.body.rol_representante || '________';

    /* ───── datos de BD ───── */
    const [[pac]] = await pool.query('SELECT * FROM pacientes WHERE id_paciente = ?', [id_paciente]);
    if (!pac) return res.status(404).json({ error: 'Paciente no encontrado' });

    const [[profInit]] = await pool.query('SELECT * FROM profesionales WHERE id_profesional = ?', [id_profesional]);
    if (!profInit) return res.status(404).json({ error: 'Profesional no encontrado' });

    const [otros] = await pool.query(
      'SELECT * FROM profesionales WHERE id_profesional <> ? ORDER BY nombre', [id_profesional]);

    const [[home]] = await pool.query('SELECT * FROM home LIMIT 1');

    /* ───── preparar PDF ───── */
    const ts = Date.now();
    const fileName = `consent_${id_paciente}_${ts}.pdf`;
    const dirOut = path.join(__dirname, '..', 'documentos', 'consentimientos');
    if (!fs.existsSync(dirOut)) fs.mkdirSync(dirOut, { recursive: true });
    const filePath = path.join(dirOut, fileName);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    /* fuentes */
    const font = (alias, rel) => {
      const fp = path.join(__dirname, '..', rel);
      if (fs.existsSync(fp)) doc.registerFont(alias, fp);
    };
    font('Raleway', 'fonts/Raleway-Regular.ttf');
    font('Raleway-Bold', 'fonts/Raleway-Bold.ttf');
    doc.font('Raleway');

    /* ───────── parche negrita automática de “sanitaria / no sanitaria / no sanitarios” ───────── */
    {
      const REGEX = /(no sanitaria|no sanitarios|sanitaria)/gi;
      const originalText = doc.text.bind(doc);

      doc.text = function (texto, ...rest) {
        if (typeof texto !== 'string' || !REGEX.test(texto)) {
          // Sin coincidencias ⇒ comportamiento original
          return originalText(texto, ...rest);
        }

        // Asegurarse de reiniciar lastIndex del RegExp global
        REGEX.lastIndex = 0;

        // Descomponer argumentos (text, [x], [y], [options])
        let x, y, options = {};
        if (rest.length === 1 && typeof rest[0] !== 'number') {
          options = rest[0] || {};
        } else if (rest.length === 2 && typeof rest[0] === 'number') {
          x = rest[0]; options = rest[1] || {};
        } else if (rest.length >= 3) {
          x = rest[0]; y = rest[1]; options = rest[2] || {};
        }

        // Partir la cadena en fragmentos
        const segmentos = [];
        let last = 0;
        for (const m of texto.matchAll(REGEX)) {
          if (m.index > last) segmentos.push({ txt: texto.slice(last, m.index), bold: false });
          segmentos.push({ txt: m[0], bold: true });
          last = m.index + m[0].length;
        }
        if (last < texto.length) segmentos.push({ txt: texto.slice(last), bold: false });

        const total = segmentos.length;
        segmentos.forEach((seg, idx) => {
          const opts = { ...options, continued: idx !== total - 1 || options.continued };
          if (idx !== 0 && opts.align) delete opts.align;           // alineación sólo en el primer trozo
          if (seg.bold) this.font('Raleway-Bold'); else this.font('Raleway');

          if (idx === 0) {
            // primer fragmento ⇒ mantener firma completa
            if (x !== undefined && y !== undefined) {
              originalText(seg.txt, x, y, opts);
            } else if (x !== undefined) {
              originalText(seg.txt, x, opts);
            } else {
              originalText(seg.txt, opts);
            }
          } else {
            // resto ⇒ basta con texto + opciones
            originalText(seg.txt, opts);
          }
        });

        return this;
      };
    }
    /* ───── fin parche ───── */

    const lang = (req.body.idioma || req.body.lang || req.body.language || 'es').toLowerCase();
    const tpl = FISIO_TPL[lang] || FISIO_TPL.es;
    const textos = HEADINGS[lang] || HEADINGS.es;
    const labels = LABELS[lang] || LABELS.es;
    const { hoy, hora } = hoyYHora(lang);

    /* ─────────── maquetación básica ─────────── */

    const logoCenter = () => {
      if (!home?.logo) return;
      try {
        const imgPath = path.join(__dirname, '..', home.logo);
        if (!fs.existsSync(imgPath)) return;
        const img = doc.openImage(imgPath);
        const W = 120;
        const H = W * (img.height / img.width);
        const X = (doc.page.width - W) / 2;
        const Y = doc.y;
        doc.image(img, X, Y, { width: W });
        doc.y = Y + H + 20;
      } catch {/* sin imagen */ }
    };

    /* garantiza que quede “minHeight” libre; si no, crea página nueva */
    const ensureSpace = (minHeight = 20) => {
      const bottomY = doc.page.height - doc.page.margins.bottom;
      if (doc.y + minHeight > bottomY) doc.addPage();
    };

    /* títulos en negrita */
    const addTitulo = t => {
      ensureSpace(25);
      doc.font('Raleway-Bold').fontSize(11).text(t).moveDown(0.5);
    };

    /* listas sin desbordes y siempre en regular */
    const addListaSafe = arr => {
      doc.font('Raleway').fontSize(11);
      arr.forEach((item, idx) => {
        const h = doc.heightOfString(item, {
          width: doc.page.width - doc.x - doc.page.margins.right
        });
        ensureSpace(h + 12);
        doc.list([item], { bulletRadius: 0, textIndent: 0, bulletIndent: 0 });
        if (idx !== arr.length - 1) doc.moveDown(0.1);
      });
      ensureSpace(15);
      doc.moveDown(0.5);
    };

    /* ───── PÁGINA 1 ───── */
    logoCenter();

    doc.font('Raleway-Bold').fontSize(13)
      .text(tpl.header, { align: 'center', lineGap: 2 })
      .moveDown();

    doc.font('Raleway').fontSize(11)
      .text(INTRO[lang], { align: 'justify' })
      .moveDown();

    /* CENTRO */
    addTitulo(textos.centro);
    addListaSafe([
      'Centro: Paris & Bea',
      `Dirección: ${normaliza(home?.direccion_centro)}`,
      `Teléfono: ${normaliza(home?.telefono)}`,
      `Mail: ${normaliza(home?.mail)}`,
      `CIF: ${normaliza(home?.cif)}`
    ]);

    /* PROFESIONAL INICIAL */
    addTitulo(textos.profesional);
    const compInit = [
      `Nombre: ${profInit.nombre}`,
      profInit.dni && `DNI/NIE: ${profInit.dni}`,
      profInit.num_colegiado && `Nº colegiado/a: ${profInit.num_colegiado}`,
      profInit.especialidad && `Especialidad: ${profInit.especialidad}`,
      profInit.notas?.trim() && `Formación complementaria: ${profInit.notas.trim()}`
    ].filter(Boolean);
    addListaSafe(compInit);

    /* OTROS PROFESIONALES */
    if (otros.length) {
      addTitulo(textos.otrosProfesionales);
      otros.forEach(p => {
        const comp = [
          `Nombre: ${p.nombre}`,
          p.dni && `DNI/NIE: ${p.dni}`,
          p.num_colegiado && `Nº colegiado/a: ${p.num_colegiado}`,
          p.especialidad && `Especialidad: ${p.especialidad}`,
          p.notas?.trim() && `Formación complementaria: ${p.notas.trim()}`
        ].filter(Boolean);
        addListaSafe(comp);
      });
    }

    /* PACIENTE */
    addTitulo(textos.paciente);
    addListaSafe([
      `Nombre y apellidos: ${pac.nombre} ${pac.apellidos}`,
      `DNI/NIE/Pasaporte: ${pac.dni || '—'}`,
      `Dirección: ${pac.direccion || '—'}`,
      `Teléfono de contacto: ${pac.telefono || '—'}`
    ]);

    /* BLOQUE variable */
    const esFisio = /fisio/i.test(profInit.especialidad || '');
    const esOsteo = /osteo/i.test(profInit.especialidad || '');

    const INDENT_WINBACK = 20;   // ≃ 7 mm de sangría

    /* helper para imprimir WINBACK con sangría persistente */
    const imprimirWinbackIndentado = () => {
      const savedX = doc.x;
      const shiftIndent = () => { doc.x = doc.page.margins.left + INDENT_WINBACK; };

      shiftIndent();
      doc.on('pageAdded', shiftIndent);

      winbackFromTpl(tpl.winback, addTitulo, addListaSafe, lang);

      doc.removeListener('pageAdded', shiftIndent);
      doc.x = savedX;
    };

    const bloqueFisio = () => {
      addTitulo(textos.naturaleza);
      doc.font('Raleway').text(tpl.physio.intro, { align: 'justify' }).moveDown(0.5);

      addListaSafe(tpl.physio.techniques);

      /* WINBACK indentado */
      imprimirWinbackIndentado();
      doc.font('Raleway').text(tpl.physio.objective, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.physio.benefits, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.physio.sideEffects, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.physio.alternatives, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.physio.osteoContinuationIntro, { align: 'justify' }).moveDown(0.5);
      addListaSafe(tpl.physio.osteoAspects);
    };

    const bloqueOsteo = () => {
      addTitulo(textos.naturaleza);
      doc.font('Raleway').text(tpl.osteo.intro, { align: 'justify' }).moveDown(0.5);

      addListaSafe(tpl.osteo.osteoAspects);

      doc.font('Raleway').text(tpl.osteo.afterOsteoIntro, { align: 'justify' }).moveDown();

      doc.font('Raleway').text(tpl.osteo.physioContinuationIntro, { align: 'justify' }).moveDown(0.5);

      doc.font('Raleway').text(tpl.osteo.physioTechniquesIntro, { align: 'justify' }).moveDown(0.5);
      addListaSafe(tpl.osteo.techniques);

      /* WINBACK indentado */
      imprimirWinbackIndentado();

      doc.font('Raleway').text(tpl.osteo.objective, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.osteo.benefits, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.osteo.sideEffects, { align: 'justify' }).moveDown();
      doc.font('Raleway').text(tpl.osteo.alternatives, { align: 'justify' }).moveDown();
    };

    /* decide qué bloque imprimir */
    if (esFisio) bloqueFisio();
    else if (esOsteo) bloqueOsteo();
    else addTitulo('⚠ No se ha podido determinar la especialidad del profesional inicial.');

    /* BLOQUES FINALES COMUNES */
    addTitulo(textos.dataProtection);
    doc.font('Raleway').text(tpl.common.dataProtection, { align: 'justify' }).moveDown();

    addTitulo(textos.patientRights);
    doc.font('Raleway').text(tpl.common.patientRights, { align: 'justify' }).moveDown();

    addTitulo(textos.declaration);
    doc.font('Raleway').text(tpl.common.declaration, { align: 'justify' }).moveDown();

    doc.text(labels.place(hoy, hora)).moveDown(5);
    doc.text(labels.firmaPaciente).moveDown(4);
    doc.text(labels.firmaProfesional).moveDown(1);

    /* PÁGINA REPRESENTANTE (opcional) */
    if (nombre_representante || dni_representante || calidad_representante) {
      doc.addPage();
      logoCenter();

      doc.font('Raleway').text(labels.repText(repNombre, repDni, repCalidad), { align: 'justify' }).moveDown(2);

      doc.text(labels.place(hoy, hora)).moveDown(5);
      doc.text(labels.repFirma);
    }

    /* FIN */
    doc.end();

    stream.on('finish', () => res.status(201).json({
      message: 'Consentimiento generado correctamente',
      pdfFile: fileName,
      pdfUrl: `https://parisandbea.es/documentos/consentimientos/${fileName}`
    }));
    stream.on('error', err => res.status(500).json({ error: 'Error al guardar PDF', details: err.message }));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al crear consentimiento' });
  }
};

/* --------------------------------------------------
   EVALUACIONES
   -------------------------------------------------- */
/**
 * Obtener todas las evaluaciones de la base de datos
 */
exports.getAllEvaluaciones = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluaciones');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener evaluaciones:', error);
    res.status(500).json({ error: 'Error al obtener evaluaciones' });
  }
};

/**
 * Obtener una evaluación por su id_evaluacion
 */
exports.getEvaluacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM evaluaciones WHERE id_evaluacion = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener evaluación por ID:', error);
    res.status(500).json({ error: 'Error al obtener evaluación' });
  }
};

/**
 * Obtener todas las evaluaciones de un paciente concreto
 */
exports.getEvaluacionesByPatient = async (req, res) => {
  try {
    const { id_paciente } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM evaluaciones WHERE id_paciente = ? ORDER BY fecha_evaluacion DESC',
      [id_paciente]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener evaluaciones del paciente:', error);
    res.status(500).json({ error: 'Error al obtener evaluaciones del paciente' });
  }
};

/**
 * Crear una nueva evaluación
 */
exports.createEvaluacion = async (req, res) => {
  try {
    const {
      id_paciente,
      id_profesional,
      fecha_evaluacion,
      dolor_localizacion,
      dolor_intensidad,
      dolor_tipo,
      dolor_irradia,
      dolor_descripcion,
      inspeccion_visual,
      palpacion,
      movilidad_articular,
      pruebas_funcionales,
      valoracion_neurologica,
      valoracion_postural,
      evaluacion_funcional,
      diagnostico,
      objetivos_terapeuticos
    } = req.body;

    // Validar campos mínimos obligatorios
    if (!id_paciente || !fecha_evaluacion) {
      return res
        .status(400)
        .json({ error: 'Faltan datos obligatorios (id_paciente, fecha_evaluacion)' });
    }

    const query = `
      INSERT INTO evaluaciones (
        id_paciente, id_profesional, fecha_evaluacion,
        dolor_localizacion, dolor_intensidad, dolor_tipo,
        dolor_irradia, dolor_descripcion, inspeccion_visual,
        palpacion, movilidad_articular, pruebas_funcionales,
        valoracion_neurologica, valoracion_postural, evaluacion_funcional,
        diagnostico, objetivos_terapeuticos
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id_paciente,
      id_profesional || null,
      fecha_evaluacion,
      dolor_localizacion || null,
      dolor_intensidad || null,
      dolor_tipo || null,
      dolor_irradia === true || dolor_irradia === 'true' ? 1 : 0,
      dolor_descripcion || null,
      inspeccion_visual || null,
      palpacion || null,
      movilidad_articular || null,
      pruebas_funcionales || null,
      valoracion_neurologica || null,
      valoracion_postural || null,
      evaluacion_funcional || null,
      diagnostico || null,
      objetivos_terapeuticos || null
    ];

    const [result] = await pool.query(query, params);
    res.status(201).json({
      message: 'Evaluación creada correctamente',
      id_evaluacion: result.insertId
    });
  } catch (error) {
    console.error('Error al crear evaluación:', error);
    res.status(500).json({ error: 'Error al crear evaluación' });
  }
};

/**
 * Actualizar una evaluación existente (merge con los datos actuales)
 */
exports.updateEvaluacion = async (req, res) => {
  try {
    const { id } = req.params;
    const [currentDataArr] = await pool.query('SELECT * FROM evaluaciones WHERE id_evaluacion = ?', [
      id
    ]);
    if (!currentDataArr.length) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    const currentData = currentDataArr[0];

    const {
      id_paciente,
      id_profesional,
      fecha_evaluacion,
      dolor_localizacion,
      dolor_intensidad,
      dolor_tipo,
      dolor_irradia,
      dolor_descripcion,
      inspeccion_visual,
      palpacion,
      movilidad_articular,
      pruebas_funcionales,
      valoracion_neurologica,
      valoracion_postural,
      evaluacion_funcional,
      diagnostico,
      objetivos_terapeuticos
    } = req.body;

    // Fusionar
    const newIdPaciente = id_paciente !== undefined ? id_paciente : currentData.id_paciente;
    const newIdProfesional =
      id_profesional !== undefined ? id_profesional : currentData.id_profesional;
    const newFechaEvaluacion =
      fecha_evaluacion !== undefined ? fecha_evaluacion : currentData.fecha_evaluacion;
    const newDolorLocalizacion =
      dolor_localizacion !== undefined ? dolor_localizacion : currentData.dolor_localizacion;
    const newDolorIntensidad =
      dolor_intensidad !== undefined ? dolor_intensidad : currentData.dolor_intensidad;
    const newDolorTipo = dolor_tipo !== undefined ? dolor_tipo : currentData.dolor_tipo;
    const newDolorIrradia =
      dolor_irradia !== undefined
        ? (dolor_irradia === true || dolor_irradia === 'true' ? 1 : 0)
        : currentData.dolor_irradia;
    const newDolorDescripcion =
      dolor_descripcion !== undefined ? dolor_descripcion : currentData.dolor_descripcion;
    const newInspeccionVisual =
      inspeccion_visual !== undefined ? inspeccion_visual : currentData.inspeccion_visual;
    const newPalpacion = palpacion !== undefined ? palpacion : currentData.palpacion;
    const newMovilidadArticular =
      movilidad_articular !== undefined ? movilidad_articular : currentData.movilidad_articular;
    const newPruebasFuncionales =
      pruebas_funcionales !== undefined ? pruebas_funcionales : currentData.pruebas_funcionales;
    const newValoracionNeurologica =
      valoracion_neurologica !== undefined
        ? valoracion_neurologica
        : currentData.valoracion_neurologica;
    const newValoracionPostural =
      valoracion_postural !== undefined ? valoracion_postural : currentData.valoracion_postural;
    const newEvaluacionFuncional =
      evaluacion_funcional !== undefined
        ? evaluacion_funcional
        : currentData.evaluacion_funcional;
    const newDiagnostico = diagnostico !== undefined ? diagnostico : currentData.diagnostico;
    const newObjetivosTerapeuticos =
      objetivos_terapeuticos !== undefined
        ? objetivos_terapeuticos
        : currentData.objetivos_terapeuticos;

    const updateQuery = `
      UPDATE evaluaciones
      SET
        id_paciente = ?,
        id_profesional = ?,
        fecha_evaluacion = ?,
        dolor_localizacion = ?,
        dolor_intensidad = ?,
        dolor_tipo = ?,
        dolor_irradia = ?,
        dolor_descripcion = ?,
        inspeccion_visual = ?,
        palpacion = ?,
        movilidad_articular = ?,
        pruebas_funcionales = ?,
        valoracion_neurologica = ?,
        valoracion_postural = ?,
        evaluacion_funcional = ?,
        diagnostico = ?,
        objetivos_terapeuticos = ?
      WHERE
        id_evaluacion = ?
    `;
    const params = [
      newIdPaciente,
      newIdProfesional,
      newFechaEvaluacion,
      newDolorLocalizacion,
      newDolorIntensidad,
      newDolorTipo,
      newDolorIrradia,
      newDolorDescripcion,
      newInspeccionVisual,
      newPalpacion,
      newMovilidadArticular,
      newPruebasFuncionales,
      newValoracionNeurologica,
      newValoracionPostural,
      newEvaluacionFuncional,
      newDiagnostico,
      newObjetivosTerapeuticos,
      id
    ];

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo actualizar la evaluación' });
    }

    res.json({ message: 'Evaluación actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar evaluación:', error);
    res.status(500).json({ error: 'Error al actualizar evaluación' });
  }
};

/**
 * Eliminar una evaluación
 */
exports.deleteEvaluacion = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM evaluaciones WHERE id_evaluacion = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    res.json({ message: 'Evaluación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar evaluación:', error);
    res.status(500).json({ error: 'Error al eliminar evaluación' });
  }
};

/* --------------------------------------------------
   TRATAMIENTOS
   -------------------------------------------------- */

/**
 * Obtener todos los tratamientos
 */
exports.getAllTratamientos = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tratamientos');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    res.status(500).json({ error: 'Error al obtener tratamientos' });
  }
};

/**
 * Obtener un tratamiento por id_tratamiento
 */
exports.getTratamientoById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM tratamientos WHERE id_tratamiento = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener tratamiento por ID:', error);
    res.status(500).json({ error: 'Error al obtener tratamiento' });
  }
};

/**
 * Obtener todos los tratamientos de un paciente
 */
exports.getTratamientosByPatient = async (req, res) => {
  try {
    const { id_paciente } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM tratamientos WHERE id_paciente = ? ORDER BY fecha_inicio DESC',
      [id_paciente]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tratamientos del paciente:', error);
    res.status(500).json({ error: 'Error al obtener tratamientos del paciente' });
  }
};

/**
 * Crear un nuevo tratamiento
 *  (ahora suplemento_prescrito es texto o NULL)
 */
exports.createTratamiento = async (req, res) => {
  try {
    const {
      id_paciente,
      id_profesional,
      fecha_inicio,
      fecha_fin,
      tecnicas_aplicadas,
      frecuencia_sesiones,
      duracion_sesion,
      recomendaciones,
      estado,
      suplemento_prescrito,
      capsulas_por_bote,
      dosis_diaria,
      fecha_inicio_suplementacion,
      dias_alerta
    } = req.body;

    // ── validación mínima ────────────────────────────
    if (!id_paciente || !fecha_inicio) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios (id_paciente, fecha_inicio)'
      });
    }

    // si viene "" o undefined ⇒ NULL
    const suplementoValue =
      suplemento_prescrito && suplemento_prescrito.trim() !== ''
        ? suplemento_prescrito.trim()
        : null;

    const query = `
      INSERT INTO tratamientos (
        id_paciente,
        id_profesional,
        fecha_inicio,
        fecha_fin,
        tecnicas_aplicadas,
        frecuencia_sesiones,
        duracion_sesion,
        recomendaciones,
        estado,
        suplemento_prescrito,
        capsulas_por_bote,
        dosis_diaria,
        fecha_inicio_suplementacion,
        dias_alerta
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const alertValue = dias_alerta ?? 0;
    const params = [
      id_paciente,
      id_profesional || null,
      fecha_inicio,
      fecha_fin || null,
      tecnicas_aplicadas || null,
      frecuencia_sesiones || null,
      duracion_sesion || null,
      recomendaciones || null,
      estado || 'Activo',
      suplementoValue,
      capsulas_por_bote ?? null,
      dosis_diaria ?? null,
      fecha_inicio_suplementacion || null,
      alertValue
    ];

    const [result] = await pool.query(query, params);
    res.status(201).json({
      message: 'Tratamiento creado correctamente',
      id_tratamiento: result.insertId
    });
  } catch (error) {
    console.error('Error al crear tratamiento:', error);
    res.status(500).json({ error: 'Error al crear tratamiento' });
  }
};

/**
 * Actualizar un tratamiento (incluye suplementación como texto)
 */
exports.updateTratamiento = async (req, res) => {
  try {
    const { id } = req.params;

    // ── obtener el registro actual ───────────────────
    const [currentDataArr] = await pool.query(
      'SELECT * FROM tratamientos WHERE id_tratamiento = ?',
      [id]
    );
    if (!currentDataArr.length) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    const current = currentDataArr[0];

    // ── desestructurar body ──────────────────────────
    const {
      id_paciente,
      id_profesional,
      fecha_inicio,
      fecha_fin,
      tecnicas_aplicadas,
      frecuencia_sesiones,
      duracion_sesion,
      recomendaciones,
      estado,
      suplemento_prescrito,
      capsulas_por_bote,
      dosis_diaria,
      fecha_inicio_suplementacion,
      dias_alerta
    } = req.body;

    // ── merge con valores actuales ───────────────────
    const newValues = {
      id_paciente: id_paciente ?? current.id_paciente,
      id_profesional: id_profesional ?? current.id_profesional,
      fecha_inicio: fecha_inicio ?? current.fecha_inicio,
      fecha_fin: fecha_fin ?? current.fecha_fin,
      tecnicas_aplicadas: tecnicas_aplicadas ?? current.tecnicas_aplicadas,
      frecuencia_sesiones: frecuencia_sesiones ?? current.frecuencia_sesiones,
      duracion_sesion: duracion_sesion ?? current.duracion_sesion,
      recomendaciones: recomendaciones ?? current.recomendaciones,
      estado: estado ?? current.estado,
      suplemento_prescrito:
        suplemento_prescrito !== undefined
          ? (suplemento_prescrito && suplemento_prescrito.trim() !== ''
            ? suplemento_prescrito.trim()
            : null)
          : current.suplemento_prescrito,
      capsulas_por_bote: capsulas_por_bote ?? current.capsulas_por_bote,
      dosis_diaria: dosis_diaria ?? current.dosis_diaria,
      fecha_inicio_suplementacion: fecha_inicio_suplementacion ?? current.fecha_inicio_suplementacion,
      dias_alerta: dias_alerta ?? current.dias_alerta
    };

    const updateQuery = `
      UPDATE tratamientos
      SET
        id_paciente = ?,
        id_profesional = ?,
        fecha_inicio = ?,
        fecha_fin = ?,
        tecnicas_aplicadas = ?,
        frecuencia_sesiones = ?,
        duracion_sesion = ?,
        recomendaciones = ?,
        estado = ?,
        suplemento_prescrito = ?,
        capsulas_por_bote = ?,
        dosis_diaria = ?,
        fecha_inicio_suplementacion = ?,
        dias_alerta = ?
      WHERE id_tratamiento = ?
    `;

    const params = [
      newValues.id_paciente,
      newValues.id_profesional,
      newValues.fecha_inicio,
      newValues.fecha_fin,
      newValues.tecnicas_aplicadas,
      newValues.frecuencia_sesiones,
      newValues.duracion_sesion,
      newValues.recomendaciones,
      newValues.estado,
      newValues.suplemento_prescrito,
      newValues.capsulas_por_bote,
      newValues.dosis_diaria,
      newValues.fecha_inicio_suplementacion,
      newValues.dias_alerta,
      id
    ];

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo actualizar el tratamiento' });
    }

    res.json({ message: 'Tratamiento actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar tratamiento:', error);
    res.status(500).json({ error: 'Error al actualizar tratamiento' });
  }
};

/**
 * Eliminar un tratamiento
 */
exports.deleteTratamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM tratamientos WHERE id_tratamiento = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    res.json({ message: 'Tratamiento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tratamiento:', error);
    res.status(500).json({ error: 'Error al eliminar tratamiento' });
  }
};
