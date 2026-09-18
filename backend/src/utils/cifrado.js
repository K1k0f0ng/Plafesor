const crypto = require('crypto');

// Cifrado del texto libre sensible del módulo Bienestar y Orientación
// (motivos, resúmenes, notas privadas...). AES-256-GCM: además de ocultar el
// texto detecta si alguien lo alteró en la base de datos.
//
// La clave vive SOLO en el .env del servidor (BIENESTAR_CLAVE_CIFRADO, 64
// caracteres hexadecimales = 32 bytes). Si se pierde, lo cifrado no se puede
// recuperar — debe guardarse una copia en un gestor de contraseñas.
//
// Formato guardado: "v1:" + base64(iv[12] + tag[16] + texto cifrado). El
// prefijo de versión permite rotar la clave o el algoritmo más adelante.

const PREFIJO = 'v1:';

function obtenerClave() {
  const hex = process.env.BIENESTAR_CLAVE_CIFRADO || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

function claveConfigurada() {
  return obtenerClave() !== null;
}

// Cifra un texto. Vacío o null → null. Sin clave válida lanza error: nunca se
// guarda en texto plano "por si acaso".
function cifrar(texto) {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto);
  if (limpio.trim() === '') return null;
  const clave = obtenerClave();
  if (!clave) {
    const err = new Error('BIENESTAR_CLAVE_CIFRADO no está configurada');
    err.code = 'SIN_CLAVE_CIFRADO';
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cipher.update(limpio, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIJO + Buffer.concat([iv, tag, cifrado]).toString('base64');
}

// Descifra un valor guardado. Si está vacío devuelve null. Si no se puede
// descifrar (clave distinta, dato alterado) devuelve null y deja constancia en
// el log — sin imprimir el contenido — para no tumbar la vista completa del caso.
function descifrar(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (!String(valor).startsWith(PREFIJO)) {
    console.error('Bienestar: valor sin formato cifrado reconocido');
    return null;
  }
  const clave = obtenerClave();
  if (!clave) {
    console.error('Bienestar: no se puede descifrar, falta BIENESTAR_CLAVE_CIFRADO');
    return null;
  }
  try {
    const datos = Buffer.from(String(valor).slice(PREFIJO.length), 'base64');
    const iv = datos.subarray(0, 12);
    const tag = datos.subarray(12, 28);
    const cifrado = datos.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
  } catch {
    console.error('Bienestar: falló el descifrado de un valor (clave distinta o dato alterado)');
    return null;
  }
}

// Archivos adjuntos: mismo algoritmo sobre bytes. Formato en disco:
// "PFB1" + iv[12] + tag[16] + contenido cifrado. Aunque alguien lograra
// descargar el archivo del servidor, sin la clave no puede leerlo.
const MAGIA_ARCHIVO = Buffer.from('PFB1');

function cifrarBuffer(buffer) {
  const clave = obtenerClave();
  if (!clave) {
    const err = new Error('BIENESTAR_CLAVE_CIFRADO no está configurada');
    err.code = 'SIN_CLAVE_CIFRADO';
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGIA_ARCHIVO, iv, cipher.getAuthTag(), cifrado]);
}

// Devuelve el contenido original o null si no se puede descifrar
function descifrarBuffer(datos) {
  const clave = obtenerClave();
  if (!clave || !Buffer.isBuffer(datos) || datos.length < 32 || !datos.subarray(0, 4).equals(MAGIA_ARCHIVO)) {
    console.error('Bienestar: archivo sin formato cifrado reconocido o sin clave');
    return null;
  }
  try {
    const iv = datos.subarray(4, 16);
    const tag = datos.subarray(16, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(datos.subarray(32)), decipher.final()]);
  } catch {
    console.error('Bienestar: falló el descifrado de un archivo (clave distinta o archivo alterado)');
    return null;
  }
}

module.exports = { cifrar, descifrar, claveConfigurada, cifrarBuffer, descifrarBuffer };
