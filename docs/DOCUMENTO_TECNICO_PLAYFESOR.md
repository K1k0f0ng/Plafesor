# Documento técnico de Playfesor

## 1. Introducción

Playfesor es una plataforma educativa diseñada para colegios colombianos con una arquitectura de múltiples instalaciones independientes. Cada institución opera sobre su propia base de datos, configuración, branding (logo, colores, nombre), usuarios, respaldos y módulos habilitados. La solución está compuesta por un backend en Node.js + Express, un frontend en React y una base de datos relacional MySQL/MariaDB.

Este documento tiene un propósito técnico: describir qué hace el sistema, cuál es su estructura funcional por módulos y cómo está organizado para que, en una segunda etapa, se pueda convertir en un manual de usuario claro y accesible.

> Importante: este documento no reemplaza el manual de usuario. Es una base técnica para comprender la lógica del producto antes de redactar guías operativas para directivos, docentes, estudiantes y acudientes.

---

## 2. Objetivo del sistema

Playfesor busca centralizar la operación académica y administrativa de una institución educativa en una sola plataforma, cubriendo desde la gestión institucional básica hasta la trazabilidad académica, la comunicación escolar, la evaluación docente, la observación del riesgo académico, la mensajería, los reportes y la asistencia de IA.

El sistema está orientado a:

- Administrar la vida académica del colegio.
- Dar soporte operativo a directivos y administradores.
- Apoyar a docentes en la planeación, evaluación y seguimiento.
- Facilitar la comunicación con estudiantes, padres y familias.
- Proporcionar dashboards y analítica institucional.
- Automatizar tareas con inteligencia artificial orientada a gestión educativa.
- Mantener trazabilidad y auditoría de acciones sensibles.

---

## 3. Alcance funcional

El producto contiene varios dominios funcionales que se conectan entre sí:

1. Administración institucional y configuración.
2. Gestión de personal, docentes y áreas académicas.
3. Gestión de grupos, salones, grados y materias.
4. Matrícula y seguimiento de estudiantes.
5. Gestión de actividades, evaluaciones y calificaciones.
6. Asistencia, observación académica y riesgo.
7. Comunicación y mensajería interna.
8. Planeación y mejoramiento institucional.
9. Reportes, analítica y comparativas.
10. IA para rectoría, docente, estudiante, observación y alertas.
11. Auditoría y trazabilidad.
12. Administración de módulos por colegio.

---

## 4. Arquitectura del sistema

### 4.1 Arquitectura lógica

El proyecto está dividido en tres grandes capas:

- Frontend: React, en la carpeta `frontend/src`.
- Backend: Node.js + Express, en la carpeta `backend`.
- Base de datos: MySQL/MariaDB con migraciones versionadas en `database/migrations`.

### 4.2 Patrones arquitectónicos implementados

- API REST organizada por dominio.
- Controladores por entidad o funcionalidad.
- Rutas por módulo.
- Middleware de autenticación y autorización por rol.
- Rate limiting para login e IA.
- Seguridad por CORS, Helmet y JWT.
- Soporte por roles: `admin`, `director`, `docente`, `estudiante`, `padre`.
- Multi-tenancy por colegio: se asume que cada instalación pertenece a un colegio, y los datos se filtran por `colegio_id`.

### 4.3 Roles del sistema

#### Admin
- Configuración general del colegio.
- Gestión de instituciones, docentes, estudiantes, grupos y entornos académicos.
- Administración de periodos, materias, horarios y módulos.

#### Director
- Seguimiento institucional.
- Evaluación docente.
- Comparativas y métricas.
- Riesgo académico y mejora institucional.
- Acceso a reportes estratégicos.

#### Docente
- Gestión de actividades y evaluaciones.
- Asistencia y libro de calificaciones.
- Seguimiento de estudiantes y entregas.
- Comunicación con estudiantes e institucional.

#### Estudiante
- Consulta de actividades, notas y materias.
- Acceso a tutoría IA.
- Seguimiento de su historial académico.

