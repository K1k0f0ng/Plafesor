# PLAYFESOR — AUDITORÍA TÉCNICA DE SEGUIMIENTO
**Fecha:** 12 de agosto de 2026
**Alcance:** contraste contra `AUDITORIA_TECNICA_2026-07-14.md` — qué se resolvió, qué cambió de forma, qué sigue abierto, y qué hallazgos nuevos aparecieron con la reestructuración a single-tenant. Auditoría de solo lectura — no se modificó ningún archivo del proyecto.
**Motivo:** un mes después de la auditoría de julio y de la decisión de migrar a single-tenant (una instalación por colegio, ver `README.md`), revisar qué tan real es el trabajo hecho y qué falta para poder vender e instalar el primer colegio bajo el modelo nuevo.

---

## 0. RESUMEN EJECUTIVO

La decisión pendiente en julio (¿multi-tenant con cobro por planes, o single-tenant por colegio?) **ya se tomó**: el proyecto adoptó single-tenant. Como consecuencia, el "sistema de planes y cobro" que julio marcaba como prioridad técnica #1 **ya no aplica** — no se construyó, y con este modelo de negocio no hace falta construirlo.

Con esa decisión tomada, se hizo en un mes más trabajo de fondo del que un vistazo rápido sugiere: 15 documentos nuevos en `docs/` con contenido real (no esqueletos), un mecanismo de theming por colegio, migraciones de base de datos versionadas, y una plantilla (`deployment/PLAYFESOR_TEMPLATE/`) separada del sitio en producción. **6 de los 10 hallazgos técnicos de julio están resueltos o cambiaron de forma que ya no aplica.**

Pero hay un patrón que se repite varias veces en esta auditoría y que vale la pena nombrar explícitamente: **se construyó el mecanismo correcto, pero no se terminó de aplicar donde importa hoy.** Ejemplos concretos:

- Se creó un sistema de marca configurable por colegio (`tema.js`) — pero el sitio real (`playfesor.co`, carpeta `frontend/` raíz) **no lo usa**, sigue con "Playfesor" y los colores hardcodeados como en julio.
- Se afirma en el CHANGELOG que la plantilla "ya no tiene ninguna referencia hardcodeada a la marca Playfesor" — pero eso es cierto solo para el frontend; **el backend de la plantilla sigue mandando "Playfesor" por WhatsApp, en los PDF de boletines y en las respuestas del Tutor IA** a cualquier colegio que se instale con ella hoy.
- Se creó `database/migrations/` para evitar que el schema se desincronice de producción otra vez — y **ya hay un caso real de drift entre el schema del core y el de la plantilla**, ocurrido el mismo día en que se creó el mecanismo.
- Se corrigió el IDOR (acceso a datos de otro colegio) en varios controllers — pero **`boletinController.js` sigue sin esa protección**, y es justo el módulo que expone notas de estudiantes.

Y el hallazgo más importante para decidir qué sigue: **el modelo completo nunca se ha probado de punta a punta.** `deployment/CLIENTES/` está vacía, `versiones/registro_clientes.md` no tiene ningún colegio registrado, y el propio CHANGELOG de la versión más reciente (v2.0.0) admite que quedó pendiente probar el script de creación de administrador y un login completo contra una base de datos real. Es decir: **hoy no hay evidencia de que se pueda instalar un colegio nuevo de principio a fin sin tropezar.**

---

## 1. LOS 10 HALLAZGOS DE JULIO, RE-VERIFICADOS HOY

