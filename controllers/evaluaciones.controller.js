const pool = require('../database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/* ───────── helpers generales ───────── */
const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

const hoyYHora = () => {
  const now = new Date();
  const hoy = `${String(now.getDate()).padStart(2, '0')} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
  const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { hoy, hora };
};

const normaliza = txt => (txt || '').trim();

/* ───────── helper WINBACK 1-4 ───────── */
const winbackCompleto = (addTitulo, addListaSafe) => {
  addTitulo('TECAR. 1 - PROCEDIMIENTO');
  addListaSafe([
    'TECAR (alta frecuencia), que estimula los mecanismos de cicatrización naturales del cuerpo y favorece la renovación celular',
    'HI-TENS (alta frecuencia con impulsos de baja frecuencia), que aumenta la potencia analgésica del TENS',
    'HI-EMS (media frecuencia modulada en bajas frecuencias), que contrae en profundidad los músculos para conseguir un refuerzo muscular y un drenaje'
  ]);

  addTitulo('TECAR. 2 - CONSECUENCIAS SEGURAS');
  addListaSafe([
    'Alivio de los dolores musculares y sintomáticos (agudos y crónicos)',
    'Relajación de los espasmos musculares',
    'Mejora de la cicatrización ósea relacionada con las patologías artrósicas',
    'Mejora de la movilidad de las funciones articulares',
    'Atención de las patologías musculares y tendinosas debidas a traumatismos',
    'Mejora de la microcirculación y del proceso de cicatrización',
    'Fortalecimiento muscular con un aumento de la flexibilidad'
  ]);

  addTitulo('TECAR. 3 - DESCRIPCIÓN DE LAS CONTRAINDICACIONES');
  addListaSafe([
    'Mujeres embarazadas',
    'Menores sin consentimiento del representante legal',
    'Cáncer y lesiones cancerosas',
    'Trastornos o lesiones en la piel (eczemas, quemaduras, heridas abiertas)',
    'Trastornos de la coagulación (Flebitis, Tromboflebitis)',
    'Insensibilidad al calor o al dolor',
    'Fiebre, infección bacteriana o enfermedad infecciosa',
    'Hipertensión o hipotensión grave',
    'Implantes eléctricos (marcapasos, bomba de insulina, neuroestimulador)'
  ]);

  addTitulo('TECAR. 4 - EFECTOS SECUNDARIOS');
  addListaSafe([
    'En algunos casos, se puede sentir un aumento transitorio del dolor dentro de las 24 horas posteriores a la sesión si la intensidad es demasiado alta. Esta sensación desaparece de forma espontánea',
    'En casos muy raros, el paciente puede sufrir alergia a la crema conductiva o quemaduras superficiales',
    'En pocos casos, si se efectúa una terapia de cuerpo entero, se puede observar hipotensión reactiva'
  ]);

  addTitulo('CRYO. 1 - PROCEDIMIENTO');
  addListaSafe([
    'Winback ha desarrollado el dispositivo CRYOBACK el cual combina el frío intenso y la electroestimulación. La gran combinación de estas dos tecnologías permite la mejor penetración del frío, al tiempo que garantiza la máxima seguridad y una perfecta focalización de la zona tratada. Cada almohadilla (PAD) está equipada con dos sensores de temperatura que comprueban en tiempo real la temperatura de la zona de contacto y, por tanto, de la superficie de la piel. La combinación de crioterapia con electroestimulación:',
    'Es un procedimiento no invasivo, rápido y sin necesidad de preparación inicial',
    'Acciones localizadas y controladas gracias a las placas frías colocadas en la piel de la zona a tratar',
    'Estimulación muscular en paralelo con el efecto “crio”, permitiendo el reclutamiento de las fibras musculares y ofreciendo un fortalecimiento localizado de los tejidos',
    'Más confort durante el tratamiento gracias a la estimulación eléctrica que facilita la bajada de temperatura de la zona a tratar',
    'Un fortalecimiento muscular más cómodo gracias a la hipoestesia creada por el frío'
  ]);

  addTitulo('CRYO. 2 - DESCRIPCIÓN DE LAS CONTRAINDICACIONES');
  addListaSafe([
    'Embarazo o lactancia',
    'Epilepsias y pacientes con tumores',
    'Pacientes con inflamaciones agudas o enfermedades infecciosas',
    'Pacientes con heridas abiertas en la zona del tratamiento',
    'Pacientes con enfermedades cardíacas o renales, o diabetes severa',
    'Pacientes con enfermedades sanguíneas o con enfermedades que provocan debilidad física',
    'Pacientes con la piel dañada o afectada por una enfermedad (psoriasis, eczemas)',
    'Pacientes con enfermedades que modifican la respuesta al frío o al calor',
    'Pacientes que se hayan sometido a una operación quirúrgica en los últimos meses',
    'Fiebre – Infección bacteriana – Enfermedad infecciosa',
    'Hipertensión o hipotensión grave',
    'Implantes eléctricos (Marcapasos, bomba de insulina, neuroestimulador)'
  ]);

  addTitulo('CRYO. 3 - EFECTOS SECUNDARIOS');
  addListaSafe([
    'Después del tratamiento, los tejidos tratados temporalmente pueden aparecer rígidos a la vista o tacto',
    'Enrojecimiento de la piel',
    'Después del tratamiento se puede experimentar una sensación de mareo o cansancio',
    'Endurecimiento o insensibilidad de la zona tratada por unas 48 horas',
    'En casos muy raros: quemaduras de la piel',
    'Alergia a la crema',
    'En algunos casos, durante las 24 horas después del tratamiento, se puede sentir un resurgimiento transitorio del dolor'
  ]);
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

    const { hoy, hora } = hoyYHora();

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
      .text('CONSENTIMIENTO INFORMADO Y ACEPTACIÓN DE SERVICIOS PROFESIONALES DE OSTEOPATÍA INTEGRAL Y FISIOTERAPIA', {
        align: 'center', lineGap: 2
      })
      .moveDown();

    doc.font('Raleway').fontSize(11)
      .text('Con el fin de que disponga de la información necesaria y otorgue su consentimiento de forma libre y voluntaria antes de iniciar cualquier intervención, se le facilita el presente documento. Lea detenidamente cada apartado y pregunte cualquier duda.', {
        align: 'justify'
      })
      .moveDown();

    /* CENTRO */
    addTitulo('· CENTRO DE OSTEOPATÍA INTEGRAL Y FISIOTERAPIA:');
    addListaSafe([
      'Centro: Paris & Bea',
      `Dirección: ${normaliza(home?.direccion_centro)}`,
      `Teléfono: ${normaliza(home?.telefono)}`,
      `Mail: ${normaliza(home?.mail)}`,
      `CIF: ${normaliza(home?.cif)}`
    ]);

    /* PROFESIONAL INICIAL */
    addTitulo('· PROFESIONAL:');
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
      addTitulo('· OTROS PROFESIONALES DEL CENTRO:');
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
    addTitulo('· IDENTIFICACIÓN DEL PACIENTE:');
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
      const savedX = doc.x;                      // posición de partida
      const shiftIndent = () => {
        doc.x = doc.page.margins.left + INDENT_WINBACK;
      };

      /* primera vez desplazamos x y registramos listener */
      shiftIndent();
      doc.on('pageAdded', shiftIndent);

      winbackCompleto(addTitulo, addListaSafe);

      /* restauramos estado original */
      doc.removeListener('pageAdded', shiftIndent);
      doc.x = savedX;
    };

    const bloqueFisio = () => {
      addTitulo('· NATURALEZA, OBJETIVO Y PLAN DE TRATAMIENTO');
      doc.font('Raleway').text(
        'El plan de tratamiento propuesto se inicia con Fisioterapia, disciplina de naturaleza sanitaria, que puede incluir, pero no se limita a, las siguientes técnicas de las que se me ha informado:',
        { align: 'justify' }).moveDown(0.5);

      addListaSafe([
        'Evaluación física y funcional',
        'Terapias manuales',
        'Ejercicios terapéuticos',
        'Electroterapia',
        'Termoterapia y crioterapia',
        'Ultrasonido',
        'Vendaje neuromuscular',
        'Tratamientos con dispositivos SWINS S.A.S/WINBACK de acuerdo con los siguientes aspectos:'
      ]);

      /* WINBACK indentado */
      imprimirWinbackIndentado();

      doc.font('Raleway').text(
        'El objetivo del tratamiento es mejorar mi estado físico y funcional mediante técnicas de fisioterapia.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Los beneficios esperados son el alivio del dolor, la mejora de la movilidad, la recuperación de la función y la prevención de lesiones.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Los efectos secundarios potenciales podrían ser dolor temporal, hematomas, mareos, reacciones alérgicas a los materiales utilizados (vendajes, cremas, etc.).',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Existen alternativas disponibles como tratamientos alternativos, incluidos medicamentos, cirugía u otros enfoques terapéuticos.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Y el tratamiento podría continuar con otras disciplinas como la Osteopatía, de naturaleza no sanitaria, aplicada por otros profesionales del centro, de acuerdo a los siguientes aspectos, de los cuales se me ha informado:',
        { align: 'justify' }).moveDown(0.5);

      addListaSafe([
        'La duración y periodicidad más aconsejable en mis circunstancias personales',
        'Los efectos razonablemente esperables',
        'Los costes económicos de la realización de las sesiones propuestas de Osteopatía',
        'Los beneficios físicos que pueden derivarse de la utilización y prestación de los servicios propuestos, al depender de múltiples factores y variables, no pueden garantizarse absolutamente en todos los casos',
        'Los servicios no sanitarios de Osteopatía no excluyen, ni sustituyen, cualquier tratamiento médico o farmacológico convencional, de manera que la aceptación de los servicios propuestos es una decisión voluntaria, libre y responsable',
        'La Osteopatía basa su práctica en la relajación y el equilibrio de la estructura musculoesquelética, craneal y visceral, todo ello de forma manual',
        'Durante la sesión, el profesional realizará una serie de test y palpaciones manuales, para identificar las estructuras que han sufrido pérdida de movimiento o estrés mecánico, y aplicará las técnicas manuales pertinentes, con el objetivo de normalizar la función y recuperar la elasticidad de los tejidos, reduciendo las molestias y favoreciendo la relajación y el equilibrio del sistema nervioso.'
      ]);
    };

    const bloqueOsteo = () => {
      addTitulo('· NATURALEZA, OBJETIVO Y PLAN DE TRATAMIENTO');
      doc.font('Raleway').text(
        'El plan de tratamiento propuesto se inicia con Osteopatía, disciplina de naturaleza no sanitaria, de acuerdo a los siguientes aspectos, de los cuales se me ha informado:',
        { align: 'justify' }).moveDown(0.5);

      addListaSafe([
        'La duración y periodicidad más aconsejable en mis circunstancias personales',
        'Los efectos razonablemente esperables',
        'Los costes económicos de la realización de las sesiones propuestas de Osteopatía',
        'Los beneficios físicos que pueden derivarse de la utilización y prestación de los servicios propuestos, al depender de múltiples factores y variables, no pueden garantizarse absolutamente en todos los casos',
        'Los servicios no sanitarios de Osteopatía no excluyen, ni sustituyen, cualquier tratamiento médico o farmacológico convencional, de manera que la aceptación de los servicios propuestos es una decisión voluntaria, libre y responsable',
        'La Osteopatía basa su práctica en la relajación y el equilibrio de la estructura musculoesquelética, craneal y visceral, todo ello de forma manual'
      ]);

      doc.font('Raleway').text(
        'Durante la sesión, el profesional realizará una serie de test y palpaciones manuales, para identificar las estructuras que han sufrido pérdida de movimiento o estrés mecánico, y aplicará las técnicas manuales pertinentes, con el objetivo de normalizar la función y recuperar la elasticidad de los tejidos, reduciendo las molestias y favoreciendo la relajación y el equilibrio del sistema nervioso.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Y el tratamiento podría continuar con otras disciplinas como la Fisioterapia, de naturaleza sanitaria, aplicada por otros profesionales del centro, que puede incluir, pero no se limita a, las siguientes técnicas de las que se me ha informado:',
        { align: 'justify' }).moveDown(0.5);

      addListaSafe([
        'Evaluación física y funcional',
        'Terapias manuales',
        'Ejercicios terapéuticos',
        'Electroterapia',
        'Termoterapia y crioterapia',
        'Ultrasonido',
        'Vendaje neuromuscular',
        'Tratamientos con dispositivo SWINS S.A.S/WINBACK de acuerdo con los siguientes aspectos y procedimientos:'
      ]);

      /* WINBACK indentado */
      imprimirWinbackIndentado();

      doc.font('Raleway').text(
        'El objetivo del tratamiento es mejorar mi estado físico y funcional mediante técnicas de fisioterapia.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Los beneficios esperados son el alivio del dolor, la mejora de la movilidad, la recuperación de la función y la prevención de lesiones.',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Los efectos secundarios potenciales podrían ser dolor temporal, hematomas, mareos, reacciones alérgicas a los materiales utilizados (vendajes, cremas, etc.).',
        { align: 'justify' }).moveDown();

      doc.font('Raleway').text(
        'Existen alternativas disponibles como tratamientos alternativos, incluidos medicamentos, cirugía u otros enfoques terapéuticos.',
        { align: 'justify' }).moveDown();
    };

    /* decide qué bloque imprimir */
    if (esFisio) bloqueFisio();
    else if (esOsteo) bloqueOsteo();
    else addTitulo('⚠ No se ha podido determinar la especialidad del profesional inicial.');

    /* BLOQUES FINALES COMUNES */
    addTitulo('· PROTECCIÓN DE DATOS');
    doc.font('Raleway').text(
      'De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la L.O. 3/2018, mis datos personales se tratarán con la máxima confidencialidad y exclusivamente para la gestión de mi historia clínica y la prestación de los servicios solicitados. Podré ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad.',
      { align: 'justify' }).moveDown();

    addTitulo('· DERECHOS DEL PACIENTE');
    doc.font('Raleway').text(
      'En virtud de la Ley 41/2002, de 14 de noviembre, básica reguladora de la autonomía del paciente, se me ha facilitado información comprensible y veraz, y se garantizará mi intimidad y la protección de mi historia clínica.',
      { align: 'justify' }).moveDown();

    addTitulo('· DECLARACIÓN DEL PACIENTE');
    doc.font('Raleway').text(
      'Declaro que he leído y comprendido la información contenida en este documento, que se han resuelto satisfactoriamente todas mis preguntas y que otorgo mi consentimiento informado para recibir tratamientos de fisioterapia y/o osteopatía en las condiciones descritas. Asimismo, entiendo que tengo derecho a retirar mi consentimiento y detener el tratamiento en cualquier momento.',
      { align: 'justify' }).moveDown();

    doc.text(`En Ibiza, ${hoy}   Hora: ${hora}`).moveDown(5);
    doc.text('Firma del/la Paciente: ________________________________').moveDown(4);
    doc.text('Firma del/la Profesional: _____________________________').moveDown(1);

    /* PÁGINA REPRESENTANTE (opcional) */
    if (nombre_representante || dni_representante || calidad_representante) {
      doc.addPage();
      logoCenter();

      doc.font('Raleway').text(
        `Yo, ${repNombre}, con DNI/NIE/Pasaporte ${repDni}, actuando como representante legal del paciente, en calidad de ${repCalidad}, manifiesto que he recibido la información anterior y considero beneficiosa la realización del tratamiento descrito. Por ello, otorgo mi consentimiento en su nombre.`,
        { align: 'justify' }).moveDown(2);

      doc.text(`En Ibiza, ${hoy}   Hora: ${hora}`).moveDown(5);
      doc.text('Firma del/de la Representante: ________________________');
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
      dias_alerta ?? null
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