#### Padre
- Consulta del rendimiento y actividades del estudiante.
- Visualización del espacio académico familiar.
- Comunicación con el colegio.

---

## 5. Estructura del repositorio

### 5.1 Backend

La carpeta `backend` concentra la lógica de negocio del sistema. Tiene un punto de entrada principal `backend/index.js` y una estructura modular en `src/`:

- `controllers/`: lógica por dominio.
- `routes/`: endpoints REST por módulo.
- `services/`: procesos transversales, cron jobs y automatizaciones.
- `middlewares/`: validación JWT, roles, seguridad.
- `database.js`: pool de conexiones MySQL.
- `utils/`: utilidades generales.

### 5.2 Frontend

La carpeta `frontend/src` contiene las vistas por rol y el sistema de navegación:

- `App.js`: definición del router principal.
- `pages/`: pantallas del sistema organizadas por tipo de usuario y módulo.
- `components/`: componentes reutilizables de la interfaz.
- `context/`: autenticación y estado global del usuario.

### 5.3 Base de datos

El esquema y las migraciones viven en `database/` y `database/migrations/`, donde se versionan cambios del modelo físico. La lógica de migración automática en `backend/src/database.js` también crea columnas y tablas necesarias si faltan, con validaciones de idempotencia.

---

## 6. Módulos del sistema

A continuación se listan los módulos funcionales del sistema, con base en la estructura real del repositorio, rutas y páginas existentes.

---

### 6.1 Módulo de autenticación y seguridad

#### Objetivo
Controlar acceso al sistema, identificar usuarios por sesión y proteger la API.

#### Componentes
- `backend/src/routes/authRoutes.js`
- `backend/src/controllers/authController.js`
- `backend/src/middlewares/auth.js`
- Frontend: `Login`, `OlvidePassword`, `ResetPassword`

#### Funcionalidades
- Inicio de sesión con credenciales.
- Generación y validación de JWT.
- Control de roles por usuario.
- Recuperación de contraseña.
- Bloqueo de intentos repetidos por IP.
- Protección de endpoints `api/*` con CORS, Helmet y rate limiting.

#### Consideraciones técnicas
- El login está rate-limited en memoria para evitar fuerza bruta.
- El sistema usa JWT para identificar al usuario y su colegio.
- La seguridad se implementa a nivel de backend y controles de ruta en frontend.

---

### 6.2 Módulo institucional y configuración del colegio

#### Objetivo
Administrar la configuración base del establecimiento educativo y los atributos institucionales del sistema.

#### Archivos
- `colegioRoutes.js`, `colegioController.js`
- `colegioModulosRoutes.js`, `colegioModulosController.js`
- Páginas: `Colegios`, `ModulosPortal`, `Dashboard`

#### Funcionalidades
- Registrar y gestionar colegios.
- Configurar nombre, logo, colores, lema y configuración visual.
- Configurar módulos activados o desactivados por instalación.
- Definir sisema de permisos por modulo.
- Gestionar información institucional base.

#### Datos relevantes
- `colegios`
- `colegio_modulos` / lógica de `modulos_desactivados`
- Preferencias institucionales y configuración de dominio/branding

#### Importancia funcional
Este módulo define la identidad de cada colegio y la disponibilidad de funcionalidades para cada instalación.

---

### 6.3 Módulo de organización académica

#### Objetivo
Gestionar la estructura del colegio en términos de niveles, grupos, salones, semestres, periodos y calendario académico.

#### Archivos
- `anioLectivoRoutes.js`, `periodoRoutes.js`, `grupoRoutes.js`, `salonRoutes.js`
- `areaAcademicaRoutes.js`, `gradoAcademicoRoutes.js`, `gradoMateriaRoutes.js`
- `semanaAcademicaRoutes.js`
- Páginas: `Periodos`, `Grupos`, `Salones`, `AreasAcademicas`, `GradosAcademicos`, `SemanaAcademica`

