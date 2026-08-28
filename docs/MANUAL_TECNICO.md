# Manual técnico

Referencia rápida para quien retome el desarrollo de Playfesor (tú mismo en el futuro, o un
desarrollador contratado). Para el detalle completo, ver `AUDITORIA_TECNICA_2026-07-14.md` (estado
del sistema al momento de la rearquitectura) y el plan de rearquitectura en el historial de esta
conversación.

## Stack

- **Backend**: Node.js 22, Express 4, MySQL vía `mysql2/promise` (pool de conexiones), JWT
  (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `nodemailer`, `pdfkit`, `@anthropic-ai/sdk`.
- **Frontend**: React 18, Create React App (`react-scripts` 5), `react-router-dom` 6, `axios`,
  `xlsx`. Sin Redux ni gestor de estado externo — Context API (`AuthContext`) para la sesión.
- **Base de datos**: MySQL 8 / MariaDB 10+, InnoDB, `utf8mb4`, FK reales en todas las relaciones.

## Estructura del código (core, no de una instalación)

```
backend/
  index.js              — entrypoint, monta 20 routers, rate limiting en memoria, cron jobs
  src/
    database.js          — pool de conexión MySQL
    config/ia.js          — modelo de Claude centralizado
    middlewares/auth.js    — verificarToken (JWT) + permitirRoles (RBAC)
    controllers/           — 18 archivos, uno por dominio
    routes/                — 20 routers, mismo patrón: router.use(verificarToken) + permitirRoles
    services/               — cron jobs (alertas, riesgo, informes semanales), email, WhatsApp, PDF
    utils/riesgoUtils.js     — funciones puras de scoring de riesgo académico

frontend/
  src/
    App.js                — mapa de rutas por rol, guards de ruta
    context/AuthContext.js  — sesión, localStorage, expiración de JWT
    config/                 — api.js (baseURL), axios.js (interceptors), tema.js (marca institucional)
    components/              — Sidebar, Layout, Icons, NotificacionBell
    pages/                    — 36 páginas, una por pantalla/rol
```

## Patrones a mantener

- **Multi-tenancy histórico**: el `colegio_id` se toma siempre de `req.usuario.colegio_id` (JWT)
  para operaciones de listar/crear "de mi colegio" — nunca del body/params. Si algún endpoint nuevo
  recibe un ID de recurso por parámetro (`:id`), sigue el patrón de `periodoController.js` o
  `reporteController.js`: resolver el colegio real del recurso antes de autorizar, no confiar solo
  en el rol.
- **Prepared statements**: todas las queries usan `?`, nunca concatenación de strings con input de
  usuario.
- **Config nunca hardcodeada**: cualquier valor específico de una institución (nombre, colores,
  claves de API, credenciales) va en `.env`, nunca en código. Ver `docs/CONFIGURACION.md`.
- **Escala MEN**: la lógica de niveles de desempeño (`nota < 3.5` → Bajo, etc.) está duplicada en
  varios archivos del backend y del frontend — al modificarla, buscar todas las ocurrencias de
  `nivelMEN`/`NIVEL_MEN`/`semaforo` antes de dar el cambio por completo.

## Deuda técnica conocida (no resuelta en esta rearquitectura)

Ver `AUDITORIA_TECNICA_2026-07-14.md` secciones 2.4, 2.7 y 3.5 para el detalle:
- Patrón IDOR en varios controllers cuando reciben un ID de recurso por parámetro (relevante solo
  si alguna vez se vuelve a compartir una instalación entre colegios — en single-tenant deja de ser
  un riesgo real).
- Duplicación de la subquery "mejor intento por actividad" en más de 20 lugares — candidato a vista
  SQL o helper de query.
- Sin suite de tests automatizados.
- Sin ambiente de staging.

## Cómo probar cambios localmente

1. `backend/`: `npm install`, copiar `.env.example` como `.env` con datos de una BD local de
   pruebas, `npm run dev` (usa `nodemon`).
2. `frontend/`: `npm install`, `npm start` (apunta a `REACT_APP_API_URL=http://localhost:3001` por
   defecto en `.env.development`).
3. Nunca apuntar el entorno de desarrollo local a la base de datos de producción de un colegio real.

## Dónde reportar/documentar cambios

Toda funcionalidad nueva o cambio importante debe reflejarse en: `docs/CHANGELOG.md`,
`releases/vX.X.X/`, y el `.env.example` correspondiente si agrega variables de configuración nuevas.
