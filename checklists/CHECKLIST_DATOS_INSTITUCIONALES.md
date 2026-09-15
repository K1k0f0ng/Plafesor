# Checklist — Datos institucionales para un colegio nuevo

Formulario a diligenciar con el colegio antes de empezar la instalación. Ver también la versión
`.csv` en esta misma carpeta para llevarlo en una hoja de cálculo. Cada instalación necesita esta
información completa antes de tocar `deployment/PLAYFESOR_TEMPLATE/`.

## 1. Información institucional

- [ ] Nombre del colegio
- [ ] Razón social
- [ ] NIT
- [ ] Dirección
- [ ] Ciudad
- [ ] Departamento
- [ ] País
- [ ] Teléfono
- [ ] Correo institucional
- [ ] Página web (si tiene)
- [ ] Rector (nombre completo)
- [ ] Coordinador (nombre completo)
- [ ] Calendario académico (A o B)
- [ ] Naturaleza jurídica (privado, oficial, etc.)
- [ ] Logo en PNG (fondo transparente, mínimo 512×512)
- [ ] Logo en SVG (si está disponible)
- [ ] Escudo institucional
- [ ] Favicon (o se genera a partir del logo)
- [ ] Colores corporativos (hex de color primario y secundario)
- [ ] Tipografía institucional (si tiene una definida; si no, se usa la del sistema — Inter)
- [ ] Firma del rector (imagen, si se usará en boletines)
- [ ] Sello institucional (imagen, si se usará en boletines)
- [ ] Manual de convivencia (referencia o archivo, informativo)
- [ ] PEI — Proyecto Educativo Institucional (referencia o archivo, informativo)
- [ ] Resolución MEN (número de resolución de aprobación)

## 2. Dominio y hosting

- [ ] Dominio (ej. `midominio.edu.co`)
- [ ] Proveedor de hosting
- [ ] Acceso a cPanel (usuario/contraseña, o quién lo administra)
- [ ] Acceso FTP
- [ ] Acceso SSH (si aplica)
- [ ] Versión de PHP disponible (no se usa, pero suele coexistir en el mismo hosting)
- [ ] Versión de Node.js disponible (mínimo 18, ideal 22)
- [ ] Versión de MySQL/MariaDB disponible
- [ ] Certificado SSL (AutoSSL de cPanel, o provisto por el cliente)
- [ ] Estado de propagación DNS

## 3. Base de datos

- [ ] Nombre de la base de datos
- [ ] Usuario de la base de datos
- [ ] Contraseña
- [ ] Host (normalmente `localhost` en hosting compartido)
- [ ] Puerto (normalmente `3306`)
- [ ] Charset (`utf8mb4`, ya fijo en el schema)

## 4. SMTP (correo)

- [ ] Servidor SMTP
- [ ] Puerto (587 con STARTTLS, o 465 con SSL)
- [ ] Usuario
- [ ] Contraseña
- [ ] Seguridad (TLS/SSL)
- [ ] Correo remitente (ej. `no-reply@midominio.edu.co`)

## 5. WhatsApp (UltraMsg)

- [ ] Cuenta UltraMsg propia del colegio (instancia y token) — no se comparte con otras instalaciones

## 6. Inteligencia artificial

- [ ] Clave de API de Anthropic propia de esta instalación (`ANTHROPIC_API_KEY`) — no se comparte
      con otras instalaciones

## 7. Usuario administrador inicial

- [ ] Nombre
- [ ] Correo
- [ ] Contraseña inicial (se genera con `crear-admin.js`, no se anota aquí en texto plano)

## 8. Configuración académica

- [ ] Año lectivo
- [ ] Períodos (fechas de inicio/fin de cada uno)
- [ ] Escala de valoración (por defecto, la escala MEN ya viene configurada)
- [ ] Grados que maneja el colegio (5° a 11°, o el rango que aplique)
- [ ] Cursos/grupos por grado
- [ ] Jornadas (mañana, tarde, única)
- [ ] Áreas y asignaturas (además del catálogo MEN precargado, si el colegio tiene asignaturas propias)
- [ ] Roles y permisos especiales (si el colegio necesita algo distinto al esquema estándar de
      admin/docente/estudiante/director/padre)

---

Una vez completado este formulario, continuar con `docs/INSTALACION.md`.
