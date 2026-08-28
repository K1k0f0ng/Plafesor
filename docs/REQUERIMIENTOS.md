# Requerimientos técnicos

Lo que necesita el hosting de un colegio para correr una instalación de Playfesor.

## Servidor

- **Node.js** 18 o superior (probado y en producción con Node 22).
- **MySQL 8** o **MariaDB 10.3+**.
- **Apache con módulo Passenger** (`mod_passenger`) — es el patrón usado en hosting compartido tipo
  cPanel para ejecutar aplicaciones Node sin un proceso propio permanente. Si el hosting no tiene
  Passenger, cualquier hosting que permita correr un proceso Node persistente (`node index.js`)
  detrás de un proxy funciona igual.
- Soporte de **SSL/TLS** (AutoSSL de cPanel es suficiente).
- Acceso a **cPanel** (o panel equivalente) con capacidad de crear: subdominios, bases de datos
  MySQL, aplicaciones Node.js, y gestionar variables de entorno.

## Recursos mínimos por instalación

Cada colegio corre su propio proceso backend y su propia base de datos — son cargas pequeñas
(un solo colegio, no un SaaS compartido). Como referencia de mínimos razonables en hosting
compartido:
- 512 MB de RAM disponibles para el proceso Node.
- Espacio en disco: depende del volumen de archivos subidos (logos, boletines PDF exportados) —
  1–2 GB es un punto de partida razonable para un colegio pequeño/mediano.

## Dominio

- Un dominio o subdominio para el frontend (ej. `midominio.edu.co`).
- Un subdominio para la API del backend (ej. `api.midominio.edu.co`), o una ruta bajo el mismo
  dominio si el hosting lo permite vía proxy inverso.
- Ambos deben tener SSL activo antes de la entrega (ver `checklists/CHECKLIST_IMPLEMENTACION.md`).

## Servicios externos que cada colegio necesita contratar por su cuenta

Ninguno de estos se comparte entre instalaciones — cada colegio tiene su propia cuenta:

| Servicio | Para qué | Obligatorio |
|---|---|---|
| Cuenta de correo SMTP (Gmail, Outlook, o el propio hosting de correo) | Reset de contraseña | Sí |
| Clave de API de Anthropic (`ANTHROPIC_API_KEY`) | Copiloto, Observador, Tutor IA, generación de actividades, PMI | Sí, si se van a usar los módulos de IA |
| Cuenta UltraMsg (instancia + token) | Notificaciones de WhatsApp a padres/directores | Solo si se activa el módulo de WhatsApp |

## Software en la PC de desarrollo (no en el servidor del colegio)

- Node.js 18+ y npm, para compilar el frontend (`npm run build`) antes de subirlo.
- Un cliente FTP/SFTP o el administrador de archivos de cPanel, para subir los archivos.
- Acceso a phpMyAdmin (o cliente MySQL equivalente) para importar `schema.sql` y aplicar
  migraciones futuras.

No se requiere Docker, ni Git, ni ningún pipeline de CI/CD — el flujo de trabajo de este proyecto
es manual (ver `docs/ACTUALIZACIONES.md`).
