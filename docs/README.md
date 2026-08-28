# /docs

Documentación técnica y funcional del producto Playfesor (el "core", no de un colegio específico).

Todos los documentos ya están redactados con contenido real (no son plantillas ni esqueletos):

- **REQUERIMIENTOS.md** — lo que necesita el hosting de un colegio para correr una instalación.
- **INSTALACION.md** — guía paso a paso para instalar un colegio nuevo.
- **CONFIGURACION.md** — toda la configuración por variables de entorno (`.env`).
- **HOSTING.md** — guía para hosting compartido con cPanel (Apache/Passenger).
- **BASE_DE_DATOS.md** — estructura de la base de datos (MySQL/MariaDB, InnoDB, utf8mb4).
- **PERSONALIZACION.md** — cómo cambiar nombre, logo, colores y favicon de una instalación.
- **SMTP.md** — configuración del correo saliente (cuenta SMTP genérica por instalación).
- **SEGURIDAD.md** — prácticas de seguridad y qué revisar en cada instalación.
- **BACKUP.md** — qué respaldar, cada cuánto, y cómo restaurar.
- **ACTUALIZACIONES.md** — cómo llevar mejoras del core a colegios ya instalados sin sobrescribir sus datos.
- **VERSIONES.md** — versionado semántico del proyecto (a partir de julio de 2026).
- **MANUAL_TECNICO.md** — referencia rápida para quien retome el desarrollo.
- **MANUAL_ADMIN.md** — guía para el administrador de un colegio (rector, coordinador, etc.).
- **CHANGELOG.md** — registro cronológico de cambios al core.
- **INSTALADOR_DISENO.md** — la única excepción: es una **especificación** de un asistente de
  configuración automatizado que todavía no se construyó, no documentación de algo existente.

Si algún documento queda desactualizado respecto al código, hay que corregirlo ahí mismo — no crear
una versión nueva en otro lugar.
