/* Servidor local para testar a PWA: node serve.js  → http://127.0.0.1:4174 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.env.PORT) || 4174;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.sql': 'text/plain; charset=utf-8'
};
http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  if (!name || name === '/') name = 'index.html';
  const file = path.join(root, name);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('Açaí ERP em http://127.0.0.1:' + port));
