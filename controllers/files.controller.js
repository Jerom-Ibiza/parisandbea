const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pool = require('../database');

// Directorios permitidos (con subcarpetas incluidas)
const allowedFolders = [
  'attachments_mail',
  'attachments_whatsapp',
  'documentos',
  'documentos/consentimientos',
  'documentos/consentimientos_firmados',
  'images',
  'images/recursos',
  'images/servicios',
  'images/profesionales',
  'images/productos',
  'images/muscles',
  'tmp',
  'attachments_consulta'
];

exports.listFiles = async (req, res) => {
  try {
    const folder = req.params.folder;              // ej. "attachments_consulta"

    if (!allowedFolders.includes(folder))
      return res.status(400).json({ error: 'Carpeta no permitida' });

    /* ───────────── 1)  TODAS LAS CARPETAS NORMALES ───────────── */
    if (folder !== 'attachments_consulta') {
      const folderPath = path.join(__dirname, '..', folder);
      const items = await fs.promises.readdir(folderPath);
      const files = (await Promise.all(
        items.map(async it => {
          const stats = await fs.promises.stat(path.join(folderPath, it));
          return stats.isFile() ? it : null;
        })
      )).filter(Boolean);
      return res.json({ files });
    }

    /* ───────────── 2)  CASO ESPECIAL: adjuntos_consulta ───────────── */
    const [rows] = await pool.query(`
      SELECT pf.filename, pf.filepath, pf.id_paciente,
             CONCAT(p.nombre,' ',p.apellidos)  AS paciente
        FROM patient_files pf
        JOIN pacientes p USING (id_paciente)
      ORDER BY pf.uploaded_at DESC
    `);

    /* Devolvemos objeto extendido */
    const files = rows.map(r => ({
      filename: r.filename,
      paciente: r.paciente,
      id_paciente: r.id_paciente,
      filepath: r.filepath            // nos sirve para DELETE múltiple
    }));
    res.json({ files });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer la carpeta' });
  }
};

exports.uploadFiles = async (req, res) => {
  const folder = req.params.folder;           // ej.: images/profesionales

  /* ───────── carpetas con tratamiento de imagen ───────── */
  const imageFolders = {
    'images/servicios': { size: 1200 },
    'images/profesionales': { size: 300 },
    'images/productos': { size: 900 }
  };

  if (imageFolders[folder]) {
    if (!req.files?.length)
      return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const { size } = imageFolders[folder];
    const outFiles = [];

    try {
      for (const file of req.files) {
        /* 1) validar */
        if (!/^image\//.test(file.mimetype)) {
          await fs.promises.unlink(file.path);
          throw new Error(`“${file.originalname}” no es una imagen`);
        }

        /* 2) salida .webp */
        const base = path.parse(file.filename).name;
        const outName = `${base}.webp`;
        const outPath = path.join(path.dirname(file.path), outName);

        /* 3) convertir + redimensionar */
        await sharp(file.path)
          .resize(size, size, { fit: 'cover' })
          .toFormat('webp')
          .toFile(outPath);

        /* 4) borrar original */
        await fs.promises.unlink(file.path);

        outFiles.push(outName);
      }

      return res.json({
        message: `Imágenes convertidas a ${size}×${size} webp`,
        files: outFiles
      });

    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al procesar imágenes' });
    }
  }

  /* ───────── resto de carpetas ───────── */
  return res.json({
    message: 'Archivos subidos correctamente',
    files: req.files?.map(f => f.filename) || []
  });
};


exports.renameFile = (req, res) => {
  const folder = req.params.folder; // p.ej. 'images/servicios'
  if (!allowedFolders.includes(folder)) {
    return res.status(400).json({ error: 'Carpeta no permitida' });
  }

  const { oldName, newName } = req.body;
  if (!oldName || !newName) {
    return res.status(400).json({ error: 'Se requiere oldName y newName' });
  }

  const folderPath = path.join(__dirname, '..', folder);
  const oldPath = path.join(folderPath, oldName);
  const newPath = path.join(folderPath, newName);

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al renombrar el archivo' });
    }
    return res.json({ message: 'Archivo renombrado correctamente' });
  });
};

exports.deleteFile = async (req, res) => {
  const { folder, filename } = req.params;

  if (!allowedFolders.includes(folder))
    return res.status(400).json({ error: 'Carpeta no permitida' });

  if (!filename)
    return res.status(400).json({ error: 'Falta filename' });

  try {
    /* 1. borrar ficheros (ignorar faltantes) */
    await Promise.all(files.map(async f => {
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err; // ignora si no existe
      }
    }));

    /* 2. si es attachments_consulta -> borrar fila en BD */
    if (folder === 'attachments_consulta') {
      const relPath = path.posix.join(folder, filename);
      try {
        await pool.query(
          'DELETE FROM patient_files WHERE filepath = ? LIMIT 1',
          [relPath]
        );
      } catch (dbErr) {
        console.error('[deleteFile DB]', dbErr);
      }
    }

    res.json({ message: 'Archivo eliminado correctamente' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el archivo' });
  }
};

exports.deleteMultipleFiles = async (req, res) => {
  const folder = req.params.folder;
  const { files = [] } = req.body;

  if (!allowedFolders.includes(folder))
    return res.status(400).json({ error: 'Carpeta no permitida' });

  if (!files.length)
    return res.status(400).json({ error: 'Array "files" vacío' });

  try {
    /* 1. borrar ficheros y registros uno a uno */
    for (const f of files) {
      try {
        await fs.promises.unlink(path.join(__dirname, '..', folder, f));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      if (folder === 'attachments_consulta') {
        const rel = path.posix.join(folder, f);
        try {
          await pool.query(
            'DELETE FROM patient_files WHERE filepath = ? LIMIT 1',
            [rel]
          );
        } catch (dbErr) {
          console.error('[deleteMultipleFiles DB]', dbErr);
        }
      }
    }

    res.json({ message: 'Archivos eliminados correctamente' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar uno o más archivos' });
  }
};