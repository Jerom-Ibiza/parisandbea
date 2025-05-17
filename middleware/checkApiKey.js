// middleware/checkApiKey.js
function checkApiKey(req, res, next) {
  // Leer la API key de la cabecera 'x-api-key'
  const apiKey = req.header('x-api-key');
  
  // Comparar con la variable de entorno
  if (apiKey === process.env.API_KEY) {
    // Si coincide, continuar
    next();
  } else {
    // Si no coincide, responder con un error 401 (Unauthorized)
    return res.status(401).json({ error: 'No autorizado - API key incorrecta.' });
  }
}

module.exports = checkApiKey;
