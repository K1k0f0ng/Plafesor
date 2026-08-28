'use strict';
// Inyecta la identidad de la institución (nombre, colores, logo, favicon) en la
// plantilla antes de compilar el frontend (npm run build).
//
// Uso: desde la raíz de esta plantilla (PLAYFESOR_TEMPLATE/):
//   node scripts/aplicar-marca.js [carpeta-con-logos]
//
// - Lee frontend/.env.production para tomar REACT_APP_NOMBRE_INSTITUCION y
//   REACT_APP_COLOR_PRIMARIO, y reemplaza los tokens __NOMBRE_INSTITUCION__ y
//   __COLOR_PRIMARIO__ en frontend/public/manifest.json.
// - El título, meta tags y theme-color de frontend/public/index.html NO los toca
//   este script: usan tokens %REACT_APP_X% que React (create-react-app) ya
//   sustituye automáticamente al compilar, leyendo el mismo .env.production.
// - Si se pasa [carpeta-con-logos], copia de ahí los archivos con estos nombres
//   exactos sobre frontend/public/, sobrescribiendo los genéricos:
//     logo-icon.png, favicon.ico, favicon-16.png, favicon-32.png,
//     apple-touch-icon.png, logo192.png, logo512.png

const fs = require('fs');
const path = require('path');

const RAIZ_PLANTILLA = path.join(__dirname, '..');
const FRONTEND = path.join(RAIZ_PLANTILLA, 'frontend');

function leerEnv(archivo) {
  const valores = {};
  if (!fs.existsSync(archivo)) return valores;
  for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual === -1) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    valores[clave] = valor;
  }
  return valores;
}

function reemplazarTokens(archivo, mapa) {
  if (!fs.existsSync(archivo)) {
    console.warn(`Aviso: no existe ${archivo}, se omite.`);
    return;
  }
  let contenido = fs.readFileSync(archivo, 'utf8');
  for (const [token, valor] of Object.entries(mapa)) {
    contenido = contenido.split(token).join(valor);
  }
  fs.writeFileSync(archivo, contenido);
  console.log(`Actualizado: ${path.relative(RAIZ_PLANTILLA, archivo)}`);
}

function copiarAssets(carpetaOrigen) {
  const archivos = [
    'logo-icon.png', 'favicon.ico', 'favicon-16.png', 'favicon-32.png',
    'apple-touch-icon.png', 'logo192.png', 'logo512.png',
  ];
  for (const nombre of archivos) {
    const origen = path.join(carpetaOrigen, nombre);
    if (!fs.existsSync(origen)) {
      console.warn(`Aviso: no se encontró ${nombre} en ${carpetaOrigen}, se conserva el genérico.`);
      continue;
    }
    fs.copyFileSync(origen, path.join(FRONTEND, 'public', nombre));
    console.log(`Copiado: ${nombre}`);
  }
}

function main() {
  const env = leerEnv(path.join(FRONTEND, '.env.production'));
  const nombreInstitucion = env.REACT_APP_NOMBRE_INSTITUCION || 'Mi Institución';
  const colorPrimario = env.REACT_APP_COLOR_PRIMARIO || '#667eea';

  reemplazarTokens(path.join(FRONTEND, 'public', 'manifest.json'), {
    __NOMBRE_INSTITUCION__: nombreInstitucion,
    __COLOR_PRIMARIO__: colorPrimario,
  });

  const carpetaLogos = process.argv[2];
  if (carpetaLogos) {
    copiarAssets(path.resolve(carpetaLogos));
  } else {
    console.log('No se indicó carpeta de logos — se conservan los genéricos de assets/plantilla-generica/.');
    console.log('Uso: node scripts/aplicar-marca.js <carpeta-con-logos>');
  }

  console.log('\nListo. Ahora compila el frontend con: cd frontend && npm run build');
}

main();
