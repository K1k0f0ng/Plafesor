# Bienestar y Orientación — Mapa funcional (Fase 1)

Estado: **propuesta para aprobación** · Fecha: 2026-09-23 · Sin código implementado todavía.

Documento de diseño del módulo. Define qué hace, quién puede ver qué, qué datos guarda y cómo se
conecta con lo que Playfesor ya tiene. Las fases siguientes se construyen contra este documento.

> **Principio rector:** Playfesor es una herramienta de apoyo para la gestión de la orientación
> escolar. No diagnostica, no etiqueta y no reemplaza al orientador, al psicólogo, al docente, a la
> familia ni a un profesional de la salud. Ante una situación de riesgo inminente, el colegio activa
> su **Ruta de Atención Integral para la Convivencia Escolar** (Ley 1620 de 2013) por los canales
> institucionales; la plataforma solo registra que se hizo.

---

## 1. Decisiones aprobadas (Fase 0)

| # | Decisión |
|---|---|
| D1 | Nuevo rol de usuario **`orientador`** (Orientador / Psicólogo escolar). |
| D2 | El **director/rector** ve estados e indicadores, **nunca** el contenido de los casos. |
| D3 | El **admin** configura el módulo y ve indicadores agregados, **nunca** notas ni contenido de casos. |
| D4 | Se monta un **entorno de pruebas (staging)** antes de guardar datos reales. |
| D5 | Todo el **texto libre sensible se guarda cifrado** (AES-256-GCM). |
| D6 | El módulo arranca **apagado** en todos los colegios; se activa colegio por colegio (piloto primero). |
| D7 | La IA trabaja con **datos seudonimizados**, nunca diagnostica y solo produce **borradores**. |

---

## 2. Actores y permisos

### 2.1 Quiénes participan

| Actor | Cómo se identifica en Playfesor |
|---|---|
| Orientador líder | `usuarios.rol = 'orientador'` + `bienestar_equipo.nivel = 'lider'` |
| Orientador profesional | `usuarios.rol = 'orientador'` + `bienestar_equipo.nivel = 'profesional'` |
| Docente | `rol = 'docente'` (el colegio decide si todos pueden remitir o solo directores de grupo) |
| Director / Rector | `rol = 'director'` |
| Admin | `rol = 'admin'` |
| Familia | `rol = 'padre'` vinculado en `padre_estudiante` |
| Estudiante | `rol = 'estudiante'` (sin acceso en V1) |

Un colegio puede tener varios orientadores. Si solo hay uno, es líder automáticamente.

### 2.2 Matriz de permisos (se valida en el servidor, no solo en pantalla)

| Acción | Docente | Orientador profesional | Orientador líder | Director | Admin | Familia |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Crear remisión | ✅ ¹ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver **sus propias** remisiones (estado simplificado) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver bandeja de remisiones del colegio | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Recibir / tomar una remisión | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver casos | ❌ | Solo asignados | Todos | Solo estado ² | ❌ | ❌ |
| Abrir, reasignar, cerrar casos | ❌ | Abrir/cerrar los suyos | ✅ | ❌ | ❌ | ❌ |
| Registrar seguimientos, planes, compromisos | ❌ | En sus casos | ✅ | ❌ | ❌ | ❌ |
| Ver **nota privada** de un seguimiento | ❌ | Autor + asignados al caso | Configurable ³ | ❌ | ❌ | ❌ |
| Agenda de orientación | ❌ | La suya | Todo el equipo | ❌ | ❌ | ❌ |
| Registrar contacto con familia | ❌ | En sus casos | ✅ | ❌ | ❌ | ❌ |
| Ver lo marcado "visible para la familia" | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ ⁴ |
| Señales tempranas | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Indicadores agregados | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Asistente IA | ❌ | En sus casos | ✅ | ❌ | ❌ | ❌ |
| Configurar módulo y equipo | ❌ | ❌ | Catálogos | ❌ | ✅ | ❌ |
| Ver bitácora de accesos del módulo | ❌ | ❌ | ✅ | ❌ | ✅ (sin contenido) | ❌ |

¹ Según configuración: *todos los docentes* o *solo directores de grupo*.
² El director ve "estudiante X tiene un caso **en seguimiento** desde fecha Y, responsable Z", sin motivo ni contenido.
³ Por defecto el líder **no** lee notas privadas ajenas; el colegio puede habilitarlo (supervisión).
⁴ Solo si el colegio activó "Portal de familia para orientación" y solo lo marcado explícitamente.

