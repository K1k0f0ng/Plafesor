# PLAYFESOR — ADENDUM A LA ESTRATEGIA DE EVOLUCIÓN 2026–2030
## Actualización de estado real — Julio 2026

**Documento base:** ESTRATEGIA_EVOLUCION_2026_2030.md (v1.0, mayo 2026)
**Este adendum:** 14 de julio de 2026
**Método:** contraste del documento original contra el código en producción (rutas registradas en `backend/index.js`, controladores y páginas por rol)
**Próxima revisión sugerida:** cada 4–6 semanas mientras el desarrollo mantenga este ritmo (no septiembre 2026, como decía la v1.0)

---

## POR QUÉ EXISTE ESTE ADENDUM

El documento original proyectaba un cronograma a 36 meses en el que funciones como el motor de riesgo, el copiloto de rectoría, el observador automático, el tutor IA y WhatsApp para padres llegarían entre 6 y 12 meses después de mayo de 2026. Todas esas funciones ya están construidas y en producción desde el 5 de junio de 2026.

El plan no estaba mal diseñado — quedó atrás de su propio ritmo de ejecución. Este adendum corrige las secciones del documento que ya no reflejan la realidad, sin necesidad de reescribirlo entero.

---

## 1. ACTUALIZACIÓN A LA SECCIÓN 1.1 — NIVEL DE MADUREZ

La v1.0 clasificaba a Playfesor así:

| Dimensión | Nivel según v1.0 (mayo) |
|---|---|
| Predicción | Inexistente |
| Recomendación | Inexistente |
| IA Generativa | Inexistente |

**Estado real a julio 2026:**

| Dimensión | Nivel real | Evidencia |
|---|---|---|
| Predicción | Implementado | Motor de Scoring de Riesgo Académico en producción desde 2026-06-05 |
| Recomendación | Implementado | Observador Académico y Copiloto de Rectoría generan recomendaciones contextuales por rol |
| IA Generativa | Implementado | Claude API integrado en Copiloto, Observador, Tutor IA e informes automáticos |

**Clasificación actualizada: INTERMEDIO–AVANZADO**, no "Básico–Intermedio en transición" como decía la v1.0.

---

## 2. ACTUALIZACIÓN A LA SECCIÓN 1.4 — DEBILIDADES

La v1.0 listaba como vacíos funcionales críticos:

- ❌ Sin capa de analítica institucional
- ❌ Sin sistema de alertas
- ❌ Sin módulo de padres
- ❌ Sin gestión de asistencia

**Todos estos vacíos ya están resueltos.** Persisten, en cambio, otros que la v1.0 no marcó con la misma urgencia (ver sección 5 de este adendum).

---

## 3. MÓDULO POR MÓDULO: PLAN VS. REALIDAD

| Módulo | Lo que decía la v1.0 | Estado real verificado | Diferencia |
|---|---|---|---|
| Módulo de asistencia | Etapa 1, mes 2 | Desplegado 2026-06-01 | A tiempo |
| Centro de Métricas Institucional | Etapa 2, Q3–Q4 2026 | Desplegado 2026-06-01 | 3–5 meses antes |
| Motor de riesgo académico | Etapa 3, Q4 2026–Q1 2027 | Desplegado 2026-06-05 | 6–9 meses antes |
| Copiloto de Rectoría | Etapa 3 "básico" → Etapa 4 "completo" | Desplegado 2026-06-05, completo desde el inicio | Se saltó la versión intermedia |
| Observador académico automático | Etapa 4, mes 6–7 | Desplegado 2026-06-05, completo desde el inicio | 5–6 meses antes |
| WhatsApp para padres | Etapa 3, "básico unidireccional" | Desplegado 2026-06-05 con notificación de ausentes + alerta automática por nota < 3.0 | Más alcance del previsto |
| Tutor IA para estudiantes | Etapa 4, mes 10–12 | Desplegado 2026-06-05 | ~9 meses antes |
| Panel propio para padres | No contemplado (solo chatbot WhatsApp en Fase 9) | `DashboardPadre.js` desplegado 2026-06-05, panel web completo | Fuera del alcance original |
| Boletín oficial en PDF | Etapa 1, mes 2–3 | Confirmado activo en código (`boletinController.js`, `pdfService.js`) | A tiempo |
| Períodos académicos con fechas | Etapa 1, mes 2 | Confirmado activo en código (`periodoController.js`) | A tiempo |
| Informes institucionales automáticos | "Lunes 6 a.m. por email" (Fase 4) | Cron domingo 6 p.m. COT, enviado por WhatsApp al director | Construido, canal distinto |

