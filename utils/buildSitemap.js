const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const baseUrl = 'https://parisandbea.es';

const excluded = [
    'consulta.html',
    'inicio-consulta.html',
    'kiosk.html',
    'pab-files.html',
    'pab-login.html',
    'pab-pac.html',
    'pab-pros.html'
];

const files = fs.readdirSync(publicDir)
    .filter(f => f.endsWith('.html') && !excluded.includes(f))
    .sort();

if (files.includes('index.html')) {
    files.splice(files.indexOf('index.html'), 1);
    files.unshift('index.html');
}

const urls = files.map(file => {
    const loc = file === 'index.html' ? '/' : `/${file}`;
    return `  <url>\n    <loc>${baseUrl}${loc}</loc>\n  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') +
    '\n</urlset>\n';

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
console.log(`Sitemap generated with ${urls.length} entries.`);