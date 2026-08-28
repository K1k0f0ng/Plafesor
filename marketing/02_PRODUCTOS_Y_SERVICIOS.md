# 02 · Productos y servicios

Fuente: funcionalidades verificadas en el código en producción y en la landing page actual
(`frontend/src/pages/LandingPage.js`, commit "Actualiza landing page: funcionalidades nuevas y
afirmaciones verificables", 2026-08-31).

## El producto: un sistema, no módulos sueltos

Playfesor es una sola plataforma web (no un conjunto de add-ons) con cuatro roles: administrador,
docente, estudiante, padre — y un panel de dirección para el rector/director.

## 1. Gestión académica (núcleo)

- Instituciones, grupos, docentes, estudiantes y materias en una sola base de datos
- Motor de actividades interactivas con calificación automática
- Escala de valoración oficial MEN configurada por defecto
- Control de asistencia por sesión
- Boletines oficiales listos para imprimir, con observaciones redactadas por IA
- PIAR (Plan Individual de Ajustes Razonables) conforme al Decreto 1421 de 2017
- Exportación de reportes a Excel en un clic

## 2. Comunicación y familias

- Notificaciones automáticas por WhatsApp: notas, inasistencias, alertas de bajo desempeño
- Citaciones a reunión y mensajes masivos institucionales por WhatsApp
- Portal dedicado para que los padres consulten el progreso de sus hijos
- Comunicación oficial trazable (no depende de chats personales de docentes)

## 3. Analítica institucional ("gemelo digital" de la institución)

- Centro de métricas: salud académica en tiempo real
- Briefing ejecutivo diario para el rector, generado cada mañana
- Ranking de grupos y docentes con evolución histórica
- Mapas de calor por materia para detectar cuellos de botella
- Panel de dirección con la vista general de la institución

## 4. Inteligencia artificial (el diferenciador central — ver `04_MARCA_Y_POSICIONAMIENTO.md`)

Todo corre sobre Claude API (modelo `claude-haiku-4-5-20251001`):

| Capacidad | Qué hace |
|---|---|
| **Motor de riesgo predictivo** | Cada noche cruza nota, tendencia, inasistencia y actividades incumplidas para calcular un score de riesgo (0–100, niveles bajo/medio/alto/crítico) por estudiante, con semanas de anticipación |
| **Copiloto de Rectoría** | Chat en lenguaje natural: el rector pregunta y la IA responde con datos reales de la base de datos de su colegio |
| **Observador académico automático** | Genera el documento oficial de observación por estudiante/grupo/período; el docente solo revisa y firma |
| **Tutor IA para estudiantes** | Acompañamiento pedagógico 24/7 que conoce las notas y el currículo exacto del estudiante — guía, no da la respuesta directa |
| **Planes de mejoramiento automáticos** | Cuando un estudiante pierde una competencia, la IA genera el plan de refuerzo con base en sus dificultades específicas |
| **Informes semanales al director** | Cron dominical (6pm COT) que envía un resumen ejecutivo por WhatsApp al director de cada colegio |

## Servicios que acompañan la instalación

Comprometidos hoy en la landing page (`#demo`, sección CTA):

- Migración de datos existentes (grupos, docentes, estudiantes, materias)
- Capacitación al equipo docente
- Soporte en español, desde Colombia

**Nota de honestidad comercial:** estos tres servicios están prometidos públicamente en el sitio,
pero el modelo single-tenant nunca se ha ejecutado de punta a punta con un cliente real todavía
(ver `01_EMPRESA.md`). Antes de vender la primera instalación real, conviene practicar este flujo
completo internamente para poder cumplir la promesa sin fricción.

## Lo que NO se vende (para evitar sobre-prometer)

- No hay app móvil nativa (es web responsive)
- No hay integración con pasarela de pagos de matrículas/pensiones
- No hay marketplace de contenido curricular de terceros