#### Funcionalidades
- Crear y cerrar años lectivos.
- Definir periodos académicos.
- Organizar grupos por curso, nivel, grado y jornada.
- Gestionar salones físicos y horarios asociados.
- Definir áreas académicas.
- Definir grados académicos y requisitos por nivel.
- Configurar asignaturas por grado.
- Programar actividad académica semanal institucional.

#### Entidades clave
- `anios_lectivos`
- `periodos`
- `grupos`
- `salones`
- `areas_academicas`
- `grados_academicos`
- `grado_materias`

#### Valor del módulo
Es la base para que docentes, estudiantes y directivos operen sobre una estructura académica sólida y consistente.

---

### 6.4 Módulo de docentes y personal

#### Objetivo
Administrar el personal profesor y administrativo que participa en la operación del colegio.

#### Archivos
- `docenteRoutes.js`, `docenteController.js`
- `personalRoutes.js`, `personalController.js`
- Páginas: `Docentes`, `Personal`

#### Funcionalidades
- Registro de docentes.
- Asignación de materias y cursos.
- Gestión de carga académica.
- Permisos y accesos por rol.
- Administración de personal del colegio.
- Soporte para evaluación docente.

#### Entidades clave
- `usuarios`
- `docentes`
- `personal`
- referencias a materias, grupos, periodos.

#### Relación con el sistema
Este módulo alimenta el resto de la plataforma: actividades, asistencia, evaluaciones, reportes y mensajes.

---

### 6.5 Módulo de estudiantes y familias

#### Objetivo
Administrar la matrícula, seguimiento del estudiante y sus vínculos con la comunidad educativa.

#### Archivos
- `estudianteRoutes.js`, `estudianteController.js`
- `padreRoutes.js`, `padreController.js`
- `motivoRetiroRoutes.js`, `motivoRetiroController.js`
- Páginas: `Estudiantes`, `Padres`, `MotivosRetiro`, `DashboardEstudiante`, `DashboardPadre`

#### Funcionalidades
- Registro y actualización de estudiantes.
- Vinculación con grupos, materias y acudientes.
- Carreras académicas, historiales y observaciones.
- Registro de retiros, motivos y seguimiento de egreso.
- Panel para estudiantes y familias.

#### Entidades clave
- `usuarios`
- `estudiantes`
- `padres`
- `motivos_retiro`
- `ficha_medica` (si aplica a flujo médico)

#### Importancia funcional
Este módulo es el núcleo del sistema de seguimiento del alumno, la comunicación con familias y la trazabilidad de su desempeño.

---

### 6.6 Módulo de materias y asignaturas

#### Objetivo
Administrar el catálogo académico y la relación entre materias, grados y docentes.

#### Archivos
- `materiaRoutes.js`, `materiaController.js`
- `gradoMateriaRoutes.js`, `gradoMateriaController.js`
- Páginas: `Materias`, `AsignaturasPorGrado`, `ReasignacionCarga`, `TrasladoClases`

#### Funcionalidades
- Crear y actualizar materias.
- Asociarlas a grados o niveles.
- Reasignar carga docente.
- Gestionar traslados entre bloques o clases.
- Programar asignaturas según la estructura académica.

#### Relación con otras entidades
Se conecta con grupos, docentes, actividades, boletines y reportes.

---

### 6.7 Módulo de actividades, tareas y evaluaciones

#### Objetivo
Gestionar las tareas, actividades, evaluaciones y entregas de docentes y estudiantes.

#### Archivos
- `actividadRoutes.js`, `actividadController.js`
- `boletinRoutes.js`, `boletinController.js`
- `logroRoutes.js`, `logroController.js`
- `historicoRoutes.js`, `historicoController.js`
- Páginas: `BancoActividades`, `CrearActividad`, `VerActividades`, `RevisarEntregas`, `Boletin`, `LibroNotas`, `Actividad`

#### Funcionalidades
- Crear actividades por materia, curso y periodo.
- Definir requisitos, fechas de entrega, valoraciones y criterios.
- Revisar entregas por docentes.
- Registrar calificaciones.
- Generar boletines y consolidado académico.
- Mantener notas históricas y registros de calificaciones previas.

