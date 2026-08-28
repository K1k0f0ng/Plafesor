# Configuración

Toda la configuración específica de un colegio vive en variables de entorno (`.env`), nunca en el
código fuente. Esto es lo que permite actualizar el core del producto sin sobrescribir la identidad
ni la configuración de cada institución.

## Backend (`backend/.env`)

| Variable | Qué es | Obligatoria |
|---|---|---|
| `INSTITUCION_NOMBRE` | Nombre del colegio, usado en los correos automáticos | Sí |
| `INSTITUCION_DOMINIO` | Dominio del colegio, usado en el pie de los correos | Sí |
| `INSTITUCION_EMAIL_CONTACTO` | Correo de contacto institucional | No (informativo) |
| `PORT` | Puerto donde corre el backend | Sí (normalmente 3001) |
| `NODE_ENV` | `production` en el servidor real | Sí |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a la base de datos de este colegio | Sí |
| `JWT_SECRET` | Firma los tokens de sesión — genera uno único por instalación, nunca reutilices el de otro colegio | Sí |
| `JWT_EXPIRES_IN` | Duración de la sesión (ej. `8h`) | Sí |
| `CORS_ORIGINS` | Dominios del frontend que pueden llamar a esta API, separados por coma | Sí |
| `ANTHROPIC_API_KEY` | Clave propia de este colegio para los módulos de IA | Sí, si se usan Copiloto/Observador/Tutor IA/generación de actividades/PMI |
| `CLAUDE_MODEL` | Modelo de Claude a usar — cambiar aquí actualiza los 8 módulos de IA a la vez | No (trae un valor por defecto) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Envío de correo (reset de contraseña) | Sí |
| `EMAIL_COLOR_PRIMARIO`, `EMAIL_COLOR_SECUNDARIO` | Colores de marca en el correo de reset de contraseña | No (usan el color por defecto si se omiten) |
| `ULTRAMSG_INSTANCE`, `ULTRAMSG_TOKEN` | Cuenta propia de este colegio en UltraMsg | Sí, si se usa el módulo de WhatsApp |
| `FRONTEND_URL` | URL pública del frontend de este colegio, usada en los enlaces de los correos | Sí |

## Frontend (`frontend/.env.production`)

Estas variables quedan **embebidas en el bundle JS público** al compilar — nunca pongas secretos
aquí, solo configuración visible.

| Variable | Qué es |
|---|---|
| `REACT_APP_API_URL` | URL de la API del backend de este colegio |
| `REACT_APP_NOMBRE_INSTITUCION` | Nombre mostrado en el sidebar, login, pantallas de recuperación de contraseña, y en el `<title>`/meta tags de la página |
| `REACT_APP_COLOR_PRIMARIO`, `REACT_APP_COLOR_SECUNDARIO` | Colores de marca, aplicados a toda la interfaz vía variables CSS |

Después de cambiar cualquiera de estas variables, hay que volver a compilar (`npm run build`) y
subir el resultado — no basta con editar el `.env` en el servidor, porque el frontend es un
conjunto de archivos estáticos generados en tiempo de compilación, no un proceso que lea el `.env`
en cada request (a diferencia del backend).

## Qué NO se configura por variables de entorno

- El **catálogo de materias** (MEN Colombia) y la **escala de calificación** viven en la base de
  datos, ya precargados por `schema.sql` — se administran desde el panel de administración, no
  editando archivos.
- Los **logos/escudo/favicon** son archivos binarios, no strings — se gestionan copiándolos a
  `frontend/public/` (ver `docs/PERSONALIZACION.md`), no por variable de entorno.
