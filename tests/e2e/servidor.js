// Servidor estático mínimo para los tests de navegador.
//
// Hace falta porque un service worker NO se registra desde file://: exige un
// origen seguro, y http://localhost cuenta como tal. Sin esto no se puede
// probar ni el precacheo, ni el modo sin conexión, ni la instalación.
//
// Sin dependencias a propósito: son 60 líneas de node:http contra las de un
// paquete más en el árbol. También sirve para levantar el sitio a mano cuando
// se está depurando (`node tests/e2e/servidor.js`).
//
// Imita a GitHub Pages en lo que importa: `Cache-Control: max-age=600` en todo,
// que es lo que de verdad sirve el hosting y no se puede configurar. Así el
// test del network-first mide lo mismo que ocurre en producción.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

function crearServidor() {
  return http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';

    // Nadie sale de la raíz del proyecto, ni con ../ ni con rutas absolutas.
    const destino = path.join(RAIZ, path.normalize(rel).replace(/^([\\/])+/, ''));
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('fuera de la raíz');
      return;
    }

    fs.readFile(destino, (err, datos) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('no encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
        // Lo mismo que sirve GitHub Pages, para bien y para mal.
        'Cache-Control': 'max-age=600'
      });
      res.end(datos);
    });
  });
}

function levantar(puerto = 0) {
  return new Promise(resolver => {
    const servidor = crearServidor();
    servidor.listen(puerto, '127.0.0.1', () => {
      resolver({ servidor, puerto: servidor.address().port });
    });
  });
}

module.exports = { crearServidor, levantar, RAIZ };

// Ejecutado directamente: servidor de depuración en un puerto fijo.
if (require.main === module) {
  const puerto = Number(process.argv[2]) || 4173;
  crearServidor().listen(puerto, '127.0.0.1', () => {
    console.log(`PrecioCrea en http://127.0.0.1:${puerto}/`);
  });
}
