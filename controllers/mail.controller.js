const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const path = require('path');
const fs = require('fs');
const db = require('../database');

// ---------------------------------------------------------------------------
// Una pequeña función para generar una plantilla de email
function getEmailTemplate(title, content, footerHTML = '') {
  const logoURL = 'https://parisandbea.es/images/recursos/parisandbealogo.png';
  return `
  <html>
    <body style="font-family:Raleway,sans-serif;margin:0;padding:20px;background:#aed3c1">
      <div style="background:#fff;padding:20px;border-radius:5px;max-width:600px;margin:auto">
        <div style="text-align:center;margin-bottom:20px">
          <img src="${logoURL}" alt="Logo" style="max-width:200px">
          <h1 style="font-size:24px;margin:10px 0">${title}</h1>
        </div>

        <div style="font-size:16px;line-height:1.5">
          ${content}
        ${footerHTML}   <!-- ← bloque profesional si llega -->
        </div>

        <div style="margin-top:20px;font-size:12px;color:#777;text-align:center">
          <p>Centro Paris & Bea – Todos los derechos reservados.</p>
          <p><a href="https://parisandbea.es">www.parisandbea.es</a></p>
        </div>
      </div>
    </body>
  </html>`;
}
// ---------------------------------------------------------------------------

// CONFIGURACIÓN DEL TRANSPORTER PARA ENVIAR EMAILS
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'parisandbea.es',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
  secure: (process.env.SMTP_SECURE === 'true'), // true para 465
  auth: {
    user: process.env.SMTP_USER || 'info@parisandbea.es',
    pass: process.env.SMTP_PASS || 'TU_CONTRASEÑA'
  }
});

/**
 * Enviar correo y guardarlo en la tabla emails_sent.
 */
