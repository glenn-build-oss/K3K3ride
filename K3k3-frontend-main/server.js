const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(ROOT, decodeURIComponent(url));

  // Serve manifest.json with the correct MIME type for PWA
  if (url === '/manifest.json') {
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  K3K3 PWA Server running at:\n`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Open this URL in Chrome to test PWA install.\n`);
});