| # | Hallazgo de julio | Estado hoy | Evidencia |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY`/`RESEND_API_KEY` usadas en código pero no documentadas | **Cambió de forma, parcialmente resuelto** | `ANTHROPIC_API_KEY` ya está en `backend/.env.example:19` (vacía, con nota "pendiente completar"). `RESEND_API_KEY` ya no existe: el envío de email migró a SMTP genérico vía nodemailer (`.env.example:22-26`) |
| 2 | CORS hardcodeado, ignorando `CORS_ORIGINS` | **Resuelto** | `backend/index.js:30-32` ahora lee `process.env.CORS_ORIGINS.split(',')`, con el array viejo solo como respaldo si la variable falta |
| 3 | `JWT_SECRET` débil y predecible | **Sigue igual en el sitio real, con guía nueva para instalaciones futuras** | `backend/.env` y `.env.production` siguen con `playfesor_clave_secreta_2024` (línea 7 en ambos). `docs/SEGURIDAD.md:10-14` ya instruye generarlo con `crypto.randomBytes` — pero nadie aplicó esa instrucción al sitio actual |
| 4 | `express-rate-limit` instalado pero no usado; rate limiting artesanal con `Map()` | **Sigue igual** | No está en `package.json`. `index.js` sigue con `Map()` para login, y se agregó un segundo `Map()` para IA (`iaAttempts`, línea 48) — mismo patrón, ahora en dos lugares |
| 5 | IDOR: varios controllers no verifican que el recurso pertenezca al colegio del usuario | **Parcialmente resuelto — persiste en boletines** | `grupoController.js:84` y `docenteController.js:111-112` ya filtran por `colegio_id`. **`boletinController.js` sigue sin esa validación** en `getEstudiantesGrupo`, `getBoletinEstudiante` y `getPDFGrupo` — cualquier usuario autenticado puede pedir el boletín de un estudiante de otro colegio si adivina el ID. No existe middleware genérico; cada validación es manual y suelta |
| 6 | Marca "Playfesor" hardcodeada en ~28 archivos del frontend | **Cambió de forma — mecanismo creado, no aplicado al sitio real** | `deployment/PLAYFESOR_TEMPLATE/frontend/src/config/tema.js` ya permite nombre/colores por variable de entorno. Pero `frontend/` (el sitio en producción) no lo usa: `Sidebar.js:81-82` sigue con "Playfesor" literal y `:192,204` con los colores hardcodeados |
| 7 | `schema.sql` desincronizado de producción (`telefono_padres` faltante) | **Resuelto** | `database/schema.sql:37` ya incluye la columna, con comentario explicando el origen. Ya existe `database/migrations/` con 3 migraciones versionadas |
| 8 | Contraseña admin en texto plano dentro del schema | **Resuelto** | El seed ya no incluye contraseña de ejemplo; remite a `deployment/PLAYFESOR_TEMPLATE/scripts/crear-admin.js` |
| 9 | Cero tests | **Sigue igual** | Sin `*.test.js` reales en backend ni frontend. El frontend conserva las dependencias de testing de Create React App sin usarlas (boilerplate, no cobertura) |
| 10 | Sistema de planes/cobro — prioridad #1 según el adendum de julio | **Ya no aplica** | El proyecto adoptó single-tenant (`README.md:9`): cada colegio es una instalación independiente, sin necesidad de repartir funciones por plan de pago dentro de una misma base de datos |

---

## 2. LO QUE SE CONSTRUYÓ ESTE MES (más de lo que parece a primera vista)

- **`docs/`** — 15 documentos, prácticamente todos con contenido real y accionable (requerimientos, instalación paso a paso, configuración, hosting en cPanel, base de datos, SMTP, personalización, seguridad, backup, actualizaciones, versiones, manual de administrador, manual técnico, changelog). Solo `docs/INSTALADOR_DISENO.md` es honesto sobre ser una especificación de algo aún no construido.
- **`checklists/`** — checklist de implementación y de actualización (15 pasos), ambos con contenido real, no solo títulos.
- **`deployment/PLAYFESOR_TEMPLATE/`** — una copia separada de backend y frontend pensada como base limpia para instalar un colegio nuevo, con variables de personalización (`INSTITUCION_NOMBRE`, `INSTITUCION_DOMINIO`, colores) y un script (`aplicar-marca.js`) para aplicar logo/colores.
- **`database/migrations/`** — mecanismo de migraciones versionadas, ya usado 3 veces (incluye la columna que julio encontró desincronizada).
- **`releases/`** — versiones `v1.0.0`, `v1.1.0`, `v2.0.0` con changelog. (Nota: las tres están fechadas el mismo día, 14 de julio — son una reconstrucción retroactiva del historial, no lanzamientos escalonados; y cada carpeta de versión solo tiene el `CHANGELOG.md` en texto, no los archivos modificados ni los scripts SQL que el propio README de `releases/` dice que deberían incluirse.)

Esto es trabajo de fondo genuino, no solo carpetas vacías con buenas intenciones. El problema no es que falte esfuerzo — es que el mecanismo nuevo no se terminó de conectar con el sitio que hoy está en producción.

---

## 3. HALLAZGOS NUEVOS DE ESTA AUDITORÍA