### 2.3 Reglas transversales

1. El colegio del usuario **siempre** se toma de la sesión, nunca de la URL ni del formulario.
2. Todo registro del módulo lleva `colegio_id` y cada consulta filtra por él.
3. Si el módulo está apagado o la verificación de permisos falla por error técnico → **se bloquea**
   (a diferencia del control actual de módulos, que deja pasar).
4. Ningún contenido del módulo se escribe en `anotaciones`, `citaciones`, `observaciones_periodo`
   ni en la `auditoria` general — todas son visibles para otros roles o la familia.

---

## 3. Flujo central

```
SEÑAL (automática, solo orientación la ve)          REMISIÓN (docente/director)
        │  "revisar"                                          │
        └──────────────┬──────────────────────────────────────┘
                       ▼
               BANDEJA DE ORIENTACIÓN  ── descartar (con motivo) ──► archivada
                       │ recibir
                       ▼
        ¿El estudiante ya tiene un caso abierto?
             │ sí → se vincula al caso        │ no → APERTURA DE CASO
                       ▼
               VALORACIÓN PROFESIONAL (seguimiento tipo "valoración inicial")
                       ▼
               PLAN DE ACOMPAÑAMIENTO (opcional) ──► acciones + compromisos
                       ▼
               SEGUIMIENTOS / CITAS / CONTACTOS CON FAMILIA
                       ▼
               EVALUACIÓN ──► CIERRE (motivo de cierre) ──► archivo
```

**Regla:** un estudiante tiene **como máximo un caso abierto**. Nuevas remisiones se agregan a ese caso.

---

## 4. Módulos funcionales

### 4.1 Dashboard de orientación (orientador)

Tarjetas: remisiones pendientes · casos activos · seguimientos de esta semana · citas de hoy y
próximas · planes activos · compromisos vencidos · señales nuevas.
Listas: "Requiere atención hoy" (urgentes, compromisos vencidos, citas del día) y "Remisiones recientes".
Gráficos: casos abiertos vs. cerrados por mes · distribución por grado (agregado).

### 4.2 Remisiones

**Formulario (docente/director):** estudiante (solo de sus grupos, o del colegio para director) ·
grupo (automático) · motivo (catálogo del colegio) · descripción de lo observado · prioridad ·
observaciones · evidencias (adjuntos opcionales, si el colegio lo permite) · casilla
"informé/no he informado a la familia".

