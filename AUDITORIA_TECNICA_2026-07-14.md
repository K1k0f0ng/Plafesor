# PLAYFESOR — AUDITORÍA TÉCNICA COMPLETA
**Fecha:** 14 de julio de 2026
**Alcance:** backend, frontend, base de datos. Auditoría de solo lectura — no se modificó ningún archivo del proyecto.
**Motivo:** primera tarea de la rearquitectura solicitada (SaaS multi-tenant → single-tenant por colegio). Este documento es el insumo para decidir, con datos reales, cómo y si proceder.

---

## 0. HALLAZGO MÁS IMPORTANTE — antes de cualquier decisión técnica

Esta auditoría se pidió en el marco de una rearquitectura hacia **single-tenant** (una instalación, una base de datos, un dominio por colegio). Pero el estado real del proyecto es:

- Playfesor está **en producción activa como SaaS multi-tenant**: varios colegios ya operan sobre la misma base de datos e instalación, diferenciados por `colegio_id`.
- El adendum de estrategia del propio 14 de julio de 2026 (`ESTRATEGIA_ADENDUM_JULIO_2026.md`, sección 5.1) identifica como **prioridad técnica #1** construir un sistema de planes y cobro **para ese modelo multi-tenant** — no abandonarlo. Literalmente dice: *"Se construyó el producto completo del plan más caro, pero falta el mecanismo para cobrarlo por niveles. Este es el proyecto técnico prioritario a partir de ahora, más que cualquier función nueva."*
- El diseño de base de datos (16 tablas, FKs reales, `colegio_id` consistente) es un **modelo multi-tenant sólido y bien construido**, no un prototipo improvisado.

Es decir: la instrucción de migrar a single-tenant y el diagnóstico estratégico más reciente del propio proyecto apuntan en direcciones opuestas. Ninguna de las dos es "incorrecta" — son dos modelos de negocio distintos (vender licencias independientes por colegio vs. vender planes SaaS sobre una plataforma compartida), con implicaciones muy distintas en ingeniería, operación (soporte a N instalaciones vs. una), y comercial (precio por instalación vs. suscripción recurrente).

**Recomendación:** antes de tocar una sola línea de código de rearquitectura, vale la pena decidir explícitamente cuál de los dos modelos de negocio se va a perseguir, porque cambia radicalmente el trabajo de ingeniería que sigue. Este informe cubre el estado técnico real para que esa decisión se tome con información completa — no para inclinarla en una dirección u otra.

---

## 1. RESUMEN EJECUTIVO

| Área | Fortalezas | Riesgos / deuda técnica |
|---|---|---|
| Backend | JWT + RBAC consistente, prepared statements en todo, sin stack traces expuestos, arquitectura controller/route/service ordenada y sin archivos huérfanos | Posible caída silenciosa de funciones IA/email (variables de entorno no documentadas), `JWT_SECRET` débil, riesgo IDOR en endpoints por ID, cero tests |
| Frontend | Zero acoplamiento de dominio de API (todo vía `REACT_APP_API_URL`), rutas protegidas por rol consistentes, sin páginas huérfanas | Marca "Playfesor" hardcodeada en ~10+ archivos (bloqueante para white-label), paleta de color y lógica de negocio duplicada en docenas de archivos, dependencias muertas, sin `.gitignore` |
| Base de datos | 16 tablas con FK reales (no por convención), diseño relacional limpio | `schema.sql` desincronizado de producción (columna en uso que no está documentada), cero migraciones versionadas, contraseña de admin expuesta en texto plano dentro del propio schema |
| General | Producto funcionalmente muy completo (IA generativa, predicción de riesgo, WhatsApp, portal de padres) muy por delante de lo que la propia estrategia de mayo proyectaba | No existe capa de configuración por institución (todo vive en código fuente), no hay ambiente de staging, no hay sistema de planes/cobro |

---

## 2. BACKEND (`backend/`)

