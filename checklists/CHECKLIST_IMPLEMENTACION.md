# Checklist de implementación — validación antes de entregar

Usar al final de `docs/INSTALACION.md`, antes de dar por entregada una instalación nueva.

## Infraestructura

- [ ] Hosting activo y accesible
- [ ] Dominio propagado (frontend y backend, si están en subdominios distintos)
- [ ] SSL funcionando en ambos dominios (candado verde, sin advertencias del navegador)
- [ ] Base de datos creada con usuario y permisos correctos
- [ ] `schema.sql` importado sin errores (16 tablas presentes)
- [ ] Registro de `colegios` (id=1) actualizado con el nombre y ciudad reales (no los placeholders)

## Configuración

- [ ] `backend/.env` completo: institución, base de datos, JWT, CORS, IA, SMTP, WhatsApp (si aplica)
- [ ] `JWT_SECRET` generado específicamente para esta instalación (no reutilizado)
- [ ] `frontend/.env.production` completo: API URL, nombre, colores
- [ ] `CORS_ORIGINS` (backend/.env) coincide exactamente con el dominio real del frontend
- [ ] `Access-Control-Allow-Origin` en `backend/.htaccess` coincide con el mismo dominio

## Funcionalidad

- [ ] SMTP probado — el correo de "olvidé mi contraseña" llega correctamente
- [ ] Login probado con el usuario administrador creado por `crear-admin.js`
- [ ] Roles verificados: crear al menos un docente, un estudiante, y confirmar que cada uno entra a
      su dashboard correspondiente
- [ ] Si se activó WhatsApp: prueba de envío realizada con `POST /api/whatsapp/prueba`
- [ ] Si se activó IA: al menos una consulta de prueba al Copiloto o Tutor IA responde correctamente

## Identidad institucional

- [ ] Logo institucional visible en sidebar y login
- [ ] Escudo/favicon correctos en la pestaña del navegador
- [ ] Nombre de la institución correcto en todas las pantallas (no "NOMBRE_DEL_COLEGIO" ni
      "Playfesor")
- [ ] Colores de marca aplicados correctamente

## Respaldo

- [ ] Copia de seguridad inicial de la base de datos ya recién importada, guardada en
      `deployment/CLIENTES/<Nombre_Colegio>/backups/`
- [ ] Política de backups periódicos configurada o acordada con el colegio/hosting

## Cierre

- [ ] Pruebas completas realizadas sin errores pendientes
- [ ] Administrador del colegio capacitado (ver `docs/MANUAL_ADMIN.md`)
- [ ] Registro actualizado en `versiones/registro_clientes.md`
- [ ] Entrega formal realizada (credenciales del admin entregadas por un canal seguro, no por
      correo/chat en texto plano)
