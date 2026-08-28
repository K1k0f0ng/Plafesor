# /uploads

Documenta la estructura de subcarpetas que `backend/uploads/` debe tener en cada instalación real
(logos institucionales, escudos, evidencias subidas por usuarios). Esta carpeta de la raíz es solo
documentación de referencia — **no es** la carpeta que el backend sirve en runtime.

La carpeta real que el servidor usa es `backend/uploads/` (servida como estático desde
`backend/index.js`). Esa carpeta se crea automáticamente en cada servidor la primera vez que se
sube un archivo y vive únicamente en el hosting de cada colegio — nunca en este repositorio.

Estructura de referencia esperada dentro de `backend/uploads/` en una instalación:
```
uploads/
  logos/       — logo institucional del colegio
  escudos/     — escudo institucional
  favicons/    — favicon del colegio
```
