// utils/viafirma.js
const axios = require('axios');
const path  = require('path');
const fs    = require('fs');

const API = axios.create({
  baseURL: process.env.VIAFIRMA_BASE,
  auth: {
    username: process.env.VIAFIRMA_USER,
    password: process.env.VIAFIRMA_PASS
  },
  headers: { 'Content-Type': 'application/json' }
});

/**
 * Lanza a Viafirma un PDF ya alojado en tu servidor y devuelve el setCode.
 * @param {string} pdfUrl  URL pública del PDF (ej. https://parisandbea.es/...)
 * @param {object} paciente { nombre, mail }
 */
async function enviarConsentimiento(pdfUrl, paciente) {
  const body = {
    groupCode: process.env.VIAFIRMA_GROUP,
    title: `Consentimiento LOPD – ${paciente.nombre}`,
    recipients: [
      { key: 'signer1', name: paciente.nombre, mail: paciente.mail, presential: false }
    ],
    customization: {
      requestMailSubject: 'Consentimiento pendiente de firma',
      requestMailBody: `Hola {{recipient.name}},<br>Por favor revisa y firma tu consentimiento.`
    },
    messages: [{
      document: {
        templateType: 'url',
        templateReference: pdfUrl
      },
      policies: [{
        evidences: [{
          type: 'SIGNATURE',
          recipientKey: 'signer1',
          helpText: 'Firma del paciente',
          positions: [{
            rectangle: { x: 350, y: 110, width: 180, height: 80 }, // ↓ Ajusta coordenadas ↓
            page: 1
          }]
        }],
        signatures: [{
          type: 'SERVER',
          helpText: 'Sello electrónico Paris & Bea',
          typeFormatSign: 'PADES_T'
        }]
      }]
    }]
  };

  const { data } = await API.post('/set', body);
  return data.code;                    // setCode
}

/**
 * Descarga el PDF firmado una vez completado.
 * @param {string} setCode respuesta del /set
 * @param {string} destino Ruta absoluta donde guardar el PDF
 */
async function descargarFirmado(setCode, destino) {
  const url = `/messages/${setCode}/document?content=SIGNED`;
  const { data } = await API.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(destino, data);
}

module.exports = { enviarConsentimiento, descargarFirmado };
