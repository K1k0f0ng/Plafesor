# Playfesor

Plataforma educativa para colegios colombianos: gestión académica, asistencia, boletines, y módulos
de inteligencia artificial (Copiloto de Rectoría, Observador Académico, Tutor IA, Motor de Riesgo,
notificaciones por WhatsApp).

## Modelo de producto

Cada colegio tiene su **propia instalación independiente**: su propio dominio, hosting, base de
datos, configuración, logo, colores, usuarios y respaldos. Ningún colegio comparte información con
otro. Ver `AUDITORIA_TECNICA_2026-08-12.md` para el estado técnico más reciente (qué se resolvió,
qué sigue pendiente).

## Estructura del repositorio

```
backend/                  Core del backend (Node/Express/MySQL) — en desarrollo activo
frontend/                 Core del frontend (React) — en desarrollo activo
database/                 schema.sql del core + migrations/ versionadas

docs/                      Documentación (instalación, configuración, hosting, seguridad, etc.)
checklists/                 Formularios y checklists de implementación/actualización
templates/                   Plantillas de documentos reutilizables

deployment/
  PLAYFESOR_TEMPLATE/         Instalación limpia, base para cualquier colegio nuevo — NUNCA se edita directo
  CLIENTES/                    Una carpeta por colegio instalado (config, logos, backups, no código)

releases/                  Versiones del producto (CHANGELOG, SQL, archivos modificados por versión)
versiones/                  Registro de qué versión tiene instalada cada colegio

config/, scripts/, install/, storage/, uploads/, backups/, assets/, logs/
                            Ver el README de cada carpeta para su propósito específico
```

## Flujo de trabajo de desarrollo

Sin CI/CD, sin Docker, todo manual:

```
PC de desarrollo → pruebas locales → corrección → nueva versión en releases/
  → subir archivos al hosting del colegio manualmente → actualizar BD si aplica → pruebas → entrega
```

## Empezar aquí según lo que necesites hacer

| Quiero... | Ver |
|---|---|
| Instalar un colegio nuevo | `docs/REQUERIMIENTOS.md` → `checklists/CHECKLIST_DATOS_INSTITUCIONALES.md` → `docs/INSTALACION.md` |
| Actualizar un colegio ya instalado | `checklists/CHECKLIST_ACTUALIZACION.md` |
| Cambiar logo/colores/nombre de un colegio | `docs/PERSONALIZACION.md` |
| Entender la base de datos | `docs/BASE_DE_DATOS.md` |
| Configurar correo/WhatsApp/IA | `docs/CONFIGURACION.md`, `docs/SMTP.md` |
| Desarrollar una funcionalidad nueva | `docs/MANUAL_TECNICO.md` |
| Usar la plataforma como administrador del colegio | `docs/MANUAL_ADMIN.md` |
| Entender el estado técnico completo y las decisiones tomadas | `AUDITORIA_TECNICA_2026-08-12.md` |

## Documentación completa

Todo dentro de `docs/`: `REQUERIMIENTOS.md`, `INSTALACION.md`, `CONFIGURACION.md`, `HOSTING.md`,
`BASE_DE_DATOS.md`, `SMTP.md`, `PERSONALIZACION.md`, `SEGURIDAD.md`, `BACKUP.md`,
`ACTUALIZACIONES.md`, `VERSIONES.md`, `MANUAL_ADMIN.md`, `MANUAL_TECNICO.md`,
`INSTALADOR_DISENO.md`, `CHANGELOG.md`. Los checklists de implementación y actualización viven en
`checklists/` en vez de `docs/`.
