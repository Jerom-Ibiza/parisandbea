const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        const buffer = await fs.promises.readFile(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
    }
    if (ext === '.docx') {
        const { value } = await mammoth.extractRawText({ path: filePath });
        return value || '';
    }
    if (ext === '.xls' || ext === '.xlsx') {
        const wb = xlsx.readFile(filePath);
        let text = '';
        for (const name of wb.SheetNames) {
            const sheet = wb.Sheets[name];
            text += xlsx.utils.sheet_to_csv(sheet);
        }
        return text;
    }
    // unsupported type: return empty string
    return '';
}

module.exports = extractText;