#### Entidades clave
- `actividades`
- `entregas`
- `boletines`
- `logros`
- `calificaciones_historicas`

#### Valor del módulo
Es el núcleo de la evaluación escolar y el mayor punto de interacción entre docente y estudiante.

---

### 6.8 Módulo de asistencia

#### Objetivo
Registrar y consolidar la asistencia escolar y la participación del estudiante.

#### Archivos
- `asistenciaRoutes.js`, `asistenciaController.js`
- Páginas: `PasarLista`

#### Funcionalidades
- Registrar presencia, tardanzas y ausencias.
- Consultar asistencia de un estudiante o grupo.
- Generar indicadores de permanencia y seguimiento.

#### Relación operativa
La asistencia se usa en dashboards, alertas y análisis de riesgo.

---

### 6.9 Módulo de observación académica y riesgo

#### Objetivo
Detectar estudiantes con dificultades académicas o comportamiento atípico, y apoyar la intervención temprana.

#### Archivos
- `riesgoRoutes.js`, `riesgoController.js`
- `observadorRoutes.js`, `observadorController.js`
- `observacionPeriodoRoutes.js`, `observacionPeriodoController.js`
- `planMejoramientoRoutes.js`, `planMejoramientoController.js`
- Páginas: `RiesgoAcademico`, `ObservadorAcademico`, `PlanesMejoramiento`

#### Funcionalidades
- Calcular riesgo académico a partir de indicadores relevantes.
- Generar alertas preventiva y seguimiento.
- Registrar observaciones por periodo y estudiante.
- Generar planes de mejoramiento.
- Brindar una visión analítica para la toma de decisiones institucionales.

#### Entidades clave
- `riesgo`
- `observaciones_periodo`
- `planes_mejoramiento`
- `alertas`

#### Valor del módulo
Es una de las piezas más estratégicas del sistema: permite intervenir antes de que una dificultad académica se vuelva crítica.

---

### 6.10 Módulo de observación docente y evaluación institucional

#### Objetivo
Apoyar la evaluación y seguimiento del desempeño docente y la gestión académica del colegio.

#### Archivos
- `auditoriaRoutes.js`, `auditoriaController.js`
- `reporteRoutes.js`, `reporteController.js`
- Páginas: `EvaluacionDocentes`, `Comparativas`, `MetricasInstitucional`, `Auditoria`, `DirectorDashboard`

#### Funcionalidades
- Evaluar docentes.
- Comparar indicadores entre periodos, grupos y áreas.
- Generar reportes institucionales.
- Consultar métricas del desempeño general.
- Mantener auditoría de acciones relevantes.

#### Importancia
Este módulo se orienta al nivel estratégico de la institución y apoya la toma de decisiones con evidencia.

---

### 6.11 Módulo de mensajería y comunicación interna

#### Objetivo
Facilitar la comunicación entre la institución, docentes, estudiantes y familias.

#### Archivos
- `mensajeRoutes.js`, `mensajeController.js`
- `mensajeMasivoRoutes.js`, `mensajeMasivoController.js`
- `notificacionRoutes.js`, `notificacionController.js`
- `whatsappRoutes.js`, `whatsappController.js`
- `citacionRoutes.js`, `citacionController.js`
- `contactoRoutes.js`, `contactoController.js`
- Páginas: `Mensajeria`, `MensajesMasivos`, `Citaciones`, `NotificacionBell`

#### Funcionalidades
- Envío de mensajes internos por usuario o grupo.
- Mensajes masivos a colectivos.
- Notificaciones del sistema.
- Integración con WhatsApp.
- Comunicación institucional y citaciones.
- Formulario público de contacto/demo.

#### Entidades clave
- `mensajes`
- `mensajes_masivos`
- `notificaciones`
- `citaciones`
- `whatsapp`

#### Valor del módulo
La comunicación es un pilar de la experiencia institucional, especialmente en escuelas con alta necesidad de coordinación entre docentes y familias.

---