Aviso fijo en el formulario:
> Describe **hechos observados**, no conclusiones ("no entregó tareas en 3 semanas", no "está
> deprimido"). Si hay riesgo inminente para el estudiante, activa de inmediato la ruta de atención
> del colegio; esta remisión no la reemplaza.

**Prioridades:** baja · media · alta · urgente (urgente notifica de inmediato a todo el equipo).

**Estados internos y lo que ve el remitente:**

| Estado interno | Lo que ve el docente |
|---|---|
| `pendiente` | Enviada |
| `recibida` | Recibida por orientación |
| `en_revision` | En atención |
| `en_seguimiento` | En atención |
| `cerrada` | Atendida |
| `archivada` | Atendida |

El docente nunca ve quién la atiende en detalle (salvo que el colegio lo permita), ni el caso, ni seguimientos.
Opcional (configurable): orientación puede enviar al docente una **devolución** breve y no
confidencial ("Se inició acompañamiento. Sugerencia para el aula: …").

### 4.3 Casos

Campos: estudiante · responsable · prioridad · estado · motivo (catálogo) · detalle del motivo ·
antecedentes relevantes · fecha de apertura · fecha de cierre · motivo de cierre.
Estados: `abierto` · `en_seguimiento` · `cerrado` · `archivado`.
Motivos de cierre (catálogo): objetivos cumplidos · remitido a entidad externa · retiro del
estudiante · sin continuidad de la familia · otro.

**Vista del caso = línea de tiempo** con todo en orden: remisiones, apertura, seguimientos, planes,
compromisos, citas, contactos con familia, reasignaciones y cierre. Pestañas: Resumen · Seguimientos ·
Plan · Citas · Familia · Asistente IA.

Contexto de solo lectura en la ficha del caso (tomado de Playfesor, sin copiar datos): grado y grupo ·
promedio actual y tendencia · asistencia últimos 30 días · nivel de riesgo académico · "tiene PIAR: sí/no"
(sin contenido) · número de anotaciones de mejora recientes.

### 4.4 Seguimientos (incluye sesiones)

Una sola entidad con tipo (evita duplicar "sesiones" y "seguimientos"):

Tipos (catálogo): valoración inicial · sesión con estudiante · reunión con familia · reunión con
docentes · seguimiento telefónico · observación en aula · otro.

Campos: fecha y hora · tipo · participantes · motivo · **resumen profesional** (visible al equipo del
caso) · acuerdos · compromisos (se crean como registros) · próxima acción · próxima fecha ·
**nota privada** (solo autor y asignados; ver matriz).

Si se indica "próxima fecha", se ofrece crear la cita en la agenda.

### 4.5 Compromisos

Descripción · responsable (estudiante / familia / docente / orientación / otro) · fecha límite ·
estado (`pendiente` · `cumplido` · `incumplido` · `cancelado`) · visible para la familia (sí/no).
Los vencidos aparecen en el dashboard.

### 4.6 Plan de acompañamiento

Objetivo · situación identificada (redactada como hechos) · fecha inicial · fecha objetivo ·
indicadores de seguimiento · estado (`activo` · `en_seguimiento` · `cumplido` · `cerrado` · `suspendido`).
Acciones del plan: acción · responsable · fecha · estado. Compromisos vinculados.
Un caso puede tener varios planes en el tiempo, pero solo uno activo.

### 4.7 Agenda de orientación

Tipos (catálogo): cita con estudiante · reunión con familia · reunión con docentes · seguimiento.
Acciones: crear · modificar · reprogramar (guarda la fecha anterior) · cancelar (con motivo) ·
marcar asistencia (`asistio` · `no_asistio` · `llego_tarde`) · registrar resultado (crea un seguimiento).
Estados: `programada` · `realizada` · `no_asistio` · `cancelada` · `reprogramada`.
Vistas: día · semana · lista. Visible solo para el equipo de orientación.
**No usa la Agenda Institucional** (esa es visible por roles).

### 4.8 Comunicaciones con familias

Tipo (llamada · reunión · mensaje · correo · citación · seguimiento) · fecha · acudiente (de
`padre_estudiante`, o texto si no tiene cuenta) · responsable · motivo · resultado · compromisos ·
visible para la familia (sí/no).
Enlaces opcionales a lo existente: si se envía una **citación** o un **mensaje interno**, se registra
aquí la referencia. El texto que recibe la familia lo redacta el orientador; nunca se envía el contenido del caso.

### 4.9 Señales tempranas

Calculadas cada día (se suma al proceso nocturno existente), **solo con datos que Playfesor ya tiene**:

| Señal | Regla inicial (ajustable por colegio en V2) |
|---|---|
| Riesgo académico sostenido | Nivel alto o crítico en 2 o más materias (Motor de Riesgo) |
| Descenso académico | Promedio de los últimos 30 días ≥ 0,7 puntos por debajo de los 30 anteriores |
| Aumento de inasistencias | 3 o más ausencias no justificadas en 30 días, o +50 % frente al mes anterior |
| Anotaciones de mejora | 3 o más en 30 días |
| Incumplimiento académico | 5 o más actividades vencidas sin entregar |
| Acumulación | 3 o más señales distintas activas a la vez |

Texto único y neutral para todas: *"Se recomienda revisar la evolución del estudiante debido a cambios
recientes registrados en el sistema: [lista de hechos con números]."*
Acciones del orientador: **revisar** → **remitir/abrir caso** o **descartar** (con motivo). Una señal
descartada no reaparece durante 30 días salvo que empeore.
Solo el equipo de orientación ve las señales. No hay puntaje psicológico ni etiqueta.

### 4.10 Indicadores y reportes

Solo cifras agregadas: remisiones por periodo · por motivo · por grado · casos activos/cerrados ·
tiempo promedio de respuesta (remisión → recibida) · tiempo promedio de atención (apertura → cierre) ·
planes activos/cumplidos · asistencia a citas · compromisos cumplidos.
**Protección de identidad:** cualquier celda con menos de 5 estudiantes se muestra como "< 5".
Exportación: solo indicadores agregados a Excel, registrada en la bitácora. **No existe exportación
masiva de casos ni de notas.** Un caso individual se puede imprimir (PDF) solo por su responsable, y queda registrado.

### 4.11 Configuración del colegio (admin; catálogos también el líder)

- Módulo activo / inactivo.
- Equipo de orientación y nivel (líder / profesional).
- Quién puede remitir: todos los docentes / solo directores de grupo.
- Devolución al docente: activada / desactivada.
- El líder puede leer notas privadas de otros: sí / no (por defecto **no**).
- Portal de familia para orientación: activado / desactivado (por defecto **desactivado**).
- Adjuntos en remisiones: permitidos / no.
- Asistente IA: activado / desactivado.
- Catálogos: motivos de remisión, tipos de seguimiento, tipos de cita, tipos de contacto, motivos de cierre.
- Notificaciones del módulo por tipo.

---

## 5. Modelo de datos

Convenciones del proyecto: `INT AUTO_INCREMENT`, InnoDB, `utf8mb4`, nombres en español, `creado_en`,
`actualizado_en`. Se reutilizan `usuarios`, `grupos`, `estudiante_grupos`, `padre_estudiante`,
`colegios`. 🔒 = columna cifrada (texto libre sensible; no se puede buscar por su contenido).

| Tabla | Columnas principales |
|---|---|
| `bienestar_configuracion` | `colegio_id` PK · `activo` · `remiten` ENUM(todos,directores_grupo) · `devolucion_docente` · `lider_lee_privadas` · `portal_familia` · `adjuntos_remision` · `ia_activa` · `umbrales` JSON |
| `bienestar_catalogos` | `id` · `colegio_id` · `tipo` ENUM(motivo_remision, tipo_seguimiento, tipo_cita, tipo_contacto, motivo_cierre) · `nombre` · `activo` · `orden` |
| `bienestar_equipo` | `usuario_id` · `colegio_id` · `nivel` ENUM(lider,profesional) · `activo` — PK(usuario_id, colegio_id) |
| `bienestar_remisiones` | `id` · `colegio_id` · `estudiante_id` · `grupo_id` · `remitente_id` · `motivo_id` · 🔒`descripcion` · 🔒`observaciones` · `prioridad` · `familia_informada` · `estado` · `caso_id` NULL · `recibida_por` · `recibida_en` · 🔒`devolucion` · `origen` ENUM(docente,senal) |
| `bienestar_adjuntos` | `id` · `colegio_id` · `remision_id` NULL · `caso_id` NULL · `archivo_ruta` (archivo **cifrado** en `uploads_privados/bienestar/`) · 🔒`nombre_original` · `tipo_mime` · `tamano` · `subido_por` |
| `bienestar_casos` | `id` · `colegio_id` · `estudiante_id` · `responsable_id` · `prioridad` · `estado` · `motivo_id` · 🔒`motivo_detalle` · 🔒`antecedentes` · `abierto_en` · `cerrado_en` · `motivo_cierre_id` · 🔒`cierre_detalle` |
| `bienestar_caso_asignaciones` | `id` · `caso_id` · `usuario_id` · `desde` · `hasta` NULL · `asignado_por` |
| `bienestar_seguimientos` | `id` · `caso_id` · `colegio_id` · `autor_id` · `fecha` · `tipo_id` · `participantes` JSON · 🔒`motivo` · 🔒`resumen` · 🔒`acuerdos` · 🔒`proxima_accion` · `proxima_fecha` · 🔒`nota_privada` |
| `bienestar_compromisos` | `id` · `caso_id` · `seguimiento_id` NULL · `plan_id` NULL · 🔒`descripcion` · `responsable_tipo` · `fecha_limite` · `estado` · `visible_familia` |
| `bienestar_planes` | `id` · `caso_id` · 🔒`objetivo` · 🔒`situacion` · `fecha_inicio` · `fecha_objetivo` · 🔒`indicadores` · `estado` · `creado_por` |
| `bienestar_plan_acciones` | `id` · `plan_id` · 🔒`accion` · `responsable` · `fecha` · `estado` |
| `bienestar_citas` | `id` · `colegio_id` · `caso_id` NULL · `estudiante_id` · `profesional_id` · `tipo_id` · `inicio` · `fin` · `lugar` · `participantes` JSON · `estado` · `asistencia` · `reprogramada_de` NULL · 🔒`motivo_cancelacion` · `seguimiento_id` NULL |
| `bienestar_contactos_familia` | `id` · `caso_id` · `estudiante_id` · `acudiente_id` NULL · `acudiente_texto` · `tipo_id` · `fecha` · `responsable_id` · 🔒`motivo` · 🔒`resultado` · `visible_familia` · `citacion_id` NULL · `mensaje_id` NULL |
| `bienestar_senales` | `id` · `colegio_id` · `estudiante_id` · `tipos` JSON (solo códigos y números) · `estado` ENUM(nueva, revisada, descartada, remitida) · `revisada_por` · 🔒`motivo_descarte` · `detectada_en` · `silenciada_hasta` |
| `bienestar_auditoria` | `id` · `colegio_id` · `usuario_id` · `usuario_rol` · `accion` · `recurso` · `recurso_id` · `caso_id` · `ip` · `creado_en` — **nunca contenido** |

Cambio a tabla existente: `usuarios.rol` agrega el valor `'orientador'` (no afecta a los usuarios existentes).
Índices: `(colegio_id, estado)` en remisiones y casos; `(caso_id, fecha)` en seguimientos; `(profesional_id, inicio)` en citas.

**Cifrado:** AES-256-GCM con la librería nativa de Node. Clave `BIENESTAR_CLAVE_CIFRADO` en el `.env`
del servidor (nunca en el código ni en Git). Si la clave se pierde, los textos cifrados no se recuperan:
se guarda una copia en un gestor de contraseñas del dueño de la plataforma.

---

## 6. API (todas bajo `/api/bienestar`, con sesión + módulo activo + permiso)

| Método y ruta | Quién |
|---|---|
| `GET /estado` — ¿módulo activo?, mi nivel en el equipo | todos los roles del colegio |
| `POST /remisiones` · `GET /remisiones/mias` | docente, director, orientador |
| `GET /remisiones` · `PATCH /remisiones/:id/recibir` · `PATCH /remisiones/:id/descartar` · `PATCH /remisiones/:id/devolucion` | orientador |
| `GET /casos` · `POST /casos` · `GET /casos/:id` · `PATCH /casos/:id` · `POST /casos/:id/asignar` · `POST /casos/:id/cerrar` | orientador (según nivel) |
| `GET /casos/:id/linea-tiempo` | orientador del caso |
| `GET /estudiantes/:id/estado-caso` | director (solo estado) |
| `POST /casos/:id/seguimientos` · `PATCH /seguimientos/:id` · `GET /seguimientos/:id/nota-privada` | orientador del caso (la nota privada es un endpoint aparte y siempre queda en bitácora) |
| `POST /casos/:id/compromisos` · `PATCH /compromisos/:id` | orientador del caso |
| `POST /casos/:id/planes` · `PATCH /planes/:id` · `POST /planes/:id/acciones` · `PATCH /plan-acciones/:id` | orientador del caso |
| `GET /citas` · `POST /citas` · `PATCH /citas/:id` · `POST /citas/:id/reprogramar` · `POST /citas/:id/cancelar` · `POST /citas/:id/asistencia` | orientador |
| `POST /casos/:id/contactos-familia` · `PATCH /contactos-familia/:id` | orientador del caso |
| `GET /familia/:estudianteId` | padre vinculado (solo lo visible, solo si el portal está activo) |
| `GET /senales` · `PATCH /senales/:id` | orientador |
| `GET /indicadores` · `GET /indicadores/exportar` | orientador, director, admin |
| `POST /ia/:casoId` — acción: resumen, avances, redactar, patrones, sugerencias | orientador del caso |
| `GET /configuracion` · `PUT /configuracion` · `PUT /equipo` · catálogos CRUD | admin (catálogos también líder) |
| `GET /auditoria` | orientador líder, admin (sin contenido) |

Validación en cada endpoint: tipos y longitudes, valores de catálogo del mismo colegio, estudiante del
mismo colegio, textos saneados. Errores genéricos al cliente, detalle solo en el log del servidor.

---

## 7. Notificaciones (reusa `notificaciones` y la campanita)

Nunca incluyen motivo, descripción ni diagnóstico. El nombre del estudiante solo aparece en
notificaciones dirigidas al equipo de orientación.

| Evento | Para | Texto |
|---|---|---|
| Nueva remisión | Equipo de orientación | "Hay una nueva remisión pendiente de revisión." (urgente: "Remisión **urgente** pendiente de revisión.") |
| Remisión recibida | Remitente | "Tu remisión fue recibida por orientación." |
| Devolución disponible | Remitente | "Orientación dejó una devolución sobre tu remisión." |
| Caso asignado | Orientador | "Se te asignó un caso." |
| Resumen semanal (lunes 7 am) | Cada orientador | "Tienes N seguimientos y M citas programadas esta semana." |
| Compromiso vencido | Responsable del caso | "Hay compromisos vencidos en uno de tus casos." |
| Cita programada | Familia (solo si el portal está activo y la cita es visible) | "Tienes una cita con orientación el [fecha]." |

WhatsApp: **desactivado** para este módulo en V1. Un mensaje de WhatsApp sale de la plataforma y puede
verlo cualquiera con el teléfono del acudiente.

---

## 8. Asistente IA de Orientación

| Función | Qué recibe la IA | Qué devuelve |
|---|---|---|
| Resumen cronológico del caso | Fechas, tipos y resúmenes profesionales **seudonimizados** | Borrador de resumen |
| Resumen de avances | Seguimientos y compromisos del periodo elegido | Borrador |
| Ayuda de redacción | Lo que el orientador escribe + tipo de documento (informe, compromiso, comunicación a familia, plan) | Borrador redactado |
| Patrones administrativos | **Conteos calculados por Playfesor** (no por la IA): ausencias, notas, entregas en 60 días | Frase descriptiva de esos números |
| Sugerencias de seguimiento | Fechas y estados de compromisos y citas | Sugerencias operativas ("podría ser útil programar…") |

**Protecciones:**
1. **Seudonimización:** el nombre se reemplaza por "el estudiante", otros nombres por "Docente 1" o
   "Acudiente 1"; se eliminan documentos, teléfonos, correos y direcciones antes de enviar.
2. **Notas privadas excluidas** de la IA por defecto.
3. **Instrucción fija al modelo:** no diagnosticar, no nombrar condiciones clínicas, describir solo hechos
   registrados y recomendar revisión profesional.
4. **Filtro de salida:** si la respuesta contiene términos clínicos (lista mantenida: depresión, ansiedad,
   TDAH, trastorno, autismo, bipolar, etc.) se descarta y se regenera; si vuelve a ocurrir, se muestra un
   aviso y no se entrega el texto.
5. **Siempre es borrador:** el texto no se guarda en el caso hasta que el orientador lo revise y lo acepte.
6. **Bitácora:** se registra que se usó la IA (acción, caso, usuario), nunca el texto.
7. Límite de uso por minuto (reusa el limitador existente) y se puede apagar por colegio.

---

## 9. Bitácora del módulo (`bienestar_auditoria`)

Se registra: ver caso · ver nota privada · crear, editar o cerrar remisión, caso, seguimiento o plan ·
reasignar · cambiar configuración o equipo · usar la IA · exportar indicadores · imprimir un caso ·
intento de acceso denegado.
Campos: usuario, rol, fecha y hora, acción, recurso, id, caso, IP. **Nunca el contenido.**
La IP real requiere que el servidor la reciba detrás del proxy de cPanel; se verifica en la Fase 2.

---

## 10. Navegación ("Bienestar y Orientación" en el menú lateral)

| Rol | Opciones |
|---|---|
| Orientador | Dashboard · Remisiones · Casos · Seguimientos · Planes · Agenda · Familias · Señales · Indicadores · Configuración (catálogos, solo líder) |
| Docente | Remitir a orientación · Mis remisiones |
| Director | Remitir a orientación · Mis remisiones · Indicadores de bienestar |
| Admin | Indicadores de bienestar · Configuración de bienestar |
| Familia | "Orientación" dentro del portal (solo si está activo y hay algo visible) |

Pantalla inicial del orientador al iniciar sesión: Dashboard de orientación.
Todo el módulo usa el mismo marco visual (menú ☰, tarjetas, colores y tipografía de Playfesor) y
funciona en computador, tablet y celular.

---

## 11. Alcance por versión

| V1 (este proyecto) | V2 (después del piloto) |
|---|---|
| Todo lo descrito arriba | Umbrales de señales editables por colegio |
| | Autorremisión del estudiante ("quiero hablar con orientación") |
| | Recordatorios de citas a familias por correo |
| | Plantillas de documentos del colegio |
| | Comité de Convivencia (Ley 1620): actas y casos tipo I, II, III |

---

## 12. Tareas previas a la Fase 2

1. Subir el lote pendiente (menú ☰, reactivar padres, editar calificaciones) y validarlo.
2. Corregir la fuga entre colegios en `GET /api/asistencias/alertas/colegio/:id` (y el listado de periodos).
3. Crear el entorno de pruebas `staging.playfesor.co` con su propia base de datos.
4. Generar y guardar la clave de cifrado.

## 13. Pendiente de validar fuera de lo técnico

- Revisión legal de textos de consentimiento, tiempos de conservación y tratamiento de datos
  sensibles de menores (Ley 1581 de 2012 / Decreto 1377 de 2013), y del manejo de registros del
  psicólogo (Ley 1090 de 2006).
- Validación del flujo con un orientador real del colegio piloto.
