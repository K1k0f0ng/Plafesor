# 01 · Empresa

## Qué es Playfesor

Playfesor es un sistema de gestión académica con inteligencia artificial integrada, hecho
específicamente para colegios colombianos. No es una traducción de un producto extranjero: la
escala de valoración del MEN, los boletines oficiales, los períodos académicos y la estructura de
grupos colombiana vienen configurados de fábrica.

- **Sitio:** playfesor.co (frontend) · api.playfesor.co (backend)
- **Contacto comercial:** demo@playfesor.co
- **Ubicación:** Medellín, Colombia
- **Propietario / contacto estratégico:** Octavio Enrique Fong Martínez (kikofong@gmail.com)
- **En desarrollo activo desde:** 2026-05-09

## Qué problema resuelve

El colegio colombiano típico (200–2.000 estudiantes) gestiona notas, asistencia, observadores y
comunicación con padres de forma manual o con sistemas de gestión académica genéricos que solo
registran información — no la interpretan. Playfesor añade la capa que falta: predicción de riesgo
académico, generación automática de documentos oficiales (observador, boletín, planes de
mejoramiento) y un copiloto conversacional para la rectoría, todo corriendo sobre los datos reales
de cada institución.

## Modelo de negocio

**Single-tenant: una instalación independiente por colegio.** Cada institución tiene su propio
dominio, hosting, base de datos, logo, colores y usuarios. Ningún colegio comparte información con
otro — no hay una base de datos multi-cliente compartida.

Este modelo se adoptó el 2026-08-12, reemplazando un plan anterior de SaaS multi-tenant con
cobro por planes (ver `05_COMPETIDORES.md` y `08_OFERTAS.md` para el detalle de qué implica el
cambio en la oferta comercial).

## Etapa actual del negocio

Playfesor está en **operación técnica real pero en etapa comercial pre-ingresos**: el producto
funciona en producción con datos reales, pero al 2026-08-31 no hay ningún colegio instalado bajo
el modelo single-tenant actual (`versiones/registro_clientes.md` solo registra `Colegio_Prueba`,
una instalación de prueba interna, no un cliente pagador). El foco comercial inmediato es cerrar la
primera instalación real de punta a punta.

## Stack técnico (resumen, no orientado a marketing pero relevante para conversaciones técnicas con el cliente)

Node.js 22 / Express 4 / MySQL / React 18 · IA generativa vía Claude API (Anthropic) ·
notificaciones por WhatsApp (UltraMsg) · hosting cPanel.

## Equipo

Proyecto de un solo fundador/operador (no técnico en programación, dirige el desarrollo asistido
por IA). Sin equipo comercial ni de marketing dedicado todavía — ver `06_HISTORIAL_MARKETING.md`.
