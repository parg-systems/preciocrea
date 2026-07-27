#!/usr/bin/env node
/**
 * Genera preciocrea-portable.html: un único archivo HTML con todo el
 * código y assets inline. Para distribuir por WhatsApp/email/Drive
 * cuando no se puede usar el link público.
 *
 * Limitaciones del portable vs. versión servida en HTTPS:
 *   - NO funciona como PWA instalable (Service Worker requiere HTTPS).
 *   - No tiene auto-update vía banner; el usuario debe descargar de
 *     nuevo el archivo cuando cambies algo.
 *   - localStorage sí funciona normalmente.
 *
 * Uso:  node scripts/build-portable.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// El BOM (U+FEFF) se quita SIEMPRE al leer. Varios de estos archivos lo traen
// porque los guarda un editor de Windows, y ahí es inofensivo: al pedir un
// .css o un .js por HTTP el navegador lo descarta como parte de decodificar
// el archivo. Pero aquí el contenido se pega DENTRO del html, en medio del
// documento, y entonces ya no hay decodificación que valga: el carácter se
// queda como texto. Pegado al inicio de la hoja de estilos convierte el
// primer selector en "﻿ :root", que no matchea nada — y ese primer
// bloque es justamente el de las variables de color, así que la app entera
// pierde su paleta y aparece con los colores por defecto del navegador.
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '');
const readB64 = (rel) => fs.readFileSync(path.join(ROOT, rel)).toString('base64');

const html   = read('index.html');
const js     = read('js/app.js');
const studio = read('js/studio.js');
const icon   = `data:image/png;base64,${readB64('assets/icons/icon-192.png')}`;

// Las tipografías se sirven desde el proyecto, así que en el portable tienen
// que viajar dentro del archivo. Se convierten a data: URI aquí; la CSP declara
// `font-src 'self' data:` justamente para esto. Sin este paso el portable
// abriría con la fuente del sistema y perdería la identidad de la marca.
const css = read('css/styles.css').replace(
  /url\('\.\.\/assets\/fonts\/([\w.-]+)\.woff2'\)/g,
  (_, nombre) => `url('data:font/woff2;base64,${readB64(`assets/fonts/${nombre}.woff2`)}')`
);

// Sustituciones:
let out = html;

// IMPORTANTE: el reemplazo se pasa SIEMPRE como función, nunca como string.
// En String.replace un string de reemplazo interpreta $&, $', $` y $1 como
// patrones especiales, y nuestro código fuente está lleno de ellos: fmt() en
// app.js contiene  return '$' + ...  y esa secuencia $' se expandía al resto
// del documento, corrompiendo el archivo generado. Con una función, el valor
// devuelto se inserta literal.
const inline = (str) => () => str;

// 1) Reemplazar el <link rel="stylesheet" href="css/styles.css"> por <style>...</style>
out = out.replace(
  /<link\s+rel="stylesheet"\s+href="css\/styles\.css">/,
  inline(`<style>\n${css}\n</style>`)
);

// 2) Reemplazar <script src="js/app.js"></script> por <script>...</script>
//    En la versión portable quitamos el bloque del Service Worker
//    delimitado por // BUILD-PORTABLE-STRIP-START / END.
const jsNoSW = js.replace(
  /\/\/ BUILD-PORTABLE-STRIP-START[\s\S]*?\/\/ BUILD-PORTABLE-STRIP-END\n?/g,
  '// PWA Service Worker omitido en versión portable (requiere HTTPS).\n'
);
out = out.replace(
  /<script\s+src="js\/app\.js"><\/script>/,
  inline(`<script>\n${jsNoSW}\n</script>`)
);

// 2b) Reemplazar <script src="js/studio.js"></script> por <script>...</script>
//     Debe ir después de app.js: studio.js usa toast/esc/fmt en su init.
out = out.replace(
  /<script\s+src="js\/studio\.js"><\/script>/,
  inline(`<script>\n${studio}\n</script>`)
);

// 3) Reemplazar referencias a íconos y manifest por data URIs / inline
out = out.replace(/href="\.\/assets\/icons\/icon-192\.png"/g, `href="${icon}"`);

// 4) Quitar el link al manifest (no aplica en archivo único)
out = out.replace(/<link\s+rel="manifest"[^>]*>\s*\n?/g, '');

// 4b) Quitar los preload de fuentes: en el portable ya viajan dentro del
//     <style> como data: URI, y un preload apuntando a ./assets/fonts/ que no
//     existe es una descarga fallida en cada apertura.
out = out.replace(/<link\s+rel="preload"[^>]*assets\/fonts\/[^>]*>\s*\n?/g, '');

// 5) Comentario de cabecera para que el usuario sepa qué archivo es
const header = `<!--
  PrecioCrea — versión portable (archivo único)
  Generado: ${new Date().toISOString().slice(0,10)}
  Para PWA instalable visita la versión publicada.
-->\n`;
out = out.replace(/<!DOCTYPE html>/i, `<!DOCTYPE html>\n${header}`);

// 6) Guards: String.replace que no encuentra su patrón NO falla, simplemente
//    deja la referencia externa intacta. En el portable eso significa una
//    hoja de estilos o un script que nunca cargan, y el archivo se ve bien
//    hasta que alguien lo abre sin el proyecto al lado. Fallar aquí, ruidoso.
const leftovers = [];
if (/<link\s+rel="stylesheet"\s+href="css\//.test(out)) leftovers.push('css/styles.css');
const scriptRefs = out.match(/<script\s+src="js\/[^"]+"><\/script>/g);
if (scriptRefs) leftovers.push(...scriptRefs.map(s => s.match(/js\/[^"]+/)[0]));
// Cualquier ruta a assets/fonts/ que sobreviva significa una tipografía que el
// portable pediría al disco y no encontraría.
const fontRefs = out.match(/assets\/fonts\/[\w.-]+/g);
if (fontRefs) leftovers.push(...new Set(fontRefs));
// Y ningún origen externo, que es lo que este build vino a eliminar.
const externos = out.match(/(?:href|src)="https?:\/\/(?!viviloaiza\.cl|instagram\.com|open\.spotify\.com|wa\.me)[^"]+"/g);
if (externos) leftovers.push(...new Set(externos));
if (leftovers.length) {
  console.error('❌ build-portable: no se inlinearon estos archivos:');
  leftovers.forEach(f => console.error(`   - ${f}`));
  console.error('   Revisa que las regex de sustitución coincidan con index.html.');
  process.exit(1);
}

// 7) Ningún carácter invisible de formato dentro del documento.
//    El caso real fue un BOM (U+FEFF): en un .css servido aparte el navegador
//    lo descarta al decodificar, pero pegado dentro del <style> se queda como
//    texto y el parser de CSS lo lee como el principio de un selector. Se
//    tragó el comentario de cabecera y convirtió la primera regla en
//    "﻿ :root", que no matchea nada — justo el bloque de las variables de
//    color, así que la app salió sin paleta. Y se generó sin avisar: el fallo
//    solo se veía al abrir el archivo.
//    El resto de la familia (zero-width space, joiners, word-joiner) es igual
//    de invisible y rompería igual, así que entran todos en el mismo guard.
const invisibles = /[﻿​-‏⁠]/.exec(out);
if (invisibles) {
  const at = invisibles.index;
  const code = out.charCodeAt(at).toString(16).toUpperCase().padStart(4, '0');
  console.error(`❌ build-portable: carácter invisible U+${code} en la posición ${at} del documento.`);
  console.error(`   Contexto: ${JSON.stringify(out.slice(Math.max(0, at - 40), at + 40))}`);
  console.error('   Dentro del html no es codificación, es texto: rompe la regla que lo sigue.');
  console.error('   Revisa que read() siga limpiando cada archivo fuente.');
  process.exit(1);
}

const outPath = path.join(ROOT, 'preciocrea-portable.html');
fs.writeFileSync(outPath, out, 'utf8');

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`✅ preciocrea-portable.html generado (${sizeKb} KB)`);
console.log(`   Distribúyelo por WhatsApp/Drive/email a quien no abra el link.`);
