const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();
const cron = require('node-cron');
const { revisarAyer } = require('./cron/incidenciasCron');
const { limpiarDrafts } = require('./cron/cleanDraftsCron');
const { cleanTokens } = require('./cron/cleanTokensCron');
const { cleanConsentimientos } = require('./cron/cleanConsentimientosCron');
const cors = require('cors');
const TMP = path.join(__dirname, 'tmp');

if (process.env.OPENAI_API_KEY_PAB) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY_PAB;
}


require('./database');

app.use(session({
  secret: 'Snaguel134250987234JEROM098',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Proteger la página pab-files.html si no hay sesión
app.use((req, res, next) => {
  const protectedPages = ['/pab-files.html', '/inicio-consulta.html', '/consulta.html'];
  if (protectedPages.includes(req.path) && !req.session.user) {
    return res.redirect('/pab-login.html');
  }
  next();
});

// Servir estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

// Rutas estáticas especiales
app.use('/documentos/consentimientos', express.static(path.join(__dirname, 'documentos', 'consentimientos')));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/*  habilitamos CORS SOLO para las rutas necesarias  */
app.use('/api/profesionales/slim', cors());
app.use('/api/fichajes/registrar', cors());

// Rutas de tu app
const homeRoutes = require('./routes/home.routes');
app.use('/api/home', homeRoutes);

const willemRoutes = require('./routes/willem.routes');
app.use('/api/willem', willemRoutes);

const profesionalesRoutes = require('./routes/profesionales.routes');
app.use('/api/profesionales', profesionalesRoutes);

const pacientesRoutes = require('./routes/pacientes.routes');
app.use('/api/pacientes', pacientesRoutes);

const evaluacionesRoutes = require('./routes/evaluaciones.routes');
app.use('/api', evaluacionesRoutes);

const loginRoutes = require('./routes/login.routes');
app.use('/api/login', loginRoutes);

const filesRoutes = require('./routes/files.routes');
app.use('/api/files', filesRoutes);

const documentosRoutes = require('./routes/documentos.routes');
app.use('/api/documents', documentosRoutes);

const mailRoutes = require('./routes/mail.routes');
app.use('/api/mail', mailRoutes);

const serviciosRoutes = require('./routes/servicios.routes');
app.use('/api/servicios', serviciosRoutes);

const fichajesRoutes = require('./routes/fichajes.routes');
app.use('/api/fichajes', fichajesRoutes);

const voiceRoutes = require('./routes/voice.routes');
app.use('/api/voice', voiceRoutes);

const sessionRoutes = require('./routes/session.routes');
app.use('/api/session', sessionRoutes);

const blocksRoutes = require('./routes/blocks.routes');
app.use('/api/blocks', blocksRoutes);

const assistantVoiceRoutes = require('./routes/assistantVoice.routes');
app.use('/api/assistant', assistantVoiceRoutes);

const assistantRoutes = require('./routes/assistant.routes');
app.use('/api/assistant', assistantRoutes);

const chatsRoutes = require('./routes/chats.routes');
app.use('/api/chats', chatsRoutes);

const assistantFilesRoutes = require('./routes/assistantFiles.routes');
app.use('/api/assistant/files', assistantFilesRoutes);

const productosRoutes = require('./routes/productos.routes');
app.use('/api/productos', productosRoutes);

const tokenRoutes = require('./routes/registroTokens.routes');
app.use('/api/tokens', tokenRoutes);

const publicPacRoutes = require('./routes/pacientesPublic.routes');
app.use('/api/public/pacientes', publicPacRoutes);

const viafirmaRoutes = require('./routes/viafirma.routes');
app.use('/api/viafirma', viafirmaRoutes);

const ONE_HOUR = 60 * 60 * 1000;

/* cada hora: borra MP3/WEBM del tmp >30 min */
cron.schedule('0 * * * *', () => {
  fs.readdir(TMP, (e, files) => {
    if (e) return;
    const limit = Date.now() - 15 * 60 * 1000;
    files.forEach(f => {
      if (!/\.(mp3|webm|m4a|mp4|wav|flac|ogg|oga|pdf|docx?|png|jpe?g|webp|gif)$/i.test(f)) return;
      const abs = path.join(TMP, f);
      fs.stat(abs, (e, st) => {
        if (!e && st.mtimeMs < limit) fs.unlink(abs, () => { });
      });
    });
  });
});

/* ───── eliminar un audio del tmp ───── */
app.delete('/tmp/:file', (req, res) => {
  const file = path.basename(req.params.file);          // evita path-traversal
  if (!/\.(mp3|webm|m4a|mp4|wav|flac|ogg|oga|pdf|docx?|png|jpe?g|webp|gif|heic)$/i.test(f))
    return res.status(400).json({ error: 'Formato no permitido' });

  const abs = path.join(TMP, file);
  fs.unlink(abs, err => {
    if (err) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json({ deleted: true });
  });
});

/* ───── limpiar tokens antiguos (>2 días) ─────
   todos los lunes a las 04:15 hora de Madrid     */
cron.schedule('15 4 * * 1', () => {
  console.log('[cron] Limpiando tokens antiguos…');
  cleanTokens(2);                    // 2 días de antigüedad
}, { timezone: 'Europe/Madrid' });

// ---- CRON diario para olvidos y ausencias -----------------

// Todos los días a las 02:00 de la madrugada (hora del servidor)
cron.schedule('0 2 * * *', () => {
  console.log('[cron] Revisando incidencias de ayer…');
  revisarAyer();
}, { timezone: 'Europe/Madrid' });

// Cada día a las 03:30 (hora de Madrid) limpia borradores PDFs corp. de +24 h
cron.schedule('30 3 * * *', () => {
  console.log('[cron] Limpiando borradores PDF caducados…');
  limpiarDrafts();               // 24 h por defecto
}, { timezone: 'Europe/Madrid' });

// Cada lunes a las 04:45 (hora de Madrid) elimina consentimientos generados
cron.schedule('45 4 * * 1', () => {
  console.log('[cron] Limpiando documentos de consentimientos…');
  cleanConsentimientos();
}, { timezone: 'Europe/Madrid' });

app.use((req, res, next) => {
  res.status(404).send('Página no encontrada');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});