### 6.12 Módulo de agenda y eventos institucionales

#### Objetivo
Coordinar eventos, actividades institucionales y agenda general.

#### Archivos
- `eventoRoutes.js`, `eventoController.js`
- Páginas: `Agenda`

#### Funcionalidades
- Crear eventos institucionales.
- Organizar fechas, horarios y responsables.
- Visualizar agenda del colegio.

#### Relación
Este módulo conecta la programación institucional con la gestión académica y la comunicación.

---

### 6.13 Módulo de horarios y planificación docente

#### Objetivo
Administrar la programación del tiempo académico docente y del estudiante.

#### Archivos
- `horarioRoutes.js`, `horarioController.js`
- `semanaAcademicaRoutes.js`
- Páginas: `HorarioDocente`, `SemanaAcademica`

#### Funcionalidades
- Crear horarios por grupo, docente y salón.
- Consultar disponibilidad.
- Organizar la semana académica institucional.

---

### 6.14 Módulo de briefing, dashboards y reportes ejecutivos

#### Objetivo
Resumir la situación del colegio con indicadores ejecutivos y alertas operativas.

#### Archivos
- `briefingRoutes.js`, `briefingController.js`
- `services/briefingService.js`
- `services/alertasService.js`
- `services/informesSemanalService.js`
- Páginas: `Dashboard`, `DirectorDashboard`

#### Funcionalidades
- Briefing diario para la dirección.
- Alertas preventivas diarias.
- Informes semanales.
- Dashboard ejecutivo con visión de salud institucional.

#### Valor del módulo
Permite transformar datos académicos en información útil para la dirección escolar.

---

### 6.15 Módulo de IA y copilotos

#### Objetivo
Usar asistentes de IA para apoyar distintas funciones institucionales y académicas.

#### Archivos
- `coPilotoRoutes.js`, `coPilotoController.js`
- `observadorRoutes.js`
- `tutorRoutes.js`, `tutorController.js`
- `piarRoutes.js`, `piarController.js`
- `services/` relacionadas a IA y generativos
- Páginas: `CoPiloto`, `CoPilotoDocente`, `ObservadorAcademico`, `TutorIA`, `PIAR`

#### Funcionalidades por producto

##### Copiloto de rectoría
- Apoyo analítico para la gestión institucional.
- Síntesis de información y recomendaciones.
- Asistencia en procesos complejos con múltiples indicadores.

##### Observador académico
- Monitoreo de desempeño y anomalías.
- Identificación de patrones relevantes en riesgo académico.

##### Tutor IA
- Asistencia personalizada para estudiantes.
- Explicación de contenidos, dudas y seguimiento académico.

##### PIAR
- Soporte a procesos específicos de acompañamiento y mejora educativa.

##### Briefing y alertas IA
- Resúmenes ejecutivos y recomendaciones basadas en datos del colegio.

#### Seguridad y control
- En el backend se implementan rate limits por ruta para evitar abuso de consumo de IA.
- Los endpoints de IA tienen límites específicos y se integran con la seguridad por JWT.

---

### 6.16 Módulo de auditoría y trazabilidad

#### Objetivo
Registrar acciones sensibles de usuarios y cambios relevantes en el sistema.

#### Archivos
- `auditoriaRoutes.js`, `auditoriaController.js`
- `backend/src/database.js` crea tabla `auditoria`
- Páginas: `Auditoria`

#### Funcionalidades
- Registrar quién hizo qué, cuándo y sobre qué entidad.
- Seguir cambios en calificaciones, notas, matriculas, mensajes y acciones críticas.
- Facilitar la responsabilidad y transparencia de la gestión escolar.

#### Valor del módulo
Es clave para instituciones que requieren trazabilidad, control y respaldo documental de decisiones.

---

### 6.17 Módulo de reportes, comparativas y métricas

#### Objetivo
Transformar datos operativos en indicadores de gestión y rendimiento institucional.

#### Páginas
- `Comparativas`
- `MetricasInstitucional`
- `LibroNotas`
- `Dashboard`
- `DirectorDashboard`

