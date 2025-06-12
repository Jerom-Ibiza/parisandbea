module.exports = (req, res, next) => {
    const apiKey = req.header('x-api-key');
    if (apiKey && apiKey === process.env.API_KEY) return next();
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'No autorizado' });
};