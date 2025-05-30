const fs = require('fs');
const path = require('path');
const pool = require('../database');
const { descargarFirmado } = require('../utils/viafirma');

exports.handle = async (req, res) => {
    try {
        // Viafirma puede mandar ?set=«json» o el JSON directo
        const payload = req.body.set ? JSON.parse(req.body.set) : req.body;
        const { code: setCode, status } = payload;

        /* mapeamos a nuestros valores */
        let dbEstado = null;
        switch (status) {
            case 'RESPONSED': dbEstado = 'firmado'; break;
            case 'REJECTED': dbEstado = 'pendiente'; break;   // o crea 'rechazado'
            default: dbEstado = 'pendiente';
        }

        // 1. Anota el nuevo estado en la BD
        await pool.query(
            'UPDATE pacientes SET lopd_estado=? WHERE lopd_setcode=?',
            [dbEstado, setCode]
        );

        // 2. Si está firmado, descarga y guarda el PDF
        if (status === 'RESPONSED') {
            const destino = path.join(
                __dirname, '..', 'documentos', 'consentimientos_firmados',
                `${setCode}.pdf`
            );
            await descargarFirmado(setCode, destino);      // implementado en utils/viafirma.js
            await pool.query(
                'UPDATE pacientes SET lopd_firmado=NOW() WHERE lopd_setcode=?',
                [setCode]
            );
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('[callback Viafirma]', e);
        res.status(500).json({ error: 'callback error' });
    }
};
