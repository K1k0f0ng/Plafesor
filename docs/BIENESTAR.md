# Bienestar y Orientación — Documentación técnica

Diseño funcional completo: [`BIENESTAR_MAPA_FUNCIONAL.md`](BIENESTAR_MAPA_FUNCIONAL.md).
Este documento describe lo que **ya está implementado** y cómo operarlo.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Auditoría | ✅ |
| 1 | Mapa funcional | ✅ |
| 2 | Base segura: tablas, rol, cifrado, acceso, bitácora, configuración | ✅ implementada, pendiente de desplegar |
| 3 | Remisiones: formulario, mis remisiones, bandeja del equipo, notificaciones | ✅ implementada, pendiente de desplegar |
| 4 | Casos, seguimientos (con nota privada), compromisos, línea de tiempo, adjuntos cifrados, vista de estado del director | ✅ implementada, pendiente de desplegar |
| 5 | Planes de acompañamiento | Pendiente |
| 6 | Agenda y familias | Pendiente |
| 7 | Señales tempranas | Pendiente |
| 8 | Dashboard e indicadores | Pendiente |
| 9 | Asistente IA | Pendiente |
| 10 | QA integral y despliegue | Pendiente |

## Instalación

1. **Migración:** ejecutar `database/migrations/2026-09-24_bienestar_orientacion.sql`. Agrega el
   valor `orientador` al rol de `usuarios` y crea las tablas `bienestar_*`. No borra ni modifica datos.
2. **Clave de cifrado:** agregar al `.env` del backend
   ```
   BIENESTAR_CLAVE_CIFRADO=<64 caracteres hexadecimales>
   ```
   Generarla una sola vez con
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   **Guardar una copia en un gestor de contraseñas.** Si se pierde, el texto cifrado no se recupera.
   Si se cambia, lo cifrado con la clave anterior deja de poder leerse.
3. Reiniciar el backend.

Sin la clave el módulo no se puede activar (el backend lo impide).

## Puesta en marcha en un colegio

1. Admin → **Usuarios del Sistema** → crear la cuenta con rol **Orientador / Psicólogo**.
2. Admin → **Configuración de bienestar** → marcar al orientador en el equipo, nivel **Líder** → *Guardar equipo*.
3. Ajustar opciones y catálogos → **Activar el módulo**.

## Seguridad implementada

| Control | Dónde |
|---|---|
| Colegio tomado siempre de la sesión | `middlewares/bienestarAcceso.js` |
| Bloqueo ante error técnico (fail-closed) | `cargarContextoBienestar` responde 503 |
| Módulo apagado por defecto | sin fila en `bienestar_configuracion` = apagado |
| Solo equipo de orientación accede a casos | `requiereEquipo`, `casoAccesible` (admin, director y docente nunca) |
| Texto sensible cifrado AES-256-GCM | `utils/cifrado.js` |
| Bitácora sin contenido, con IP | `utils/bienestarAuditoria.js` → `bienestar_auditoria` |
| Accesos denegados registrados | `requiereEquipo` |

**Riesgo residual conocido:** quien administra cuentas (admin, director) puede cambiar el correo de un
orientador y luego restablecer su contraseña. Queda registrado en la auditoría general
(`personal_editado`). Mitigación futura: avisar por correo al orientador cuando cambie su correo.

**IP:** se toma de `X-Forwarded-For` (detrás del proxy de cPanel `req.ip` es local). El cliente puede
falsear ese encabezado; es un dato de referencia, no una prueba.

## API implementada (Fase 2)

Base: `/api/bienestar`. Todas requieren sesión.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /estado` | cualquier rol | ¿módulo activo?, nivel en el equipo, ¿puede remitir? (al admin además: ¿clave configurada?) |
| `GET /configuracion` | admin | configuración, orientadores del colegio y si la clave está configurada |
| `PUT /configuracion` | admin | guarda opciones; activar exige clave + un líder. La primera vez crea los catálogos iniciales |
| `PUT /equipo` | admin | `{ miembros: [{ usuario_id, en_equipo, nivel }] }` — solo cuentas `orientador` del colegio |
| `GET /catalogos?tipo=` | admin, equipo; docente/director solo con módulo activo (y solo opciones activas) | catálogos |
| `POST /catalogos` · `PATCH /catalogos/:id` | admin, líder | agregar / renombrar / activar-desactivar (no se borran) |
| `GET /auditoria?pagina=` | admin, líder | bitácora del módulo, 50 por página |

## API implementada (Fase 3 — Remisiones)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /remisiones/estudiantes` | quien puede remitir | estudiantes a los que puede remitir, con su grupo actual (docente: sus grupos o solo el dirigido, según config) |
| `POST /remisiones` | quien puede remitir | `{ estudiante_id, motivo_id, prioridad, descripcion, observaciones?, familia_informada? }` — texto cifrado; notifica al equipo (urgente con aviso propio) |
| `GET /remisiones/mias` | docente, director, orientador | sus remisiones con estado simplificado (enviada · recibida · en_atencion · atendida); devolución solo si el colegio la habilitó |
| `GET /remisiones?estado=` | equipo | bandeja. Líder: todas. Profesional: pendientes + las que recibió + las de sus casos |
| `GET /remisiones/:id` | equipo (misma regla) | detalle descifrado; queda en bitácora |
| `PATCH /remisiones/:id/recibir` | equipo | pendiente → recibida (a prueba de doble recepción); notifica al remitente |
| `PATCH /remisiones/:id/revision` | equipo | recibida → en_revision |
| `PATCH /remisiones/:id/archivar` | equipo | `{ motivo }` — cerrar sin abrir caso |
| `PATCH /remisiones/:id/devolucion` | equipo, si el colegio la habilitó | `{ texto }` — nota no confidencial al remitente; lo notifica |

