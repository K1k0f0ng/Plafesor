# Diseño del instalador (no construido todavía)

Este documento describe cómo debería funcionar un asistente de configuración que automatice la
instalación de un colegio nuevo. **No está construido** — hoy el proceso es manual siguiendo
`docs/INSTALACION.md`, apoyado por los scripts `crear-admin.js` y `aplicar-marca.js` que ya existen
en la plantilla. Este documento es la especificación para construirlo cuando se decida invertir en
ello.

## Por qué CLI local, no un asistente web

El operador (tú) trabaja solo, desde una PC de desarrollo, sin CI/CD ni Docker, haciendo
instalaciones de forma ocasional (no cientos por día). Un asistente web hospedado agregaría
infraestructura, mantenimiento y superficie de seguridad (¿dónde vive?, ¿quién más tiene acceso?,
¿cómo se protege contra abuso?) sin beneficio real para este volumen de uso. Un script de línea de
comandos que corres en tu propia PC encaja con el flujo de trabajo actual sin agregar nada nuevo que
mantener.

## Entrada

Las respuestas de `checklists/CHECKLIST_DATOS_INSTITUCIONALES.md` (o su `.csv`), leídas
directamente del archivo o pedidas de forma interactiva por el propio script — a definir según cuál
sea menos fricción en la práctica.

## Salida

El instalador encadenaría, en un solo comando, lo que hoy son pasos manuales:

1. Generar `backend/.env` completo a partir de las respuestas (institución, BD, JWT, CORS, IA,
   SMTP, WhatsApp, frontend URL) — usando `backend/.env.example` como plantilla y sustituyendo cada
   placeholder.
2. Generar `frontend/.env.production` con nombre, colores y API URL.
3. Ejecutar `aplicar-marca.js` con la carpeta de logos indicada.
4. Ejecutar `crear-admin.js` de forma no interactiva (recibiendo nombre/email/contraseña como
   parámetros en vez de por `readline`).
5. Ejecutar `npm install` y `npm run build` del frontend.
6. Dejar todo listo en una carpeta de salida (ej. `deployment/CLIENTES/<Colegio>/build-listo/`) para
   subir manualmente al hosting — el instalador **no sube nada por FTP/SSH automáticamente**, eso
   sigue siendo una acción manual y deliberada del operador, consistente con no automatizar el
   despliegue en sí.

## Lo que el instalador NO debería hacer

- No debe crear la base de datos ni el usuario MySQL en el hosting (eso depende de cPanel/el
  panel del proveedor, fuera del alcance de un script local).
- No debe subir archivos al servidor ni reiniciar la aplicación remota — mantener el paso de subida
  manual es una decisión deliberada, no una limitación a resolver.
- No debe intentar validar DNS/SSL — esas son responsabilidad del hosting y se verifican con
  `checklists/CHECKLIST_IMPLEMENTACION.md`.

## Validaciones mínimas que sí debería hacer

- Verificar que todas las variables obligatorias del checklist tienen un valor antes de generar los
  `.env` (evita el tipo de fallo silencioso encontrado en la auditoría: `ANTHROPIC_API_KEY`/
  variables `SMTP_*` ausentes).
- Verificar que los 7 archivos de logo/favicon esperados están presentes en la carpeta indicada
  antes de copiarlos (hoy `aplicar-marca.js` ya avisa cuál falta y sigue con el genérico — el
  instalador podría, en cambio, detenerse y pedir confirmación explícita de continuar con
  placeholders).

## Próximo paso si se decide construirlo

Empezar por envolver `aplicar-marca.js` y una versión no interactiva de `crear-admin.js` en un
tercer script (`instalar.js`) que los invoque en secuencia, antes de intentar generar los `.env`
automáticamente — es la parte de mayor valor con menor riesgo de empezar.
