# Manual del administrador

Guía para el administrador del colegio (generalmente rector, coordinador, o la persona designada
para gestionar la plataforma). No requiere conocimientos técnicos.

## Roles del sistema

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Gestiona la institución, grupos, docentes, estudiantes, materias, períodos, y a los padres vinculados. |
| **Director** | Ve métricas institucionales, riesgo académico, comparativas entre grupos/materias, y usa las herramientas de IA (Copiloto, Observador). |
| **Docente** | Crea actividades, califica, pasa lista de asistencia, genera boletines de sus grupos. |
| **Estudiante** | Resuelve actividades, ve sus notas y su progreso, usa el Tutor IA. |
| **Padre** | Ve el progreso académico de sus hijos vinculados (notas, asistencia, nivel de riesgo). |

## Flujo de trabajo típico al iniciar el año

1. **Configurar períodos académicos** — define las fechas de cada período del año lectivo.
2. **Crear grupos** — un grupo por grado/curso (ej. "6°A", "7°B").
3. **Crear docentes** — cuentas de acceso para cada profesor.
4. **Asignar docentes a grupos y materias** — qué docente dicta qué materia en qué grupo.
5. **Crear o importar estudiantes** — de forma individual o por carga masiva.
6. **Asignar estudiantes a sus grupos**.
7. (Opcional) **Vincular cuentas de padres** a sus hijos, desde el módulo de Padres.

A partir de aquí, cada docente ya puede crear actividades y los estudiantes resolverlas — el
sistema califica automáticamente y genera alertas si el desempeño de un estudiante baja.

## Módulos principales (panel de administrador)

- **Mi institución** — datos del colegio, logo.
- **Grupos**, **Docentes**, **Estudiantes**, **Materias**, **Períodos**, **Padres** — gestión básica.

## Módulos del director

- **Centro de Métricas** — vista general del desempeño institucional.
- **Motor de Riesgo** — estudiantes en riesgo académico (bajo, medio, alto, crítico), calculado
  automáticamente cada noche a partir de notas, asistencia y actividades pendientes.
- **Copiloto de Rectoría** — asistente conversacional que responde preguntas sobre el estado
  académico del colegio con datos reales.
- **Observador Académico** — genera informes narrativos automáticos por grupo y materia.
- **Planes de Mejoramiento** — planes generados por IA para estudiantes en riesgo alto/crítico.

## Escala de calificación

El sistema usa la escala oficial del MEN colombiano:

| Nota | Nivel |
|---|---|
| 1.0 – 2.9 | Desempeño Bajo |
| 3.0 – 3.9 | Desempeño Básico |
| 4.0 – 4.5 | Desempeño Alto |
| 4.6 – 5.0 | Desempeño Superior |

## Notificaciones automáticas

- Si un estudiante saca una nota menor a 3.0, se notifica automáticamente por WhatsApp al padre
  vinculado (si el colegio activó el módulo de WhatsApp y el padre tiene teléfono registrado).
- Los directores reciben un informe semanal por WhatsApp los domingos a las 6 p.m.

## Recuperar contraseña

Cualquier usuario puede usar "Olvidé mi contraseña" desde la pantalla de login — llega un enlace al
correo registrado, válido por 30 minutos.

## Si algo no funciona

Contacta a quien administra técnicamente esta instalación (quien hizo la implementación). Si eres
tú mismo quien administra el hosting, revisa primero `docs/HOSTING.md` y `docs/SEGURIDAD.md`.
