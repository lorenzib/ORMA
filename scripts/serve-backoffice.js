#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.ORMA_BACKOFFICE_PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'backoffice-review.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if(target !== root && !target.startsWith(`${root}${path.sep}`)){
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(target, (statError, stat) => {
    if(statError || !stat.isFile()){
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('Content-Type', types[path.extname(target).toLowerCase()] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(target).pipe(response);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[backoffice] Review UI: http://127.0.0.1:${port}/backoffice-review.html`);
  console.log('[backoffice] Localhost only. Press Ctrl+C to stop.');
});
