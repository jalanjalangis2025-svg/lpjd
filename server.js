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

// Extract coordinates from a URL string using multiple patterns
function extractCoordsFromUrl(url) {
  const patterns = [
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /place\/.*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /query=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /search\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /daddr=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /maps\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return { lat: m[1], lng: m[2] };
  }
  return null;
}

// Follow redirects AND read body for coordinates if no redirect found (max 8 hops)
function resolveRedirect(url, hops, callback) {
  if (hops > 8) return callback(null, url);

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    }
  };

  // Choose http or https module based on URL
  const requester = url.startsWith('https') ? https : http;

  const req = requester.get(url, options, (response) => {
    // Follow HTTP redirect
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      let nextUrl = response.headers.location;
      // Handle relative redirects
      if (nextUrl.startsWith('/')) {
        const base = new URL(url);
        nextUrl = `${base.protocol}//${base.host}${nextUrl}`;
      }
      response.resume();
      resolveRedirect(nextUrl, hops + 1, callback);
      return;
    }

    // Try to extract coords from the redirect destination URL itself
    const coords = extractCoordsFromUrl(url);
    if (coords) {
      response.resume();
      callback(null, url, coords);
      return;
    }

    // Read body to extract coords from HTML (for Google Maps app links)
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; if (body.length > 80000) response.destroy(); });
    response.on('end', () => {
      // 1. Look for canonical URL or og:url in meta tags
      const canonicalMatch = body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || body.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)
        || body.match(/<meta[^>]+name=["']twitter:url["'][^>]+content=["']([^"']+)["']/i);

      if (canonicalMatch && canonicalMatch[1]) {
        const canonicalUrl = canonicalMatch[1].replace(/&amp;/g, '&');
        const c = extractCoordsFromUrl(canonicalUrl);
        if (c) return callback(null, canonicalUrl, c);
        // Try to follow canonical URL
        if (canonicalUrl.includes('google.com/maps')) {
          return resolveRedirect(canonicalUrl, hops + 1, callback);
        }
      }

      // 2. Search for coordinate patterns directly in HTML body
      const bodyCoordPatterns = [
        /"(-?\d{1,3}\.\d{4,})",(-?\d{1,3}\.\d{4,})/,
        /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /@(-?\d+\.\d+),(-?\d+\.\d+),\d+z/,
        /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/, // Common pattern in Google Maps JSON
      ];

      for (const pattern of bodyCoordPatterns) {
        const m = body.match(pattern);
        if (m && m[1] && m[2]) {
          const lat = parseFloat(m[1]);
          const lng = parseFloat(m[2]);
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return callback(null, url, { lat: String(lat), lng: String(lng) });
          }
        }
      }

      // 3. Look for redirect URLs in JavaScript or meta refresh
      const jsUrlMatch = body.match(/window\.location\s*=\s*["'](https:\/\/?[^"']+)["']/)
        || body.match(/href=["'](https:\/\/[^\/]*google\.com\/maps[^"']+)["']/i)
        || body.match(/content=["']\d+;\s*url=([^"']+)["']/i);
        
      if (jsUrlMatch && jsUrlMatch[1]) {
        let jsUrl = jsUrlMatch[1].replace(/&amp;/g, '&');
        if (jsUrl.startsWith('/')) {
            const base = new URL(url);
            jsUrl = `${base.protocol}//${base.host}${jsUrl}`;
        }
        const c = extractCoordsFromUrl(jsUrl);
        if (c) return callback(null, jsUrl, c);
        return resolveRedirect(jsUrl, hops + 1, callback);
      }

      callback(null, url);
    });
    response.on('error', () => callback(null, url));
  });

  req.on('error', (e) => callback(e, url));
  req.setTimeout(4000, () => { req.destroy(); callback(null, url); });
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

    resolveRedirect(targetUrl, 0, (err, finalUrl, coords) => {
      res.writeHead(200);
      res.end(JSON.stringify({ finalUrl: finalUrl, lat: coords?.lat || null, lng: coords?.lng || null }));
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