exports.sendMail = async (req, res) => {
  try {
    const { to: toRaw, id_paciente, subject, text, htmlContent, attachments } = req.body;

    let to = toRaw;
    // Permitir enviar por id_paciente sin exponer el email
    let toName = '';
    if (!to && id_paciente) {
      let id = id_paciente;
      if (typeof id === 'string') {
        const m = id.match(/PAC-(\d+)/i);
        if (m) id = parseInt(m[1], 10);
      }
      if (!isNaN(id)) {
        const [rows] = await db.query(
          'SELECT nombre, email FROM pacientes WHERE id_paciente = ? LIMIT 1',
          [id]
        );
        if (rows.length) {
          to = rows[0].email || null;
          toName = rows[0].nombre || '';
        }
      }
    }

    if (!to || !subject) {
      return res.status(400).json({ error: 'Faltan "to" o "subject"' });
    }

    /* ---------- busca al profesional ---------- */
    /* Preferencia: id en sesión; fallback: id_profesional recibido en body */
    const idProf = req.session?.user?.id_profesional || req.body.id_profesional;
    let pro = null;
    if (idProf) {
      const [rows] = await db.query(
        `SELECT nombre, mail       AS email,
                num_colegiado      AS colegiado,
                telefono
           FROM profesionales
          WHERE id_profesional = ? LIMIT 1`, [idProf]);
      pro = rows[0] || null;
    }

    /* ---------- Footer din ámico ---------- */
    const proFooter = pro ? `
      <div style="margin-top:25px;font-size:13px">
        <p><strong>${pro.nombre || ''}</strong></p>
        ${pro.colegiado ? `<p>N.º colegiado: ${pro.colegiado}</p>` : ''}
        ${pro.telefono ? `<p>Tel.: ${pro.telefono}</p>` : ''}
        ${pro.email ? `<p>Email: ${pro.email}</p>` : ''}
      </div>` : '';

    /* ---------- plantilla corporativa ---------- */
    const html = htmlContent
      ? htmlContent + proFooter                              // si llega HTML propio, solo anexamos footer
      : getEmailTemplate(subject, `<p>${text || ''}</p>`, proFooter);

    /* ---------- rutas adjuntos con encode URI ---------- */
    if (attachments?.length) {
      attachments.forEach(a => { if (a.path) a.path = encodeURI(decodeURI(a.path)); });
    }

    /* ---------- envío ---------- */
    const mailOptions = {
      from: process.env.SMTP_USER || 'info@parisandbea.es',
      to, subject,
      text: 'Visualiza este correo en un cliente que soporte HTML.',
      html, attachments
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado:', info.messageId);

    /* ---------- registra en BD ---------- */
    await db.query(
      `INSERT INTO emails_sent
         (to_name,to_email,subject,content,date_sent,attachment_paths,status)
       VALUES (?,?,?,?,NOW(),?,?)`,
      [toName || '', to, subject, text || '',
      attachments ? JSON.stringify(attachments.map(a => a.path || a.filename)) : null,
        'sent']
    );

    res.json({ message: 'Email enviado correctamente', info });
  } catch (err) {
    console.error('Error al enviar email:', err);
    res.status(500).json({ error: 'Error al enviar email' });
  }
};

/**
 * Leer correos vía IMAP y guardarlos en la tabla emails_received.
 * Se guardan adjuntos en attachments_mail (carpeta local).
 */
exports.fetchReceivedEmails = async (req, res) => {
  const { mode } = req.query;  // p.ej: ?mode=today, ?mode=week

  const imapConfig = {
    user: process.env.IMAP_USER || 'info@parisandbea.es',
    password: process.env.IMAP_PASS || 'TU_CONTRASEÑA',
    host: process.env.IMAP_HOST || 'parisandbea.es',
    port: process.env.IMAP_PORT ? parseInt(process.env.IMAP_PORT) : 993,
    tls: (process.env.IMAP_TLS === 'true')
  };

  const imap = new Imap({
    user: imapConfig.user,
    password: imapConfig.password,
    host: imapConfig.host,
    port: imapConfig.port,
    tls: imapConfig.tls
  });

  function openInbox(cb) {
    imap.openBox('INBOX', false, cb);
  }

  imap.once('ready', function () {
    openInbox(async (err, box) => {
      if (err) {
        console.error('Error al abrir INBOX:', err);
        return res.status(500).json({ error: 'Error al abrir el buzón IMAP' });
      }

      let searchCriteria = ['ALL'];
      const today = new Date();

      if (mode === 'today') {
        // Emails a partir de la medianoche de hoy
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        searchCriteria = [['SINCE', date.toUTCString()]];
      } else if (mode === 'week') {
        // Últimos 7 días
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        searchCriteria = [['SINCE', lastWeek.toUTCString()]];
      }

      imap.search(searchCriteria, (err, results) => {
        if (err) {
          console.error('Error al buscar correos:', err);
          return res.status(500).json({ error: 'Error al buscar correos' });
        }

        if (!results || !results.length) {
          imap.end();
          return res.json({ message: 'No se encontraron correos con ese criterio.' });
        }

        const f = imap.fetch(results, { bodies: '' });

        f.on('message', function (msg, seqno) {
          msg.on('body', function (stream, info) {
            simpleParser(stream, async (err, mail) => {
              if (err) {
                console.error('Error al parsear el correo:', err);
              } else {
                const fromName = mail.from?.text || '';
                const fromEmail = mail.from?.value?.[0]?.address || '';
                const subject = mail.subject || '';
                const dateReceived = mail.date ? new Date(mail.date) : new Date();
                const content = mail.text || '';
                const messageId = mail.messageId || null;

                // Guardar adjuntos
                let attachmentPaths = [];
                if (mail.attachments && mail.attachments.length > 0) {
                  for (const attach of mail.attachments) {
                    const filename = attach.filename || `adjunto-${Date.now()}`;
                    // Ojo: guardamos en attachments_mail
                    const filePath = path.join(__dirname, '..', 'attachments_mail', filename);
                    fs.writeFileSync(filePath, attach.content);
                    attachmentPaths.push(filePath);
                  }
                }

                try {
                  // Verificar si el messageId ya está en la BD
                  if (messageId) {
                    const [rows] = await db.query(
                      'SELECT id FROM emails_received WHERE message_id = ?',
                      [messageId]
                    );
                    if (rows.length > 0) {
                      console.log(`Correo con messageId ${messageId} ya existe. Se omite inserción.`);
                      return;
                    }
                  }

                  // Insertar en la tabla emails_received
                  await db.query(
                    `INSERT INTO emails_received 
                     (from_name, from_email, subject, content, date_received, attachment_paths, message_id)
                     VALUES (?,?,?,?,?,?,?)`,
                    [
                      fromName,
                      fromEmail,
                      subject,
                      content,
                      dateReceived,
                      JSON.stringify(attachmentPaths),
                      messageId
                    ]
                  );
                  console.log(`Correo con subject "${subject}" insertado en la BD.`);
                } catch (dbError) {
                  console.error('Error al insertar en BD:', dbError);
                }
              }
            });
          });

          msg.once('attributes', function (attrs) {
            const { uid } = attrs;
            // Opcional: marcar como leído
            imap.addFlags(uid, ['\\Seen'], (err) => {
              if (err) {
                console.error('Error al marcar el correo como leído:', err);
              }
            });
          });
        });

        f.once('error', function (err) {
          console.error('Error en la lectura de correo:', err);
        });

        f.once('end', function () {
          console.log('Finalizó la búsqueda de correos.');
          imap.end();
        });
      });
    });
  });

  imap.once('error', function (err) {
    console.error('Error general IMAP:', err);
    return res.status(500).json({ error: 'Error en la conexión IMAP' });
  });

  imap.once('end', function () {
    console.log('Conexión IMAP cerrada');
  });

  imap.connect();

  return res.json({ message: 'Proceso de lectura iniciado. Se almacenarán en BD los correos encontrados.' });
};

/**
 * Listar correos recibidos (con filtro opcional).
 *    GET /api/mail/received/:filter?
 *    - /api/mail/received/today
 *    - /api/mail/received/week
 *    - /api/mail/received/2025-02-01 (YYYY-MM-DD)
 * Si no se pasa filtro, listará todos.
 */
exports.listReceivedEmails = async (req, res) => {
  try {
    const { filter } = req.params;
    let query = 'SELECT * FROM emails_received ORDER BY date_received DESC';
    let params = [];

    if (filter) {
      if (filter === 'today') {
        query = `
          SELECT * FROM emails_received
          WHERE DATE(date_received) = CURDATE()
          ORDER BY date_received DESC
        `;
      } else if (filter === 'week') {
        query = `
          SELECT * FROM emails_received
          WHERE date_received >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ORDER BY date_received DESC
        `;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) {
        // Filtra por fecha exacta (YYYY-MM-DD)
        query = `
          SELECT * FROM emails_received
          WHERE DATE(date_received) = ?
          ORDER BY date_received DESC
        `;
        params = [filter];
      }
    }

    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (error) {
    console.error("Error al listar correos recibidos:", error);
    return res.status(500).json({ error: 'Error al listar correos recibidos' });
  }
};

/**
 * Listar correos enviados (con filtro opcional).
 *    GET /api/mail/sent/:filter?
 *    - /api/mail/sent/today
 *    - /api/mail/sent/week
 *    - /api/mail/sent/2025-02-01
 */
exports.listSentEmails = async (req, res) => {
  try {
    const { filter } = req.params;
    let query = 'SELECT * FROM emails_sent ORDER BY date_sent DESC';
    let params = [];

    if (filter) {
      if (filter === 'today') {
        query = `
          SELECT * FROM emails_sent
          WHERE DATE(date_sent) = CURDATE()
          ORDER BY date_sent DESC
        `;
      } else if (filter === 'week') {
        query = `
          SELECT * FROM emails_sent
          WHERE date_sent >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ORDER BY date_sent DESC
        `;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) {
        // Fecha exacta
        query = `
          SELECT * FROM emails_sent
          WHERE DATE(date_sent) = ?
          ORDER BY date_sent DESC
        `;
        params = [filter];
      }
    }

    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (error) {
    console.error("Error al listar correos enviados:", error);
    return res.status(500).json({ error: 'Error al listar correos enviados' });
  }
};

/**
 * Eliminar correo recibido por ID (también elimina adjuntos físicos).
 */
exports.deleteReceivedEmailById = async (req, res) => {
  try {
    const { id } = req.params; // ID del correo a eliminar

    if (!id) {
      return res.status(400).json({ error: 'Debe proporcionar un ID válido.' });
    }

    // 1) Recuperar el correo (para saber qué adjuntos tiene)
    const [rows] = await db.query(
      'SELECT attachment_paths FROM emails_received WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No se encontró el correo con ese ID.' });
    }

    // 2) Eliminar adjuntos físicos
    const { attachment_paths } = rows[0];
    if (attachment_paths) {
      try {
        const attachments = JSON.parse(attachment_paths);
        if (Array.isArray(attachments)) {
          attachments.forEach(filePath => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
        }
      } catch (err) {
        console.error('Error al procesar adjuntos:', err);
      }
    }

    // 3) Eliminar el correo de la BD
    await db.query('DELETE FROM emails_received WHERE id = ?', [id]);

    return res.json({ message: 'Correo eliminado correctamente.', deleted: 1 });
  } catch (error) {
    console.error('Error al eliminar correo recibido:', error);
    return res.status(500).json({ error: 'Error al eliminar el correo.' });
  }
};

/**
 * Eliminar correo enviado por ID (solo se elimina en BD, no hay archivos físicos).
 */
exports.deleteSentEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Debe proporcionar un ID válido.' });
    }

    // Verificar si existe el registro
    const [rows] = await db.query(
      'SELECT id FROM emails_sent WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No se encontró el correo enviado con ese ID.' });
    }

    // Eliminar el correo de la BD
    await db.query('DELETE FROM emails_sent WHERE id = ?', [id]);

    return res.json({ message: 'Correo enviado eliminado correctamente.', deleted: 1 });
  } catch (error) {
    console.error('Error al eliminar correo enviado:', error);
    return res.status(500).json({ error: 'Error al eliminar el correo enviado.' });
  }
};

exports.listImapFolders = (req, res) => {
  const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    tls: process.env.IMAP_TLS === 'true'
  };

  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    imap.getBoxes((err, boxes) => {
      if (err) {
        res.status(500).send('Error al obtener carpetas IMAP: ' + err.message);
        imap.end();
        return;
      }
      res.send(JSON.stringify(boxes, null, 2));
      imap.end();
    });
  });

  imap.once('error', (err) => {
    res.status(500).send('Error de conexión IMAP: ' + err.message);
  });

  imap.once('end', () => {
    console.log('Conexión IMAP cerrada.');
  });

  imap.connect();
};

module.exports.getEmailTemplate = getEmailTemplate;