// Servidor local simples para abrir o CRM em http://localhost:5173
// Uso: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    res.writeHead(400).end('Requisição inválida');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  const file = path.join(ROOT, path.normalize(pathname));
  const inside = file.startsWith(ROOT + path.sep);
  const hidden = pathname.split('/').some((part) => part.startsWith('.'));
  if (!inside || hidden || !TYPES[path.extname(file)]) {
    res.writeHead(404).end('Não encontrado');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Pulso CRM rodando em http://localhost:${PORT}`);
});
