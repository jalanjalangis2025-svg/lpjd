const http = require('http');
const fs = require('fs');
const path = require('path');

<<<<<<< HEAD
const PORT = 3001;
=======
const PORT = 3000;
>>>>>>> 356d8c2c9feb156d48787d2949de9f90ad9791a3
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
<<<<<<< HEAD
  // Strip query string
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];
  const search = urlParts[1] ? '?' + urlParts[1] : '';

  let filePath = '.' + pathname;

  // Default to index.html for root
  if (pathname === '/') {
=======
  let filePath = '.' + req.url;
  
  // Default to index.html for root
  if (filePath === './') {
>>>>>>> 356d8c2c9feb156d48787d2949de9f90ad9791a3
    filePath = './index.html';
  }

  // Force clean URLs: redirect .html to extensionless
<<<<<<< HEAD
  if (pathname.endsWith('.html') && pathname !== '/index.html') {
    const cleanPath = pathname.slice(0, -5);
    res.writeHead(301, { 'Location': cleanPath + search });
=======
  if (req.url.endsWith('.html')) {
    const cleanUrl = req.url.slice(0, -5);
    res.writeHead(301, { 'Location': cleanUrl });
>>>>>>> 356d8c2c9feb156d48787d2949de9f90ad9791a3
    res.end();
    return;
  }

  // Rewrite logic: if extension is missing, try adding .html
<<<<<<< HEAD
  let extname = path.extname(filePath);
=======
  const extname = path.extname(filePath);
>>>>>>> 356d8c2c9feb156d48787d2949de9f90ad9791a3
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  if (!extname) {
    if (fs.existsSync(filePath + '.html')) {
<<<<<<< HEAD
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
      if (error.code == 'ENOENT') {
        console.error(`404: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end("<h1>404 Not Found</h1><p>The requested file could not be found: " + pathname + "</p>", 'utf-8');
      }
      else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
=======
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
>>>>>>> 356d8c2c9feb156d48787d2949de9f90ad9791a3
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
