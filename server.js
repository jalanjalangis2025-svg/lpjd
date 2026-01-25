const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let filePath = '.' + req.url;
  
  // Default to index.html for root
  if (filePath === './') {
    filePath = './index.html';
  }

  // Force clean URLs: redirect .html to extensionless
  if (req.url.endsWith('.html')) {
    const cleanUrl = req.url.slice(0, -5);
    res.writeHead(301, { 'Location': cleanUrl });
    res.end();
    return;
  }

  // Rewrite logic: if extension is missing, try adding .html
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  if (!extname) {
    if (fs.existsSync(filePath + '.html')) {
        filePath += '.html';
        contentType = MIME_TYPES['.html'];
    }
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT'){
        // Just show 404 for now, can be improved to show a custom 404 page
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end("<h1>404 Not Found</h1><p>The requested file could not be found.</p>", 'utf-8');
      }
      else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
      }
    }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });

}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Try accessing: http://localhost:${PORT}/login`);
});