### 2.1 Estructura
- `src/database.js` — pool de conexión MySQL (`mysql2/promise`, `connectionLimit: 25`, timezone Colombia).
- `src/middlewares/auth.js` — `verificarToken` (JWT) + `permitirRoles` (RBAC), aplicado consistentemente en los 20 routers (`router.use(verificarToken)` + `permitirRoles(...)` por ruta).
- `src/controllers/` — 18 archivos, uno por dominio (actividades, asistencia, auth, boletines, copiloto, colegio, docentes, estudiantes, grupos, horarios, logros, notificaciones, observador, padres, períodos, planes de mejoramiento, reportes, riesgo, tutor, whatsapp).
- `src/routes/` — 20 routers, mismo patrón en todos.
- `src/services/` — cron jobs (alertas 6am, recálculo de riesgo 2am, informe semanal domingo 6pm), generación de PDF, cliente WhatsApp (UltraMsg vía `https`/`querystring` nativos, sin axios).
- `src/utils/riesgoUtils.js` — funciones puras de scoring.
- No existe `config/`, `models/`, ni `tests/`.

### 2.2 Dependencias
Todas las dependencias de `package.json` están efectivamente en uso (`@anthropic-ai/sdk`, `bcryptjs`, `cors`, `dotenv`, `express`, `helmet`, `jsonwebtoken`, `multer`, `mysql2`, `pdfkit`). No hay `axios` ni `xlsx` en el backend.

**Hallazgo:** `express-rate-limit@7.5.1` está instalado físicamente en `node_modules` y en `package-lock.json`, pero ya no está en `package.json` ni se referencia en ningún archivo — quedó huérfano. El rate limiting real en producción es artesanal, con `Map()` en memoria (`index.js`), para login y endpoints de IA. Funciona, pero no persiste entre reinicios ni escala si hay más de un proceso Node.

### 2.3 `index.js` — configuración y middleware
Orden: dotenv → helmet → cors (whitelist) → json/urlencoded → estáticos `/uploads` → rate limiters → 19 routers → handler de errores global.

- **CORS hardcodeado**: `['https://playfesor.co', 'https://www.playfesor.co']` en `index.js:29`, ignorando la variable `CORS_ORIGINS` que existe en `.env`/`.env.production` pero que **no se lee en ningún lado del código**. Cambiar orígenes permitidos hoy requiere editar código y redeployar, no solo tocar `.env`.
- El `.htaccess` de Apache **también** inyecta cabeceras CORS (redundante con Express) y solo permite `https://playfesor.co` sin el `www.` — inconsistencia entre las dos capas.
- El modelo de Claude (`claude-haiku-4-5-20251001`) está hardcodeado en 8 lugares distintos del código — cambiar de modelo requiere tocar 8 archivos.
- El handler de errores global no expone stack traces al cliente (correcto), solo los loguea en servidor.

### 2.4 Autenticación y multi-tenancy
- Login firma JWT con `{ id, rol, colegio_id, nombre }`, expira según `JWT_EXPIRES_IN` (default 8h).
- Patrón dominante correcto: el `colegio_id` se toma siempre de `req.usuario.colegio_id` (JWT), nunca del body/params, para operaciones de "listar/crear en mi colegio".

**Hallazgo de seguridad (riesgo medio, tipo IDOR):** cuando un endpoint recibe un **ID de recurso específico por parámetro de ruta** (`:id`, `:grupo_id`, `:estudiante_id`), varios controllers no reverifican que ese recurso pertenezca al colegio del usuario autenticado — solo validan el rol. Encontrado en: `grupoController.js` (listar/quitar estudiantes), `docenteController.js` (asignaciones), `actividadController.js` (obtener por ID), casi todo `boletinController.js`, y partes de `riesgoController.js`. En contraste, `periodoController.js` y partes de `reporteController.js` sí validan correctamente — el patrón correcto existe, solo falta generalizarlo. En un modelo multi-tenant, esta es la clase de riesgo más relevante: un colegio no debería poder ver datos de otro bajo ninguna circunstancia, y hoy depende de que cada controller lo recuerde manualmente.