Quién puede remitir: director siempre; orientador del equipo; docente si `remiten = todos`, o solo
si dirige grupo cuando `remiten = directores_grupo`. Todo con el módulo activo.

## API implementada (Fase 4 — Casos)

Acceso a un caso (`casoAccesible`): líder → todos los del colegio; profesional → responsable o
asignado vigente. Admin, director y docente nunca. Regla: un solo caso abierto por estudiante.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /casos?estado=abiertos\|cerrado\|todos` | equipo | lista con responsable, último seguimiento y compromisos vencidos |
| `POST /casos` | equipo | `{ estudiante_id, remision_id?, motivo_id, prioridad, motivo_detalle?, antecedentes?, responsable_id? }` — el profesional solo a su nombre; 409 con `caso_id` si ya hay uno abierto |
| `POST /remisiones/:id/vincular` | equipo | `{ caso_id }` agrega la remisión al caso abierto del estudiante |
| `GET /casos/:id` | con acceso al caso | caso + contexto académico + seguimientos + compromisos + remisiones + asignaciones + adjuntos. **Nunca** el texto de notas privadas |
| `PATCH /casos/:id` | con acceso, caso abierto | prioridad, estado (abierto/en_seguimiento), motivo, textos |
| `POST /casos/:id/asignar` | líder | `{ usuario_id }` cambia responsable (historial en `bienestar_caso_asignaciones`) |
| `POST /casos/:id/cerrar` | con acceso | `{ motivo_cierre_id, cierre_detalle? }` — cierra también sus remisiones |
| `POST /casos/:id/reabrir` | líder | si el estudiante no tiene otro caso abierto |
| `POST /casos/:id/seguimientos` | con acceso, caso abierto | `{ fecha, tipo_id, participantes[], motivo, resumen*, acuerdos, proxima_accion, proxima_fecha, nota_privada, compromisos[] }` |
| `PATCH /seguimientos/:id` | solo el autor | edita su seguimiento |
| `GET /seguimientos/:id/nota-privada` | autor, responsable o asignado; líder solo si `lider_lee_privadas` | siempre queda en bitácora |
| `POST /casos/:id/compromisos` · `PATCH /compromisos/:id` | con acceso, caso abierto | estado, texto, fecha, visible para la familia |
| `POST /casos/:id/adjuntos` | con acceso, caso abierto | multipart `archivos` (máx. 5 × 5 MB; PDF, imagen, Word, Excel) |
| `POST /remisiones/:id/adjuntos` | el remitente, remisión pendiente, si `adjuntos_remision` | evidencias de la remisión |
| `GET /adjuntos/:id/descargar` | con acceso (remitente: solo lo que él subió) | descifra y descarga; queda en bitácora |
| `GET /equipo/miembros` | equipo | para reasignar |
| `GET /acompanamientos` | director | estudiantes en acompañamiento, desde cuándo y responsable. **Sin motivo ni contenido** |

**Adjuntos:** se cifran en memoria antes de escribirse en `backend/uploads_privados/bienestar/<colegio>/`
con nombre aleatorio; el nombre original va cifrado en la base. Aunque alguien descargara el
archivo del servidor, sin la clave no puede leerlo. **Respaldar esa carpeta junto con la base de datos.**

## Frontend

| Ruta | Rol | Archivo |
|---|---|---|
| `/bienestar` | orientador (pantalla de inicio al entrar) | `pages/bienestar/BienestarInicio.js` |
| `/bienestar/configuracion` | admin | `pages/bienestar/ConfiguracionBienestar.js` |
| `/bienestar/remitir` | docente, director, orientador | `pages/bienestar/RemitirOrientacion.js` |
| `/bienestar/mis-remisiones` | docente, director, orientador | `pages/bienestar/MisRemisiones.js` |
| `/bienestar/remisiones` | orientador del equipo | `pages/bienestar/RemisionesBandeja.js` (abrir caso / vincular / ver caso) |
| `/bienestar/casos` | orientador del equipo | `pages/bienestar/Casos.js` + `AbrirCasoModal.js` |
| `/bienestar/casos/:id` | orientador con acceso | `pages/bienestar/CasoDetalle.js` + `caso/LineaTiempo.js`, `caso/Seguimientos.js`, `caso/Compromisos.js`, `caso/Documentos.js` |
| `/bienestar/acompanamientos` | director | `pages/bienestar/AcompanamientosDirector.js` |

El menú lateral muestra "Remitir a orientación" y "Mis remisiones" solo si el módulo está activo
y la persona puede remitir (consulta `GET /estado`).

## Pruebas automáticas

`cd backend && npx jest` — incluye `utils/cifrado.test.js`, `middlewares/bienestarAcceso.test.js`,
`controllers/bienestar/configuracionController.test.js` (docente/admin/director/padre sin acceso a
casos, otro colegio sin acceso, bloqueo ante error, no activar sin clave ni líder, etc.).
