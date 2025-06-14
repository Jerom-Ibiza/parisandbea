const pool = require('../database');
const fs = require('fs');
const path = require('path');

// GET /api/home -> Devuelve el registro con id_home=1
const getHomeData = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM home WHERE id_home = 1');
    const homeData = rows[0];
    if (!homeData) {
      return res.status(404).json({ error: 'No se encontraron datos en la tabla home.' });
    }
    res.json(homeData);
  } catch (error) {
    console.error('Error al obtener datos de la tabla home:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// GET /api/home/allimages -> Lista de imágenes del directorio /images
const getAllServerImages = async (req, res) => {
  try {
    // Cambia esta ruta según dónde guardes tus imágenes
    const imagesDir = path.join(__dirname, '..', 'images');

    fs.readdir(imagesDir, (err, files) => {
      if (err) {
        console.error('Error al leer el directorio de imágenes:', err);
        return res.status(500).json({ error: 'Error interno al leer las imágenes del servidor.' });
      }
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
      });
      // Ajusta esta URL base a tu dominio real
      const baseUrl = 'https://parisandbea.es/images/';
      const images = imageFiles.map(file => baseUrl + file);
      res.json({ images });
    });
  } catch (error) {
    console.error('Error en getAllServerImages:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// PUT /api/home -> Actualiza campos en el registro id_home=1
const updateHomeData = async (req, res) => {
  try {
    const data = req.body;
    // data es un objeto con los campos que quieres actualizar
    await pool.query('UPDATE home SET ? WHERE id_home = 1', data);
    res.json({ message: 'Datos actualizados correctamente.' });
  } catch (error) {
    console.error('Error al actualizar datos de la tabla home:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const TIMEZONE = 'Europe/Madrid';

// GET /api/home/datetime -> Devuelve fecha y hora actuales
const getCurrentDateTime = async (req, res) => {
  try {
    const now = dayjs().tz(TIMEZONE);
    res.json({ currentDateTime: now.format() });
  } catch (error) {
    console.error('Error al obtener la fecha y hora actuales:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// GET /api/home/empresa -> Devuelve la información de la Empresa (tabla Empresa, id = 1)
const getEmpresaData = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT informacion FROM Empresa WHERE id = 1');
    const empresaData = rows[0];
    if (!empresaData) {
      return res.status(404).json({ error: 'No se encontraron datos en la tabla Empresa.' });
    }
    res.json(empresaData);
  } catch (error) {
    console.error('Error al obtener datos de la tabla Empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// PUT /api/home/empresa -> Actualiza la información de la Empresa (tabla Empresa, id = 1)
const updateEmpresaData = async (req, res) => {
  try {
    const { informacion } = req.body;
    if (typeof informacion !== 'string') {
      return res.status(400).json({ error: 'El campo "informacion" es requerido y debe ser de tipo string.' });
    }
    // Usamos binding directo del valor en lugar del objeto
    const [result] = await pool.query('UPDATE Empresa SET informacion = ? WHERE id = 1', [informacion]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró la empresa para actualizar.' });
    }
    res.json({ message: 'Información de la empresa actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar datos de la tabla Empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getHomeData,
  getAllServerImages,
  updateHomeData,
  getCurrentDateTime,
  getEmpresaData,
  updateEmpresaData
};
