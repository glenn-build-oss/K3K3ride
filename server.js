const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const BACKEND_PORT = process.env.BACKEND_PORT || 8810;
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
  // Proxy API, trips, applications, riders, and admin non-static requests to backend server
  const isBackendRoute = 
    req.url.startsWith('/api/') || req.url === '/api' ||
    req.url.startsWith('/trips') ||
    req.url.startsWith('/applications') ||
    req.url.startsWith('/riders') ||
    req.url.startsWith('/passengers') ||
    req.url.startsWith('/uploads') ||
    (req.url.startsWith('/admin/') && !req.url.match(/\.(html|js|css|png|jpg|ico|svg|webmanifest)(\?.*)?$/i));

  if (isBackendRoute) {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${BACKEND_PORT}`,
      },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy Error] ${req.method} ${req.url} → ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Backend API server unavailable on port ${BACKEND_PORT}: ${err.message}` }));
    });

    req.pipe(proxyReq);
    return;
  }

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
