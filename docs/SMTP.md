# SMTP (correo)

Cada instalación usa su propia cuenta de correo SMTP genérica — no hay un proveedor de email
compartido entre colegios. El backend usa `nodemailer` (`backend/src/services/emailService.js`)
contra las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

## Único uso actual: reset de contraseña

Hoy el único correo automático que envía el sistema es el de "olvidé mi contraseña"
(`POST /api/auth/solicitar-reset`). El enlace expira en 30 minutos.

## Opciones de proveedor SMTP

Cualquiera de estas funciona — se elige según lo que ya tenga o prefiera el colegio:

| Proveedor | SMTP_HOST | SMTP_PORT | Notas |
|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | 587 | Requiere una "contraseña de aplicación", no la contraseña normal de la cuenta |
| Outlook / Microsoft 365 | `smtp.office365.com` | 587 | |
| El propio hosting de correo del colegio (cPanel) | el host que indique cPanel, ej. `mail.midominio.edu.co` | 587 o 465 | Suele ser la opción más simple si el colegio ya tiene correo institucional en el mismo hosting |

## Configuración

En `backend/.env`:

```
SMTP_HOST=mail.midominio.edu.co
SMTP_PORT=587
SMTP_USER=no-reply@midominio.edu.co
SMTP_PASSWORD=la-contraseña-de-esa-cuenta
SMTP_FROM="Nombre del Colegio <no-reply@midominio.edu.co>"
```

`SMTP_PORT=465` activa automáticamente conexión SSL directa; cualquier otro puerto usa STARTTLS.

## Probar que funciona

1. Levanta el backend con el `.env` ya configurado.
2. Desde el frontend, ve a "Olvidé mi contraseña" e ingresa un correo de un usuario real que exista
   en la base de datos.
3. Confirma que el correo llega (revisa también la carpeta de spam la primera vez).
4. Si falla, el error queda en los logs del servidor (`console.error` en `authController.js`) — la
   causa más común es una contraseña de aplicación mal generada o un puerto/seguridad que no
   coincide con lo que pide el proveedor.

## Antes de julio de 2026

El proyecto usaba Resend con una única cuenta compartida entre todos los colegios. Se migró a SMTP
genérico configurable por instalación como parte de la rearquitectura a single-tenant — cada colegio
tiene ahora su propia cuenta de correo, igual que tiene su propia base de datos y su propio dominio.
