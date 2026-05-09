const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

// Follow redirects recursively (max 5 hops)
function resolveRedirect(url, hops, callback) {
  if (hops > 5) return callback(null, url);

  const options = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  };

  https.get(url, options, (response) => {
    response.resume(); // drain body
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      resolveRedirect(response.headers.location, hops + 1, callback);
    } else {
      callback(null, url);
    }
  }).on('error', (e) => {
    callback(e, url);
  });
}

http.createServer((req, res) => {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];
  const queryString = urlParts[1] || '';
  const search = queryString ? '?' + queryString : '';

  // ==============================
  // API: Resolve short links
  // ==============================
  if (pathname === '/api/resolve') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = new URLSearchParams(queryString).get('url');
    if (!targetUrl) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'url parameter is required' }));
      return;
    }

    resolveRedirect(targetUrl, 0, (err, finalUrl) => {
      res.writeHead(200);
      res.end(JSON.stringify({ finalUrl: finalUrl }));
    });

    return; // Stop here — do NOT fall through to file serving
  }

  // ==============================
  // File Serving
  // ==============================
  let filePath = '.' + decodeURIComponent(pathname);

  // Default to index.html for root
  if (pathname === '/') {
    filePath = './index.html';
  }

  // Force clean URLs: redirect .html to extensionless
  if (pathname.endsWith('.html') && pathname !== '/index.html') {
    const cleanPath = pathname.slice(0, -5);
    res.writeHead(301, { 'Location': cleanPath + search });
    res.end();
    return;
  }

  // Rewrite logic: if extension is missing, try adding .html
  let extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  if (!extname) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
      contentType = MIME_TYPES['.html'];
    } else if (fs.existsSync(filePath + '/index.html')) {
      filePath += '/index.html';
      contentType = MIME_TYPES['.html'];
    }
  }

  console.log(`${req.method} ${req.url} -> ${filePath}`);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.error(`404: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 Not Found</h1><p>File not found: ${pathname}</p>`, 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });

}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`API resolve: http://localhost:${PORT}/api/resolve?url=<encoded_url>`);
});
