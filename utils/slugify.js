module.exports = str =>
  str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // sin acentos
     .replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-')
     .replace(/^-|-$/g,'').toLowerCase();