### 2.5 Variables de entorno
Declaradas en `.env`/`.env.production`: `NODE_ENV`, `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `ULTRAMSG_INSTANCE`, `ULTRAMSG_TOKEN`.

**Hallazgo crítico — posible falla silenciosa activa:** `ANTHROPIC_API_KEY` (usada en 7 archivos: copiloto, tutor, observador, generación de actividades, riesgo/PMI, informes semanales, whatsapp) y `RESEND_API_KEY` (reset de contraseña) se usan en el código pero **no aparecen en ningún archivo `.env*` del repositorio**. Dos posibilidades: (a) el servidor de producción las tiene configuradas por fuera de estos archivos (variable de entorno de sistema/panel de hosting) y estos archivos simplemente no reflejan la config real, o (b) todas las funciones de IA y el reset de contraseña por email están fallando con error 500 ahora mismo. **Se recomienda confirmar esto directamente en el hosting antes de cualquier otra acción**, independientemente de la rearquitectura.

**`JWT_SECRET` débil:** valor actual con patrón predecible (`playfesor_clave_secreta_2024`), baja entropía. Se recomienda regenerar con `crypto.randomBytes(64).toString('hex')`.

Ningún secreto está hardcodeado directamente en código `.js` — todos se leen vía `process.env`, que es la práctica correcta.

### 2.6 Base de datos (conexión)
Pool `mysql2/promise`, prepared statements (`?`) consistentes en todo el código revisado — no se detectó concatenación insegura de SQL en ningún controller.

### 2.7 Código duplicado (candidatos a helper común)
- Lógica de "nivel MEN" reimplementada en 7+ archivos.
- Subquery "mejor intento por actividad" repetida casi idéntica **más de 20 veces** en 10 archivos distintos — el patrón de duplicación más grande del backend. Candidato a vista SQL o helper de query.
- Construcción de mensajes de WhatsApp repetida en 5 archivos.
- Verificación manual "director + colegio_id propio" repetida textualmente en 6+ archivos — candidato a middleware `soloMiColegio` (que de paso resolvería parte del hallazgo IDOR de 2.4).
- Invocación a Claude (armar prompt, `client.messages.create`, extraer texto, manejar error) repetida con variaciones menores en 8 archivos.

### 2.8 Archivos obsoletos
No se encontraron archivos huérfanos: los 18 controllers están todos importados por su router, los 20 routers todos montados en `index.js`, los 5 services todos requeridos desde algún punto. No hay carpeta de tests ni configuración de framework de testing.

---

## 3. FRONTEND (`frontend/`)

### 3.1 Estructura
React 18 + Create React App (react-scripts 5.0.1). `src/` con 37 páginas (12,210 líneas), `components/` (Icons, Layout, Navbar, Sidebar, NotificacionBell), `config/` (api.js, axios.js), `context/AuthContext.js`. **No existe** `services/`, `hooks/`, `utils/`, ni `theme/`: la lógica de llamadas API vive inline en cada página, y todos los estilos son objetos JS inline (`const es = {...}`) — no hay CSS Modules, styled-components ni Tailwind.

Los 37 archivos de `pages/` están todos enrutados en `App.js` — no hay páginas huérfanas.

### 3.2 Dependencias
`react`, `react-dom`, `react-router-dom`, `react-scripts`, `axios`, `xlsx` — todas en uso. **Dependencias muertas**: `@testing-library/*` y `web-vitals` siguen en `package.json` pero no se usan (se eliminó `setupTests.js`, `App.test.js`, `reportWebVitals.js` sin quitar las dependencias asociadas).

### 3.3 Routing y autenticación
- `react-router-dom` v6, mapa de rutas por rol hardcodeado en `App.js` (`RUTAS_POR_ROL`), con una copia parcial e inconsistente en `Login.js` (`RUTA_POR_ROL`, sin `director` ni `padre` — funciona igual solo por una doble capa de redirección, no por diseño).
- Sesión: Context API + `localStorage` (`playfesor_token`, `playfesor_usuario`), verificación de expiración de JWT decodificada manualmente cada 60s.
- JWT adjuntado vía interceptor de axios (`config/axios.js`); 401 fuerza `window.location.href = '/login'` (hard redirect).

### 3.4 Identidad institucional — bloqueante real para white-label
**No existe ningún mecanismo de theming.** Todo hardcodeado:
- Nombre "Playfesor": en 6+ archivos de `src/pages`, en `Sidebar.js`, y en `public/index.html` (title, meta tags, JSON-LD) y `public/manifest.json`.
- Logo: archivos estáticos en `public/` referenciados con ruta absoluta directamente en JSX — sin indirección vía variable de entorno ni dato de backend.
- Paleta de color (`#667eea` → `#764ba2`) repetida como literal en **28 archivos distintos**, sin constante central de tema; además `theme-color` de `index.html` y `manifest.json` usan valores distintos entre sí.
- URLs absolutas a `playfesor.co` hardcodeadas en `index.html` (og:image), `robots.txt`, `sitemap.xml`, y en el copy de marketing de `LandingPage.js`.

**Esto es exactamente lo que la nueva arquitectura single-tenant necesitaría resolver primero**: migrar a marca blanca por colegio requeriría tocar como mínimo `index.html`, `manifest.json`, `robots.txt`, `sitemap.xml`, y 6-8 archivos de `src/`, más extraer la paleta repetida en 28 archivos a un tema centralizado configurable.

Nota positiva: **cero acoplamiento de dominio de API** — todas las llamadas usan `REACT_APP_API_URL`, así que el backend sí es reapuntable sin tocar código.

### 3.5 Código duplicado
Lógica de "nivel MEN"/semáforo de notas reimplementada de forma independiente en 6 archivos con nombres y colores ligeramente distintos. Objetos de estilo (`statCard`, gradientes, sombras) redefinidos copy-paste en cada página. Patrón de carga de datos por colegio (`useAuth()` → `colegio_id` → `axiosAuth.get(...)`) repetido casi textual en 7 páginas — candidato a hook compartido `useColegioData(endpoint)`. Los 5 dashboards por rol no comparten ningún componente base.

### 3.6 Acoplamiento multi-tenant (relevante para la migración)
El patrón de endpoint es sistemáticamente `/api/<recurso>/colegio/${usuario.colegio_id}/...` — el frontend decide a qué colegio se refiere cada llamada. **Sin embargo, no existe un selector de colegio en la UI**: `Colegios.js` toma solo el primer colegio de la respuesta y lo trata como "Mi institución", no como gestor de una lista. Es decir, **el frontend ya se comporta como una app por colegio** (single-tenant desde la perspectiva de la SPA), simplemente reenviando el `colegio_id` del usuario logueado.

Para eliminar `colegio_id` del frontend: son ~9-11 archivos donde hay que quitar el segmento `/colegio/${colegioId}` de la URL — cambio mecánico y de bajo riesgo, porque el frontend nunca ofreció cambiar de colegio. El acoplamiento real está en las URLs de API, no en estado global ni routing.

### 3.7 Otros
No hay `.gitignore` en `frontend/` (relevante antes de versionar con git). La carpeta `build/` presente junto a `src/` parece desactualizada respecto a los últimos cambios de `LandingPage.js` — regenerar antes de cualquier despliegue.

---

## 4. BASE DE DATOS (`database/schema.sql`)

### 4.1 Inventario
16 tablas, todas con **FK reales declaradas** (no por convención): `colegios`, `usuarios`, `materias`, `grupos`, `docente_grupos_materias`, `estudiante_grupos`, `actividades`, `resultados_actividades`, `periodos_academicos`, `asistencias`, `predicciones_riesgo`, `padre_estudiante`, `estudiante_logros`, `planes_mejoramiento`, `horarios`, `notificaciones`. Política de `ON DELETE` mayormente `CASCADE`, con `SET NULL` donde tiene sentido (usuario/colegio desactivado sin perder historial).

### 4.2 Drift confirmado entre schema y producción
**`usuarios.telefono_padres` se usa activamente en 7+ archivos del backend** (WhatsApp, riesgo, informes) **pero no existe en `schema.sql`**. Confirma la sospecha ya registrada en la memoria del proyecto: hay al menos un `ALTER TABLE` aplicado manualmente en producción (vía phpMyAdmin) que nunca se incorporó al repositorio. **No hay ningún otro archivo `.sql` en todo el proyecto** — cero migraciones, cero versionado de esquema. Si se reconstruyera la BD desde `schema.sql` hoy, la aplicación fallaría.

**Antes de cualquier migración a single-tenant, es indispensable hacer un `SHOW CREATE TABLE` completo contra la base de datos de producción real**, no confiar en `schema.sql` como fuente de verdad.

### 4.3 Multi-tenancy
`colegio_id` directo en 5 tablas (`usuarios`, `grupos`, `periodos_academicos`, `predicciones_riesgo`, `planes_mejoramiento`); heredado por JOIN en las otras 10. Única tabla sin aislamiento por colegio: `materias` (catálogo global de materias del MEN, aparentemente intencional). El aislamiento depende 100% de la disciplina del código de aplicación — nada en la BD lo fuerza (coincide con el hallazgo IDOR del backend).

### 4.4 Hallazgo de seguridad en el propio schema
El seed final (`INSERT` del usuario admin) incluye un comentario con la contraseña en texto plano (`Admin2025*`) junto al hash bcrypt — credencial expuesta dentro del repositorio.

### 4.5 Viabilidad de separar un colegio a BD propia (para single-tenant)
- **5 tablas "listas"** (`colegio_id` directo): extracción trivial, basta un `WHERE colegio_id = X`.
- **11 tablas requieren JOIN de filtrado** (vía `usuarios`/`grupos`) — mecánico pero no trivial.
- **`materias`** exige decisión de negocio (catálogo compartido vs. copiar/filtrar por colegio).
- **IDs no portables**: todos los PK son `INT AUTO_INCREMENT` sin UUID — mover un colegio a BD propia exige remapear IDs y reescribir FKs en las ~16 tablas.
- Conclusión: la separación es **factible, de complejidad media-alta**, no un rediseño desde cero — pero tampoco es "solo quitar una columna".

### 4.6 Otras inconsistencias menores
`predicciones_riesgo.factores` es `TEXT`, no `JSON` (contradice lo documentado externamente). Default de `ano_lectivo` inconsistente entre `grupos` (2025) y `periodos_academicos` (2026). Sin columnas `actualizado_en` en la mayoría de tablas. Sin `COMMENT` nativo de MySQL en ninguna columna (la documentación vive solo en comentarios `--` del archivo, no viaja con la BD).

---

## 5. RIESGOS TRANSVERSALES (afectan la decisión de arquitectura, no solo el código)

1. **Decisión de negocio pendiente** (sección 0): multi-tenant con planes/cobro vs. single-tenant por colegio. Cambia todo lo que sigue.
2. **Posible incidente activo**: variables de IA/email no documentadas — confirmar en producción antes de cualquier otra cosa.
3. **`schema.sql` no es fuente de verdad** — cualquier trabajo de plantilla maestra o migración debe partir de un volcado real de producción, no de este archivo.
4. **Identidad de marca 100% hardcodeada en frontend** — es el mayor bloqueante técnico concreto para el objetivo de "plantilla maestra reutilizable por colegio" que pide la rearquitectura, independientemente de si se elige single-tenant o multi-tenant con más aislamiento.
5. **Riesgo IDOR entre colegios** — relevante en ambos modelos de negocio: en multi-tenant es una fuga entre clientes; en single-tenant deja de existir por diseño (cada colegio ya no comparte servidor), lo cual de hecho es un argumento a favor de single-tenant desde la perspectiva de seguridad, aunque no desde la perspectiva de costo operativo.
6. **Cero tests, cero staging, cero CI** — ya señalado en el adendum de estrategia de mayo, sigue sin resolverse.

---

## 6. NO SE HA MODIFICADO NADA

Esta auditoría fue estrictamente de lectura. No se crearon carpetas nuevas, no se movieron archivos, no se tocó código, configuración ni base de datos. Este documento es el punto de partida para la segunda tarea (refactorización), que según la metodología acordada solo debe iniciarse tras aprobación explícita.
