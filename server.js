const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

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
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.split('?')[0];
  const baseFilename = path.basename(cleanUrl);

  // Directly serve uploaded documents from backend/uploads to prevent any 404
  if (cleanUrl.startsWith('/uploads') || cleanUrl.startsWith('/admin/app_') || baseFilename.startsWith('app_')) {
    const candidatePaths = [
      path.join(ROOT, 'backend', 'uploads', 'applications', baseFilename),
      path.join(ROOT, 'backend', decodeURIComponent(cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl)),
      path.join(ROOT, decodeURIComponent(cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl))
    ];

    for (const targetFile of candidatePaths) {
      if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
        const ext = path.extname(targetFile).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(targetFile).pipe(res);
        return;
      }
    }
  }

  // Proxy API, trips, applications, riders, users, auth, admin, and socket.io requests to backend server
  const isBackendRoute = 
    req.url.startsWith('/socket.io') ||
    req.url.startsWith('/ws') ||
    req.url.startsWith('/api/') || req.url === '/api' ||
    req.url.startsWith('/trips') ||
    req.url.startsWith('/applications') ||
    req.url.startsWith('/riders') ||
    req.url.startsWith('/passengers') ||
    req.url.startsWith('/users') ||
    req.url.startsWith('/auth') ||
    (req.url.startsWith('/admin/') && !req.url.match(/\.(html|js|css|png|jpg|jpeg|pdf|ico|svg|webmanifest)(\?.*)?$/i));

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

// Proxy WebSocket upgrade requests (Socket.io & WS) to backend server
server.on('upgrade', (req, clientSocket, head) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/ws')) {
    const serverSocket = net.connect(BACKEND_PORT, '127.0.0.1', () => {
      let rawRequest = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        rawRequest += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      }
      rawRequest += '\r\n';
      serverSocket.write(rawRequest);
      if (head && head.length) serverSocket.write(head);

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
      console.error(`[WS Upgrade Proxy Error] ${err.message}`);
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      serverSocket.destroy();
    });
  } else {
    clientSocket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`\n  K3K3 PWA Server running at:\n`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Open this URL in Chrome to test PWA install.\n`);
});
