'use strict';
// Crea el usuario administrador inicial de esta instalación.
// Uso: desde backend/, ejecutar `node scripts/crear-admin.js`
// Pide nombre, email y contraseña por terminal — nunca hay contraseñas
// embebidas en el schema.sql ni en ningún archivo del repositorio.

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../src/database');

function preguntar(rl, texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== Crear usuario administrador ===\n');
  const nombre = (await preguntar(rl, 'Nombre completo: ')).trim();
  const email = (await preguntar(rl, 'Email: ')).trim().toLowerCase();
  const password = await preguntar(rl, 'Contraseña (mínimo 6 caracteres): ');
  rl.close();

  if (!nombre || !email || !password) {
    console.error('\nTodos los campos son obligatorios.');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('\nLa contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  try {
    const [existentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      console.error(`\nYa existe un usuario con el email ${email}.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO usuarios (nombre, email, password, rol, colegio_id, activo)
       VALUES (?, ?, ?, 'admin', 1, TRUE)`,
      [nombre, email, hash]
    );

    console.log(`\nUsuario administrador creado: ${email}`);
    console.log('Ya puedes iniciar sesión con este correo y la contraseña ingresada.');
  } catch (err) {
    console.error('\nError al crear el usuario administrador:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