#### Funcionalidades
- Rankings por grupo, docente o materia.
- Comparación de rendimiento entre periodos.
- Indicadores de asistencia, notas y desempeño.
- Consolidación de información ejecutiva para dirección.

---

### 6.18 Módulo de calendario, agenda y actividades institucionales

#### Objetivo
Coordinar y mostrar el calendario escolar y los eventos generales del establecimiento.

#### Archivos
- `eventoRoutes.js`
- `Agenda.js` en frontend

#### Funcionalidades
- Identificar fechas importantes del colegio.
- Programar actividades institucionales.
- Mostrar agenda con alcance general o segmentado.

---

### 6.19 Módulo de preferencias de notificación

#### Objetivo
Controlar cómo cada usuario recibe avisos del sistema.

#### Archivos
- `preferenciaNotificacionRoutes.js`, `preferenciaNotificacionController.js`
- Páginas: `PreferenciasNotificacion`

#### Funcionalidades
- Activar o desactivar notificaciones de mensajería, riesgo, citaciones y WhatsApp.
- Ajustar experiencias para cada usuario.

---

### 6.20 Módulo de datos históricos y cierre de año

#### Objetivo
Gestionar la continuidad académica entre periodos y años lectivos.

#### Archivos
- `historicoRoutes.js`, `historicoController.js`
- `anioLectivoRoutes.js`, `anioLectivoController.js`
- `CierreAnioLectivo.js`

#### Funcionalidades
- Importar o registrar calificaciones históricas.
- Cerrar un año lectivo.
- Mantener registros anteriores y activar nuevos ciclos.

---

## 7. Mapa funcional por roles y pantallas

La navegación en el frontend, definida en `frontend/src/App.js`, organiza la experiencia por perfil:

### 7.1 Admin
- Dashboard general
- Colegios
- Grupos, salones, materias, periodos
- Docentes, estudiantes, padres
- Configuración institucional
- Módulos de portal

### 7.2 Director
- Dashboard institucional
- Evaluación docente
- Comparativas
- Riesgo académico
- Observador académico
- Copiloto
- Planes de mejoramiento
- Gemelo digital
- Metricas institucionales

### 7.3 Docente
- Dashboard docente
- Banco de actividades
- Crear y revisar actividades
- Asistencia
- Boletín y libro de notas
- Mensajería
- PIAR
- Copiloto docente
- Horario y anotaciones

### 7.4 Estudiante
- Dashboard del estudiante
- Actividades por materia
- Tutor IA
- Historial académico

### 7.5 Padre
- Dashboard del padre
- Consulta del rendimiento y seguimiento del estudiante
- Comunicación y mensajes

---

## 8. Flujos principales del sistema

### 8.1 Flujo de autenticación
1. Usuario ingresa credenciales desde el frontend.
2. Backend valida usuario y contraseña.
3. Se genera JWT con el rol y el `colegio_id` del usuario.
4. El frontend almacena la sesión y redirige al dashboard correspondiente.
5. Cada endpoint verifica el token y la autoridad del rol.

### 8.2 Flujo académico estándar
1. Director o administrador crea la estructura del año.
2. Se definen grupos, salones, áreas y materias.
3. Docentes se asignan a cursos y materias.
4. Se registran estudiantes y su pertenencia a grupos.
5. Docente crea actividades y evaluaciones.
6. Estudiantes entregan trabajos y reciben calificaciones.
7. El sistema consolida notas, boletines y observaciones.

### 8.3 Flujo de seguimiento de riesgo
1. El sistema recoge asistencia, notas y comportamiento del estudiante.
2. Se calculan indicadores de riesgo académico.
3. El módulo genera alertas, observaciones y planes de mejora.
4. Dirección y docentes reciben información útil para intervenir tempranamente.

### 8.4 Flujo de comunicación
1. El docente o administrador redacta mensaje o citación.
2. El sistema define destinatarios por grupo, persona o rol.
3. Se envía por mensajería interna o WhatsApp según la configuración.
4. El usuario recibe la notificación en el portal o en su canal externo.