1. **Nunca se probó una instalación completa bajo el modelo nuevo.** `deployment/CLIENTES/` está vacía, `versiones/registro_clientes.md` no tiene ningún colegio. El changelog de v2.0.0 admite explícitamente que falta "verificar `crear-admin.js` contra una BD real, y un login end-to-end completo". Instalar el primer colegio con este modelo va a sacar a la luz problemas que ninguna revisión de código va a encontrar antes.

2. **La plantilla no está tan des-marcada como dice el CHANGELOG.** El backend de `PLAYFESOR_TEMPLATE` todavía manda "Playfesor" en 8 archivos / 16 lugares: mensajes de WhatsApp a padres, pie de página y metadata de los PDF de boletines, y el system prompt del Tutor IA. Un colegio instalado hoy con la plantilla vería la marca de otro colegio en comunicaciones directas con padres y estudiantes.

3. **El drift entre schemas ya volvió a pasar, un día después de crear el mecanismo para evitarlo.** `database/schema.sql` (core) y `deployment/PLAYFESOR_TEMPLATE/database/schema.sql` (plantilla) están desincronizados: la plantilla no tiene las tablas `piar` ni `briefing_diario` que se agregaron al core el 15 de julio vía migración. Si hoy se instala un colegio nuevo con la plantilla, esas dos funciones no van a tener tabla donde guardar datos.

4. **Dos READMEs de carpetas contradicen el contenido real de su propia carpeta.** `docs/README.md` y `checklists/README.md` todavía dicen "esto se redacta en la Fase 4", cuando ambas carpetas ya tienen contenido completo. Es un detalle menor, pero es exactamente el tipo de inconsistencia que hace perder confianza en la documentación si alguien la lee antes que el contenido real.

5. **No hay control de versiones (git).** No existe carpeta `.git` en la raíz. El único historial es manual (`releases/` + `CHANGELOG.md`), sin la capacidad de comparar versiones línea por línea, revertir un cambio puntual, o recuperar una versión anterior de un archivo si algo sale mal.

---

## 4. QUÉ HACER A PARTIR DE AHORA (en orden de urgencia)

1. **Antes de vender o prometer una instalación nueva: hacer una instalación de prueba completa con `PLAYFESOR_TEMPLATE`, de cero, incluyendo `crear-admin.js` y login real.** Es el mayor riesgo abierto — todo lo demás en este informe es teoría hasta que esto se pruebe una vez.
2. **Sincronizar `deployment/PLAYFESOR_TEMPLATE/database/schema.sql` con `database/schema.sql`** (agregar `piar` y `briefing_diario`), y definir quién es responsable de mantenerlos sincronizados hacia adelante — si no, este mismo hallazgo va a reaparecer en la próxima auditoría.
3. **Terminar de quitar "Playfesor" del backend de la plantilla** (WhatsApp, PDF, Tutor IA) — son los 8 archivos que quedaron fuera del trabajo de des-marcado del frontend.
4. **Cerrar el hueco de boletines**: agregar la verificación de `colegio_id` que ya existe en `grupoController.js`/`docenteController.js` a `boletinController.js` — es el módulo que expone notas de estudiantes, el dato más sensible del sistema.
5. **Regenerar el `JWT_SECRET` real del sitio en producción** con `crypto.randomBytes(64).toString('hex')` — la guía ya existe en `docs/SEGURIDAD.md`, solo falta aplicarla.
6. **Decidir si vale la pena instalar `express-rate-limit`** (ya está en `node_modules` como dependencia transitiva) en vez de mantener el rate limiting artesanal en dos `Map()` separados — no es urgente, pero es barato de resolver ahora que ya se identificó dos veces.
7. **Corregir los dos READMEs desactualizados** (`docs/README.md`, `checklists/README.md`) — cinco minutos de trabajo, evita que alguien confíe menos en documentación que en realidad ya está completa.
8. Tests y control de versiones (git) siguen pendientes desde mayo. No son urgentes si el ritmo de cambios sigue siendo manual y de bajo volumen, pero cada mes que pasa sin ellos el costo de un error se vuelve más difícil de rastrear y revertir.

---

## 5. NO SE HA MODIFICADO NADA

Esta auditoría fue estrictamente de lectura. No se crearon carpetas nuevas, no se movieron archivos, no se tocó código, configuración ni base de datos.
