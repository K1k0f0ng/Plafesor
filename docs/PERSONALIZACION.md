# Personalización institucional

Cómo cambiar el nombre, logo, colores y favicon de una instalación — durante la implementación
inicial o después, si el colegio actualiza su imagen.

## Qué se puede personalizar por configuración (sin tocar código)

| Elemento | Dónde se configura |
|---|---|
| Nombre de la institución | `REACT_APP_NOMBRE_INSTITUCION` (frontend) e `INSTITUCION_NOMBRE` (backend) |
| Color primario / secundario | `REACT_APP_COLOR_PRIMARIO`/`REACT_APP_COLOR_SECUNDARIO` (frontend) y `EMAIL_COLOR_PRIMARIO`/`EMAIL_COLOR_SECUNDARIO` (backend, solo para los correos) |
| Logo, favicon, ícono de apple-touch | Archivos en `frontend/public/` (ver abajo) |
| Dominio/URL del correo de reset de contraseña | `FRONTEND_URL` (backend) |

## Cambiar nombre y colores

1. Edita `frontend/.env.production` con los nuevos valores.
2. Ejecuta `node scripts/aplicar-marca.js` desde la raíz de la instalación del colegio (actualiza
   `manifest.json`).
3. Recompila: `cd frontend && npm run build`.
4. Sube el contenido de `frontend/build/` al hosting, reemplazando lo anterior.

El nombre y los colores aparecen automáticamente en: sidebar, pantalla de login, recuperación de
contraseña, pestaña del navegador (título y favicon), y el correo de reset de contraseña.

## Cambiar logo/escudo/favicon

Los archivos que hay que reemplazar en `frontend/public/` son:

| Archivo | Uso | Tamaño recomendado |
|---|---|---|
| `logo-icon.png` | Sidebar y pantallas de login/recuperación | Cuadrado, mínimo 256×256, fondo transparente |
| `favicon.ico` | Pestaña del navegador | 16×16 y 32×32 combinados |
| `favicon-16.png`, `favicon-32.png` | Pestaña del navegador (fallback) | 16×16 y 32×32 |
| `apple-touch-icon.png` | Ícono al agregar a pantalla de inicio (iOS) | 180×180 |
| `logo192.png`, `logo512.png` | PWA / manifest.json | 192×192 y 512×512 |

Formas de hacerlo:
- **Automático**: reúne los 7 archivos con esos nombres exactos en una carpeta y ejecuta
  `node scripts/aplicar-marca.js <carpeta>` — los copia todos sobre los genéricos.
- **Manual**: copia cada archivo directamente a `frontend/public/`, sobrescribiendo el genérico.

En ambos casos, hay que recompilar y volver a subir el frontend después (los archivos de `public/`
se empaquetan dentro de `build/` al compilar).

## Por qué no hay una página de marketing en cada instalación

La plantilla no incluye ninguna landing page pública ni SEO orientado a buscadores: cada
instalación sirve a un solo colegio, con acceso mediante login, no es un sitio que deba indexarse ni
promocionarse públicamente. La ruta raíz (`/`) va directo a `/login`.

## Qué NO cambia entre colegios (a propósito)

El catálogo de materias del MEN colombiano y la escala de calificación son iguales en todas las
instalaciones — no son parte de la identidad institucional, son estándares nacionales.
