# Instalación de un colegio nuevo — guía paso a paso

Esta guía asume que ya se completó `checklists/CHECKLIST_DATOS_INSTITUCIONALES.md` con el colegio.
Sigue los pasos en orden — no requiere conocimientos previos del código, solo seguir cada
instrucción exactamente.

## 0. Preparar la carpeta de trabajo

1. Copia la carpeta completa `deployment/PLAYFESOR_TEMPLATE/` a
   `deployment/CLIENTES/<Nombre_Colegio>/` (usa un nombre sin espacios ni tildes, ej. `Colegio_San_Rafael`).
2. Todo lo que sigue se hace **dentro de esa copia**, nunca en `PLAYFESOR_TEMPLATE/` original.

## 1. Base de datos

1. En cPanel → MySQL Databases: crea la base de datos y el usuario con los datos del checklist
   (sección "Base de datos"). Anota el nombre completo que cPanel asigna (suele llevar un prefijo,
   ej. `usuario_nombrebd`).
2. Asigna el usuario a la base de datos con todos los privilegios.
3. En phpMyAdmin, selecciona la base de datos nueva y ve a la pestaña "Importar".
4. Importa el archivo `database/schema.sql` de la copia del colegio.
5. Verifica que se crearon las 16 tablas y que la tabla `colegios` tiene un registro con
   `id = 1` (con los placeholders `NOMBRE_INSTITUCION_AQUI` / `CIUDAD_AQUI` — los vas a corregir en
   el paso 3).

## 2. Backend

1. Sube la carpeta `backend/` (de la copia del colegio) al hosting, en la ruta que cPanel use para
   aplicaciones Node (ver `docs/HOSTING.md`).
2. Copia `backend/.env.example` como `backend/.env` en el servidor y completa **todos** los valores
   con los datos del checklist: `INSTITUCION_NOMBRE`, `INSTITUCION_DOMINIO`,
   `INSTITUCION_EMAIL_CONTACTO`, `DB_*`, `JWT_SECRET` (genera uno nuevo, no reutilices el de otra
   instalación), `CORS_ORIGINS` (el dominio real del frontend de este colegio), `ANTHROPIC_API_KEY`,
   `SMTP_*`, `ULTRAMSG_*` (si aplica), `FRONTEND_URL`.
3. En cPanel → Setup Node.js App: configura el Application Root apuntando a esta carpeta `backend/`,
   instala las dependencias (`npm install` desde la interfaz de cPanel, o por terminal SSH si hay
   acceso), y arranca la aplicación.
4. Verifica que el servidor responde: visita `https://api.tudominio.edu.co/` y confirma que devuelve
   `{"mensaje":"API Playfesor activa", ...}`.

## 3. Corregir el registro del colegio

En phpMyAdmin, sobre la base de datos de este colegio:

```sql
UPDATE colegios SET nombre = 'Nombre real del colegio', ciudad = 'Ciudad real' WHERE id = 1;
```

## 4. Crear el usuario administrador

1. Desde tu PC de desarrollo (o por SSH si el hosting lo permite), entra a la carpeta `backend/` de
   la copia del colegio, con el `.env` ya apuntando a la base de datos real de este colegio.
2. Ejecuta: `node scripts/crear-admin.js`
3. Ingresa el nombre, correo y contraseña del administrador cuando se te pida.
4. Confirma el mensaje "Usuario administrador creado".

## 5. Marca institucional del frontend

1. En la copia del colegio, copia `frontend/.env.example` como `frontend/.env.production` y
   completa `REACT_APP_API_URL` (el dominio de la API de este colegio),
   `REACT_APP_NOMBRE_INSTITUCION`, `REACT_APP_COLOR_PRIMARIO`, `REACT_APP_COLOR_SECUNDARIO`.
2. Reúne en una carpeta los archivos gráficos del colegio con estos nombres exactos:
   `logo-icon.png`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`,
   `logo192.png`, `logo512.png`.
3. Desde la raíz de la copia del colegio, ejecuta:
   `node scripts/aplicar-marca.js <ruta-a-la-carpeta-de-logos>`
   Esto actualiza `frontend/public/manifest.json` y copia los logos sobre los genéricos.
   Si todavía no tienes los logos definitivos, puedes correr el script sin ese argumento — se
   conservan los placeholders neutros mientras tanto.

## 6. Compilar y subir el frontend

1. Desde `frontend/`, ejecuta `npm install` y luego `npm run build`.
2. Sube el contenido de la carpeta `frontend/build/` (no la carpeta en sí, su contenido) a la raíz
   pública del dominio del colegio (`public_html/` o equivalente).

## 7. Pruebas finales

Sigue `checklists/CHECKLIST_IMPLEMENTACION.md` completo antes de entregar. Como mínimo:
- Login con el usuario administrador creado en el paso 4.
- Crear un grupo, un docente y un estudiante de prueba (y luego eliminarlos, o dejar que el colegio
  empiece a cargar sus datos reales).
- Confirmar que llega el correo si se prueba "olvidé mi contraseña".
- Confirmar que el logo, favicon y nombre correctos aparecen en el navegador (pestaña, sidebar,
  pantalla de login).

## 8. Entrega

- Documenta esta instalación en `versiones/registro_clientes.md`.
- Guarda una copia de la configuración (sin contraseñas en texto plano fuera de un gestor seguro) en
  `deployment/CLIENTES/<Nombre_Colegio>/`.
- Capacita al administrador del colegio (ver `docs/MANUAL_ADMIN.md`).
