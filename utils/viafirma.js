// utils/viafirma.js
const axios = require('axios');
const path = require('path');
const fs = require('fs');

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
// utils/viafirma.js
async function enviarConsentimiento(pdfUrl, paciente) {
  const body = {
    groupCode: process.env.VIAFIRMA_GROUP,
    title: `Consentimiento LOPD – ${paciente.nombre}`,
    callbackURL: `${process.env.SERVER_URL}/api/viafirma/callback`,
    callbackType: 'JSON',

    recipients: [
      { key: 'signer1', name: paciente.nombre, phone: paciente.phone, notificationType: 'SMS', presential: false }
    ],

    customization: {
      requestSmsBody: 'Hola {{recipient.name}}, revisa y firma tu consentimiento en el siguiente enlace:'
    },

    messages: [{
      document: {
        templateType: 'url',
        templateReference: pdfUrl
      },

      policies: [{
        evidences: [
          /* ───── Firma manuscrita ───── */
          {
            type: 'SIGNATURE',
            recipientKey: 'signer1',
            helpText: 'Firma del paciente',
            positions: [{
              rectangle: { x: 380, y: 580, width: 180, height: 80 }, // pág. 2
              page: 2
            }]
          },

          /* ───── IA  Acepto  (obligatoria) ───── */
          {
            type: 'GENERIC',
            recipientKey: 'signer1',
            optional: false,                       // ¡única obligatoria!
            helpText: 'IA – Acepto',
            metadataList: [
              { key: 'providerId', value: 'Check' },   // tipo checkbox  :contentReference[oaicite:0]{index=0}
              { key: 'text', value: 'ACEPTO que se usen mis datos ANOMIZADOS con IA' }
            ],
            positions: [{
              /* desplazada al área “F. Consentimiento…” */
              rectangle: { x: 49, y: 100, width: 14, height: 14 }, // pág. 1
              page: 1
            }]
          },

          /* ───── Información comercial (obligatoria) ───── */
          {
            type: 'GENERIC',
            recipientKey: 'signer1',
            optional: false,
            helpText: 'Info comercial',
            metadataList: [
              { key: 'providerId', value: 'Check' },
              { key: 'text', value: 'No deseo recibir información comercial' }
            ],
            positions: [{
              /* línea "[ ] NO DESEO RECIBIR…" */
              rectangle: { x: 49, y: 655, width: 14, height: 14 }, // pág. 1
              page: 2
            }]
          }
        ],

        signatures: [{
          type: 'SERVER',
          helpText: 'Sello electrónico Paris & Bea',
          typeFormatSign: 'PADES_T'
        }]
      }]
    }]
  };

  const { data } = await API.post('/set', body);
  return data.code;   // setCode de Viafirma
}

/**
 * Descarga el PDF firmado una vez completado.
 * @param {string} setCode respuesta del /set
 * @param {string} destino Ruta absoluta donde guardar el PDF
 */
async function descargarFirmado(setCode, destino) {
  // 1. Obtén los messageCodes del set
  const { data: summary } = await API.get(`/set/summary/${setCode}`);
  const messageCode = summary.messages?.[0]?.code;
  if (!messageCode) throw new Error('messageCode no encontrado');

  // 2. Pide enlace temporal
  const { data: dl } = await API.get(`/documents/download/signed/${messageCode}`);
  const pdfBin = await axios.get(dl.link, { responseType: 'arraybuffer' }); // <10 min
  fs.writeFileSync(destino, pdfBin.data);
}

module.exports = { enviarConsentimiento, descargarFirmado };
