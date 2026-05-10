const https = require('https');
const http = require('http');

// Extract coordinates from a URL string using multiple patterns
function extractCoordsFromUrl(url) {
  const patterns = [
    /[?&]q=(-?[\d.]+),(-?[\d.]+)/,
    /@(-?[\d.]+),(-?[\d.]+)/,
    /!3d(-?[\d.]+)!4d(-?[\d.]+)/,
    /place\/.*\/@(-?[\d.]+),(-?[\d.]+)/,
    /[?&]ll=(-?[\d.]+),(-?[\d.]+)/,
    /[?&]query=(-?[\d.]+),(-?[\d.]+)/,
    /search\/(-?[\d.]+),(-?[\d.]+)/,
    /[?&]center=(-?[\d.]+),(-?[\d.]+)/,
    /[?&]daddr=(-?[\d.]+),(-?[\d.]+)/,
    /[?&]destination=(-?[\d.]+),(-?[\d.]+)/,
    /maps\/(-?[\d.]+),(-?[\d.]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat: String(lat), lng: String(lng) };
      }
    }
  }
  return null;
}

function followRedirects(url, hops, callback) {
  if (hops > 8) return callback(null, url);

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    }
  };

  const requester = url.startsWith('https') ? https : http;
  const req = requester.get(url, options, (response) => {
    // Follow HTTP redirects
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      let nextUrl = response.headers.location;
      if (nextUrl.startsWith('/')) {
        try {
          const base = new URL(url);
          nextUrl = `${base.protocol}//${base.host}${nextUrl}`;
        } catch(e) {}
      }
      response.resume();
      followRedirects(nextUrl, hops + 1, callback);
      return;
    }

    // Check if the final URL already contains coords
    const coords = extractCoordsFromUrl(url);
    if (coords) {
      response.resume();
      return callback(null, url, coords);
    }

    // Read body to find coords in HTML (Google Maps app short links often land here)
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) response.destroy();
    });
    response.on('end', () => {
      // 1. Look for canonical / og:url meta tags
      const canonicalMatch =
        body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
        body.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
        body.match(/<meta[^>]+name=["']twitter:url["'][^>]+content=["']([^"']+)["']/i);

      if (canonicalMatch && canonicalMatch[1]) {
        const canonicalUrl = canonicalMatch[1].replace(/&amp;/g, '&');
        const c = extractCoordsFromUrl(canonicalUrl);
        if (c) return callback(null, canonicalUrl, c);
        if (canonicalUrl.includes('google.com/maps')) {
          return followRedirects(canonicalUrl, hops + 1, callback);
        }
      }

      // 2. Search for coordinate patterns directly in HTML body
      const bodyCoordPatterns = [
        /!3d(-?[\d.]+)!4d(-?[\d.]+)/,
        /@(-?[\d.]+),(-?[\d.]+),\d+z/,
        /[?&]q=(-?[\d.]+),(-?[\d.]+)/,
        /maps\/place\/[^/]+\/@(-?[\d.]+),(-?[\d.]+)/,
        /center=(-?[\d.]+)%2C(-?[\d.]+)/,
        /[?&]ll=(-?[\d.]+),(-?[\d.]+)/,
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

      // 3. Look for Google Maps URLs embedded in JS
      const jsUrlMatch =
        body.match(/href=["'](https:\/\/[^\/]*google\.com\/maps[^"']+)["']/i);
      if (jsUrlMatch && jsUrlMatch[1]) {
        const jsUrl = jsUrlMatch[1].replace(/&amp;/g, '&');
        const c = extractCoordsFromUrl(jsUrl);
        if (c) return callback(null, jsUrl, c);
        return followRedirects(jsUrl, hops + 1, callback);
      }

      callback(null, url);
    });
    response.on('error', () => callback(null, url));
  });

  req.on('error', (e) => callback(e, url));
  req.setTimeout(10000, () => { req.destroy(); callback(null, url); });
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL missing' });
  }

  followRedirects(url, 0, (err, finalUrl, coords) => {
    res.status(200).json({
      finalUrl: finalUrl,
      lat: coords?.lat || null,
      lng: coords?.lng || null
    });
  });
}
