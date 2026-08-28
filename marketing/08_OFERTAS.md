# 08 · Ofertas

## El punto más importante de este documento

**Playfesor no tiene hoy un precio público ni un mecanismo de cobro definido.** Esto no es un
descuido de marketing — es una decisión de arquitectura de negocio tomada el 2026-08-12 y sigue
siendo, al 2026-08-31, el vacío comercial más grande del proyecto. Cualquier oferta que se comunique
hacia afuera debe partir de este hecho.

## Qué pasó con el modelo de precios anterior (contexto necesario)

La v1.0 de la estrategia (`ESTRATEGIA_EVOLUCION_2026_2030.md`, mayo 2026) diseñó cuatro planes SaaS
multi-tenant con cobro mensual:

| Plan | Precio mensual diseñado | Incluía (diseño original) |
|---|---|---|
| Básico "Aula Digital" | $80.000 COP (~$20 USD) | Gestión académica base |
| Profesional "Institución Inteligente" | $250.000 COP (~$62 USD) | + Planes de mejoramiento con IA básica |
| Premium "Plataforma Educativa Completa" | $600.000 COP (~$150 USD) | + Copiloto de Rectoría, planes de mejoramiento completos |
| IA Institucional | $1.500.000–5.000.000 COP (negociado) | Todo, a medida |

`ESTRATEGIA_ADENDUM_JULIO_2026.md` (julio 2026) ya advertía que **en el código nunca existió control
de plan, límite de estudiantes ni pasarela de pago** — cualquier colegio conectado tenía acceso
técnico a todo, sin importar qué plan le correspondiera según el papel.

**El 2026-08-12 el proyecto abandonó formalmente el rumbo SaaS multi-tenant** en favor de single-tenant
(una instalación independiente por colegio — ver `01_EMPRESA.md`). Con ese cambio, **el sistema de
planes y cobro por niveles dejó de aplicar**: no se construyó, y ya no es la prioridad que
`ESTRATEGIA_ADENDUM_JULIO_2026.md` señalaba. Esta tabla queda documentada aquí solo como referencia
histórica de qué tan cara puede percibirse cada capa de valor — no como precio vigente.

## Qué ofrece Playfesor hoy (mecánica, no precio)

Bajo el modelo single-tenant, la oferta natural es **instalación completa por colegio, negociada
caso por caso**, no una suscripción con niveles públicos. Lo que la landing page ya promete incluir
en cada instalación (`frontend/src/pages/LandingPage.js`, sección CTA):

- Migración de datos existentes (grupos, docentes, estudiantes, materias)
- Capacitación al equipo docente
- Soporte en español, desde Colombia
- Acceso completo al producto: no hay hoy una versión "reducida" técnicamente posible, porque el
  control de acceso por plan nunca se construyó — así que toda instalación single-tenant incluye,
  por defecto, todas las capacidades (gestión académica + IA completa + WhatsApp)

## Vacíos que hay que resolver antes de vender en firme

1. **Precio de instalación single-tenant:** no está definido. Debe considerar al menos: costo de
   hosting por colegio, costo marginal de IA (~$2–5 USD/mes estimado por colegio, ver `07_METRICAS.md`),
   costo de UltraMsg/WhatsApp, y el tiempo de implementación/capacitación/soporte.
2. **Alcance de "capacitación" y "soporte":** hoy son promesas de landing page sin definir
   horas, SLA, ni qué pasa después del período inicial.
3. **Validación de punta a punta:** el riesgo abierto marcado en la memoria del proyecto es que el
   modelo single-tenant **nunca se ha probado completo con un cliente real** — `deployment/CLIENTES/`
   solo tiene la carpeta de prueba `Colegio_Prueba`. Antes de cotizar a un colegio real, conviene
   ejecutar una instalación de prueba de punta a punta (incluye `crear-admin.js` y login end-to-end).

## Recomendación para la primera oferta comercial real

Dado que no hay testimonios ni casos de estudio (`06_HISTORIAL_MARKETING.md`), la oferta más
defendible para el primer cliente real es una **instalación piloto con condiciones especiales**
(precio reducido o gratuito a cambio de ser el primer caso de estudio documentado), en vez de
intentar cobrar el precio pleno sin ninguna prueba social. Esto resuelve, de paso, el vacío de
`07_METRICAS.md` (primer dato real de adopción) y de `06_HISTORIAL_MARKETING.md` (primer testimonio).
