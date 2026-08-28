# Hosting (cPanel + Apache/Passenger)

Esta guía asume un hosting compartido con cPanel, que es el patrón usado hasta ahora para Playfesor.
Si el hosting de un colegio es distinto (VPS propio, otro panel), los pasos generales aplican pero
la interfaz cambia.

## Estructura recomendada en el servidor

```
public_html/                  ← raíz del dominio del frontend
  (contenido de frontend/build/)
public_html/backend/          ← Application Root del backend en cPanel
  index.js, src/, node_modules/, .env, .htaccess
```

O bien, si el backend va en un subdominio (`api.midominio.edu.co`), su Application Root en cPanel
apunta directamente a esa carpeta.

## Backend — Setup Node.js App (cPanel)

1. cPanel → "Setup Node.js App" → Create Application.
2. Node.js version: 18 o superior (usar la misma que en desarrollo si es posible).
3. Application mode: Production.
4. Application root: la carpeta donde subiste `backend/` (sin subcarpeta `api` intermedia).
5. Application URL: el subdominio o ruta de la API.
6. Application startup file: `index.js`.
7. Después de crear la app, cPanel genera un entorno virtual de Node
   (algo como `/home/usuario/nodevenv/ruta/22/`). Desde la terminal que ofrece esa misma pantalla,
   ejecuta `npm install` dentro del Application Root.
8. Variables de entorno: cPanel permite definirlas desde esa misma pantalla, o se pueden dejar
   únicamente en el archivo `.env` (el backend usa `dotenv`, así que basta con que `.env` exista en
   el Application Root).
9. Reinicia la aplicación (botón "Restart") después de cualquier cambio de código o de `.env`.

## `.htaccess` del backend

El archivo `backend/.htaccess` de la plantilla:
- Le dice a Apache que enrute todo a través de Passenger/Node.
- Bloquea el listado de directorio.
- Agrega cabeceras CORS a nivel de Apache **como capa adicional** a la que ya hace Express — debes
  actualizar `Access-Control-Allow-Origin` (línea con `REEMPLAZAR_DOMINIO_FRONTEND`) con el dominio
  real del frontend de este colegio, exactamente igual a `CORS_ORIGINS` en `.env`. Si no coinciden,
  puede haber comportamiento inconsistente entre ambas capas.
- Responde automáticamente `200` a las solicitudes `OPTIONS` (preflight de CORS) sin que lleguen a
  Node.

## Frontend

El frontend es un conjunto de archivos estáticos (el contenido de `frontend/build/` tras
`npm run build`) — se sube directo a la raíz pública del dominio (`public_html/` o la carpeta que
cPanel asigne a ese dominio/subdominio). No necesita "Setup Node.js App": es HTML/CSS/JS servido
directamente por Apache.

Si el frontend usa rutas de React Router (como `/dashboard`, `/login`), asegúrate de que el hosting
redirija cualquier ruta que no sea un archivo físico hacia `index.html`, para que la SPA maneje el
routing. Revisa si ya existe un `.htaccess` en `frontend/public/` con esa regla antes de asumir que
hace falta agregar una.

## SSL

Usa AutoSSL de cPanel para ambos dominios/subdominios (frontend y backend). Confirma que el
candado verde aparece en ambos antes de la entrega — ver
`checklists/CHECKLIST_IMPLEMENTACION.md`.

## DNS

Si el dominio es nuevo, la propagación DNS puede tardar hasta 24–48 horas. Planifica la instalación
con margen si el dominio se acaba de comprar o de apuntar al hosting.
