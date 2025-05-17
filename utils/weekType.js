// Devuelve 'A' si la semana ISO es par, 'B' si es impar
function getWeekType(date = new Date()) {
  // Algoritmo ISO 8601 (todo en UTC para evitar sorpresas)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return week % 2 === 0 ? 'A' : 'B';
}

module.exports = { getWeekType };