---

## 4. CORRECCIONES TÉCNICAS AL DOCUMENTO

**Proveedor de WhatsApp (Fase 9):** la v1.0 evalúa Twilio o Meta Business API. En producción se usa **UltraMsg**, proveedor no evaluado en el documento original — más simple y económico para arrancar. Queda documentado aquí como decisión, no como omisión.

**Modelo de IA (Estrategia de IA):** la v1.0 propone repartir Haiku (tareas simples) y Sonnet (tareas complejas). En producción, **todo corre sobre un solo modelo, `claude-haiku-4-5-20251001`** — Copiloto, Observador, Tutor e informes. Funciona bien al volumen actual; revisar si el Copiloto o el Observador se beneficiarían de un modelo más capaz cuando crezca el volumen de uso.

**Modelo de datos del rol padre:** la v1.0 no anticipaba tabla propia para padres. En producción existe el rol `padre` y la tabla `padre_estudiante`, con panel web propio — más completo que lo planeado.

---

## 5. RIESGOS ABIERTOS QUE EL DOCUMENTO YA NO REFLEJA BIEN

### 5.1 — La brecha más importante: no existe sistema de planes ni cobro

La v1.0 (Fase 13) diseña cuatro planes de venta — Básico, Profesional, Premium, IA Institucional — que reparten las funciones por precio. **En el código no existe ningún control de plan, límite de estudiantes ni pasarela de pago.** Hoy cualquier colegio conectado tiene acceso técnico a Copiloto, Observador, Tutor IA y WhatsApp, sin importar qué plan le correspondería según el documento.

**Se construyó el producto completo del plan más caro, pero falta el mecanismo para cobrarlo por niveles.** Este es el proyecto técnico prioritario a partir de ahora, más que cualquier función nueva.

### 5.2 — Deuda técnica: sin cambios desde mayo

La v1.0 lista cuatro pendientes "antes de escalar": rate limiting, respaldos automáticos, ambiente de staging, separar BD transaccional de analítica.

Verificado en código: el paquete de rate limiting está instalado solo como dependencia transitiva de otra librería — **no se usa en ninguna ruta**. No se encontró carpeta de pruebas ni entorno de staging. Esto ya era cierto en mayo y sigue siéndolo, pero hoy hay más superficie sensible expuesta (notas, observaciones, WhatsApp de padres) sin esa protección.

### 5.3 — Tabla comparativa contra la competencia (Fase 12)

Marca con "🔜 próximamente" las columnas de IA predictiva, Copiloto, Observador, Tutor IA y WhatsApp para Playfesor. **Deben pasar a "✅ disponible"** — es el argumento de venta más fuerte que existe hoy y el documento lo sigue presentando como promesa futura.

### 5.4 — Metas comerciales por etapa: sin dato real para comparar

La v1.0 proyecta colegios pagando por mes (M6: 20 Básico + 5 Profesional + 1 Premium, etc.). No es verificable desde el código — vive en ventas, no en la base de datos del producto. Falta la cifra real de colegios activos para saber si el ritmo comercial va a la par del ritmo técnico, que claramente lo superó.

---

## 6. QUÉ HACER A PARTIR DE AHORA (en orden de urgencia)

1. **Construir el sistema de planes y cobro** (Fase 13 de la v1.0) — límites por número de estudiantes, control de acceso por plan, pasarela de pago. Es el proyecto técnico con mayor impacto comercial inmediato.
2. **Cerrar la deuda técnica pendiente** — rate limiting real, respaldos automáticos, ambiente de pruebas.
3. **Actualizar las tablas de la v.1.0** mencionadas en las secciones 1, 2 y 5.3 de este adendum, para que cualquiera que lea el documento completo no parta de un diagnóstico vencido.
4. **Registrar métricas reales de adopción** — cuántos colegios usan el Copiloto, cuántas observaciones genera la IA al mes, cuántas conversaciones tiene el Tutor IA — para confirmar que lo construido se está usando, no solo que existe.
5. **Aportar la cifra real de colegios activos** para comparar contra la proyección comercial de la v1.0 y saber si el ritmo de ventas necesita reforzarse.

---

*Adendum generado: 14 de julio de 2026*
*Próxima revisión sugerida: cada 4–6 semanas mientras el desarrollo mantenga este ritmo*
*Contacto estratégico: kikofong@gmail.com*
