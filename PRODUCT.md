# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user and buying decision-maker: the rector/director of an individual Colombian school (colegio), evaluated one institution at a time — no chain/network buyer exists yet. Within each school, four other roles use the product day to day: docentes (teachers), estudiantes (students), padres (parents), and a colegio-level admin who does setup (crear colegio, grupos, docentes, estudiantes, asignaciones).

## Product Purpose

Playfesor is an academic management platform for Colombian schools that combines full academic administration (grades, attendance, official MEN report cards) with predictive AI: a risk-scoring engine that flags at-risk students, a conversational copilot for school leadership, an automatic academic observer that writes narrative reports, and a student AI tutor. It also automates parent communication over WhatsApp (absence alerts, low-grade alerts, weekly reports to the director, mass messaging). Success means a rector can see the real-time state of their institution and act on risk before it becomes irreversible, while teachers and admins spend less time on manual administrative work.

## Positioning

Not a generic school-management system with an AI feature bolted on: Playfesor is built specifically for the Colombian K-12 system (native MEN grading scale, official boletines, Spanish-language institutional tone) and ships predictive risk scoring, a conversational institutional copilot, and an automatic academic observer as one integrated system rather than separate add-on modules or a translated foreign product. WhatsApp — not email or a native app — is the primary channel to parents, matching how Colombian teachers and parents already communicate.

## Operating Context

- Currently in sales/demo stage: the product is functional but no school is yet running it in production with real student data. The landing page's purpose is booking demos with prospective rectors ("Quiero ver Playfesor en mi colegio").
- Hosted on cPanel (Conexcol); MySQL database; WhatsApp delivery via UltraMsg; AI features (copiloto, observador, tutor) via Claude Haiku.
- Expected real-world usage once adopted: rectores/directores reviewing institutional dashboards and risk alerts; docentes taking attendance, creating/grading activities, writing observations; estudiantes completing activities and using the AI tutor; padres receiving WhatsApp notifications and viewing a parent portal.

## Capabilities and Constraints

- Role-based dashboards: admin (colegio setup), director (institutional metrics, risk, copiloto, observador), docente, estudiante, padre — each with distinct routes and permissions.
- Academic core: grupos, materias, períodos, actividades with automatic grading, attendance (asistencias) with alerts, official MEN grading scale (bajo/básico/alto/superior) and boletines.
- Predictive risk engine: score 0–100 per student/subject from grade (40%), absences (30%), pending activities (30%), with bajo/medio/alto/crítico levels.
- AI features: Copiloto de Rectoría (conversational Q&A over real institutional data), Observador Académico (auto-generated narrative reports per group/subject), Tutor IA (guided help for students, not direct answers), weekly WhatsApp report to each director.
- WhatsApp integration: absence notifications, automatic low-grade alerts, mass institutional messaging, citaciones a reunión — via UltraMsg, not the official WhatsApp Business API (evaluating migration later).
- Constraint: backend has no axios installed — external HTTP calls use Node's built-in https/querystring.
- Undecided product fact: whether/when to migrate WhatsApp delivery from UltraMsg to the official WhatsApp Business API.

## Brand Commitments

- Name: Playfesor. Logo asset at `frontend/public/logo-icon.png`.
- Voice: professional, institutional Colombian tone (e.g., "Hablemos sobre su institución"), addressing rectores formally ("usted"). Copy explicitly targets non-technical staff ("Si maneja WhatsApp, maneja Playfesor").
- Positioning language already committed on the live landing page (`frontend/src/pages/LandingPage.js`): "el sistema de gestión académica para colegios que combina IA predictiva, boletines MEN, WhatsApp para padres, observador académico y dashboard institucional."

## Evidence on Hand

- No real school is yet running Playfesor in production and no customer testimonials, case studies, or usage data exist — future work must not fabricate school names, quotes, or results.
- Real, working feature demos exist in the product itself (Copiloto, Observador, Riesgo, boletines) and are already referenced/demoed on the landing page (e.g., CopilotDemo component) — these are legitimate evidence since they show the actual product, not invented claims.
- Landing page FAQ already states current status truthfully ("¿Playfesor ya está funcionando o es un prototipo?") — keep future copy consistent with the demo/pre-launch stage until a real school goes live.

## Product Principles

1. Everything is Colombian-native by default: MEN grading scale, official boletines, Spanish institutional tone — never a generic or translated school-software pattern.
2. AI features must visibly use real institutional data, not generic text generation — this is the core differentiator from a traditional academic management system.
3. WhatsApp is the primary parent-facing channel because it matches actual behavior of Colombian teachers/parents, not because it's the easiest integration.
4. The rector is the entry point and primary design target for institutional/dashboard surfaces; docente, estudiante, and padre surfaces serve daily workflows but the sales narrative centers on the rector's view of the whole institution.
5. Never fabricate customer evidence (school names, testimonials, results) while the product is pre-launch — real product demos are the only legitimate proof point until a school goes live.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond standard practice.