---

## 9. Integraciones y servicios transversales

### 9.1 Base de datos y migración
Los cambios físicos a la base se gestionan con migraciones en `database/migrations/` y con auto-migración en `backend/src/database.js` para completar columnas y tablas faltantes.

### 9.2 Email y SMTP
El backend usa nodemailer para envíos institucionales y recuperación de contraseñas.

### 9.3 WhatsApp
El sistema cuenta con rutas y servicios dedicados para comunicación por WhatsApp.

### 9.4 IA
Los módulos de IA están protegidos con rate limits y conectados al backend para procesar consultas y recomendaciones de apoyo escolar.

### 9.5 Cron jobs
El servidor inicia automatismos periódicos para:
- Alertas preventivas.
- Recalculo de riesgo académico.
- Informes semanales.
- Briefing ejecutivo diario.

---

## 10. Seguridad y buenas prácticas

El backend implementa varias capas de protección:

- `helmet` para cabeceras HTTP más seguras.
- CORS configurado por origen permitido.
- `express-rate-limit` para login, IA y formularios públicos.
- JWT para autenticación.
- Validación por rol y permisos.
- Separación de responsabilidades entre rutas, controladores y servicios.
- Envío de respuestas con `Cache-Control: no-store` en la API.

Además, el sistema está diseñado para ser multi-instalación y mantener datos aislados por colegio, lo cual es una premisa importante del producto.

---

## 11. Consideraciones técnicas relevantes

### 11.1 Multi-tenancy
Cada colegio es una instalación independiente con su propia base de datos y configuración. El sistema está organizado para que la información se filtre por `colegio_id` y evitando que un usuario acceda a datos de otra institución.

### 11.2 Personalización
Playfesor permite personalizar nombre, logo, colores y configuración visual por instalación. Esto hace que el producto pueda adaptarse a distintos colegios sin cambiar el núcleo del código.

### 11.3 Extensión del sistema
La estructura por módulos facilita ampliar nuevas funcionalidades: se agrega una ruta, un controlador, una vista de frontend y, si aplica, una tabla o migración en la base de datos.

### 11.4 Alineación con el manual de usuario
Esta documentación técnica permite posteriormente crear una guía de usuario basada en:
- roles del sistema,
- flujo de trabajo por perfiles,
- pantallas principales,
- funciones críticas de cada módulo,
- tareas operativas del día a día.

---

## 12. Resumen del producto por grandes dominios

Playfesor se puede resumir como una plataforma integral para la administración escolar colombiana con estas seis grandes dimensiones:

1. Administración institucional.
2. Gestión académica y docente.
3. Seguimiento de estudiantes y familias.
4. Evaluación, notas y boletines.
5. Comunicación y notificación.
6. Analítica, riesgo y apoyo con IA.

En conjunto, estas dimensiones convierten a Playfesor en un sistema de gestión escolar con capacidades de analítica, automatización y decisión institucional.

---

## 13. Conclusión

Playfesor es más que un CRUD académico: es una plataforma educativa de gestión escolar con capas de seguridad, análisis, comunicación y apoyo inteligente. Su valor real está en la combinación de gestión institucional, seguimiento académico, IA, trazabilidad y personalización por colegio.

Este documento actúa como base de conocimiento técnico para la próxima etapa: la creación del manual de usuario, donde cada módulo se convertirá en una guía práctica para los usuarios reales del sistema.

---

## 14. Siguiente paso sugerido

La próxima fase recomendada es:

1. Convertir este documento técnico en un mapa de usuario por perfiles.
2. Definir, para cada rol, qué tareas hace formalmente en el sistema.
3. Redactar manuales:
   - Manual del administrador
   - Manual del director
   - Manual del docente
   - Manual del estudiante
   - Manual de padre de familia
4. Organizar cada sección con flujo operativo, pantallas, acciones y resultados esperados.

Esto permitirá pasar de una visión técnica a una guía de uso efectiva y sostenible para el colegio.
