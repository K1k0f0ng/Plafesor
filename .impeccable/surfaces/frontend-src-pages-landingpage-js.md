---
version: 1
slug: "frontend-src-pages-landingpage-js"
primary_target: "frontend/src/pages/LandingPage.js"
related_targets: []
---

# Surface: frontend/src/pages/LandingPage.js

Scope: full redesign (replacement visual world). Mode: Persuade.
Audience: rector/director of an individual Colombian colegio, the buying decision-maker, evaluating one institution at a time.
Job: decide whether Playfesor is credible and worth a demo, in under a minute.
Action: submit the "Solicitar demo" form (unchanged goal from the incumbent page).
Proof/content: real product demos already exist (Copiloto, Observador, riesgo, boletines) — legitimate evidence, no fabricated testimonials or school names (product is pre-launch).
Constraints: keep logo (`frontend/public/logo-icon.png`), WhatsApp contact channel, `/login` route, demo form fields, MEN/PIAR factual claims as already stated in PRODUCT.md — content and function preserved, only the visual world replaces the incumbent dark-SaaS-dashboard look.

## Direction contract

THESIS: The landing reads as an official statistical bulletin (boletín de indicadores institucionales) a Colombian rector already trusts and recognizes — refusing the dark-dashboard-with-floating-mockup-and-bento-cards arrangement the incumbent page (and every AI-generated SaaS landing) ships.

OWN-WORLD: Cool bond-paper white/light-gray ground, never warm cream. Deep institutional blue as the structural ink for type, rules, and chrome. A three-to-four-step amber→orange→red risk scale (matching the product's own bajo/medio/alto/crítico levels) is the only saturated color, reserved exclusively for real risk data — never decorative elsewhere (nav, buttons, chips stay ink-on-paper). Technical grotesk sans (IBM Plex Sans or Space Grotesk) carries headlines and UI; a monospace (IBM Plex Mono) sets data figures, folio/edition codes, and methodological footnotes. No display serif, no glow, no glassmorphism, no gradient, no dark mode.

STORY: A rector sees their own institution rendered as a live statistical bulletin: a large choropleth/heatmap of academic risk by grado as the first thing they see, one giant headline figure (e.g., students at risk detected this week) beside it, small methodological-footnote-style copy building institutional trust, then the same bulletin rigor applied section by section (escala MEN, WhatsApp, copiloto, observador, capacidades) — ending in the demo form styled as the bulletin's official "solicitud" panel.

FIRST VIEWPORT: Full-bleed hero styled as the cover of an official statistical bulletin: a folio/edition code and date top-left (like a real DANE/MEN bulletin's edition number), a live risk choropleth/heatmap of the institution's grados as the dominant visual, one oversized headline number beside it, the H1 and CTA set in the grotesk face at the foot of the cover panel, a methodological footnote line in mono type along the base.

FORM: "El Boletín Estadístico DANE-MEN" — my own top-ranked grounded candidate (index 1 of 7 ranked by resonance), chosen by the user over the dice-assigned direction (index 6, "La Citación Institucional") via the decision page. Seed key 9400c2c8, chosen kind: pick.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions
- Exact composition of the risk choropleth (map-of-Colombia motif vs. grid-of-grados) to be resolved during the hero build.
- Whether the "apuestas" competitive-comparison cards (vs. Q10/Phidias/etc.) survive as a bulletin-style comparison table or are cut — resolve during section build, preserving the underlying competitive claims.
