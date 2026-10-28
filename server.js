const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces so other devices on Wi-Fi/Hotspot can access
const PUBLIC_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Pick IPv4 and non-internal (skip 127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, ip: net.address });
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // API Endpoint to get local network IP address dynamically
  if (req.url === '/api/server-info') {
    const localIPs = getLocalIPs();
    const primaryIP = localIPs.find(item => item.interface.toLowerCase().includes('wi-fi') || item.interface.toLowerCase().includes('wireless')) || localIPs[0];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      port: PORT,
      localIPs: localIPs,
      primaryIP: primaryIP ? primaryIP.ip : 'localhost',
      url: `http://${primaryIP ? primaryIP.ip : 'localhost'}:${PORT}`
    }));
    return;
  }

  let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${safePath}`);
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr) => {
        if (!indexErr) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('403 Directory Listing Denied');
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    stream.pipe(res);
  });
  stream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Server Error');
  });
}

server.listen(PORT, HOST, () => {
  const localIPs = getLocalIPs();
  console.log(`====================================================`);
  console.log(`🎮 LAST ZONE BRAWLS - Local & LAN Server Running!`);
  console.log(`💻 Di laptop/PC ini : http://localhost:${PORT}`);
  if (localIPs.length > 0) {
    console.log(`📱 Di HP / Device lain (WiFi / Hotspot yang sama):`);
    localIPs.forEach(item => {
      console.log(`   👉 http://${item.ip}:${PORT}  [${item.interface}]`);
    });
  } else {
    console.log(`📱 Di Device lain: Pastikan terhubung ke Wi-Fi / Hotspot`);
  }
  console.log(`📁 Directory: ${PUBLIC_DIR}`);
  console.log(`====================================================`);
});
