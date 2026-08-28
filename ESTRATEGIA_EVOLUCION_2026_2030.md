# PLAYFESOR — ESTRATEGIA DE EVOLUCIÓN 2026–2030
## Plataforma de Inteligencia Institucional Educativa

**Elaborado por:** Comité Estratégico Internacional  
**Fecha:** Mayo 2026  
**Versión:** 1.0  
**Clasificación:** Confidencial — Uso interno fundadores

---

# RESUMEN EJECUTIVO

Playfesor tiene hoy lo más difícil: está en producción, tiene datos reales, tiene usuarios reales. La mayoría de startups muere antes de llegar aquí.

El desafío ahora no es técnico. Es de visión.

Con el stack actual (Node.js + MySQL + React) y la arquitectura de datos existente, Playfesor puede transformarse en la plataforma de inteligencia educativa más importante de Colombia en 36 meses, con una inversión tecnológica incremental y sin reescribir nada desde cero.

Este documento es la hoja de ruta para ese salto.

---

# FASE 1 — DIAGNÓSTICO ESTRATÉGICO

## 1.1 Nivel de Madurez

**Clasificación: BÁSICO–INTERMEDIO (transición)**

| Dimensión | Nivel | Justificación |
|---|---|---|
| Gestión operativa | Intermedio | CRUD completo, roles, multi-colegio |
| Analítica | Básico | Solo reportes estáticos por grupo×materia |
| Predicción | Inexistente | No hay scoring de riesgo |
| Recomendación | Inexistente | No hay motor de sugerencias |
| Automatización | Básico | Solo calificación automática |
| IA Generativa | Inexistente | No hay LLM integrado |

**Justificación extendida:**  
Playfesor cumple la función de *sistema de registro académico digital*, que es el piso mínimo del mercado EdTech. La calificación automática y el motor de actividades interactivas lo elevan ligeramente sobre el nivel básico. Sin embargo, todos los datos generados (notas, tiempos, intentos, resultados por actividad) permanecen dormidos: se acumulan sin producir inteligencia, alertas ni recomendaciones. Ese es el vacío estratégico central.

---

## 1.2 Tipo de Producto Actual

**Clasificación: Sistema Académico Digital con elementos de LMS básico**

No es un LMS completo (no tiene foros, videoconferencia, gestión de contenidos estructurados, SCORM).  
No es un ERP educativo (no gestiona nómina, inventario, pagos, cartera).  
No es una plataforma analítica (no tiene dashboards de inteligencia, cohorts, tendencias).

Es un **Sistema Académico Digital** que combina:
- Gestión de entidades educativas (colegios, grupos, docentes, estudiantes)
- Motor de actividades interactivas (diferenciador real)
- Calificación automática con escala MEN
- Reportes básicos por grupo×materia

El motor de actividades interactivas con 5 tipos (opción múltiple, verdadero/falso, ordenar pasos, completar espacios, relacionar columnas) es el **activo tecnológico más valioso** actual. Pocas plataformas colombianas tienen esto implementado de manera nativa.

---

## 1.3 Fortalezas

### Ventajas Competitivas Actuales

1. **Motor de actividades interactivas nativo** — 5 tipos implementados, calificación automática, retroalimentación inmediata. Phidias y Q10 no tienen esto en el mismo nivel.

2. **Diseño multi-colegio desde el origen** — La arquitectura con `colegio_id` en todas las tablas permite escalar a red de colegios sin rediseño.

3. **Escala MEN Colombia implementada** — Validación local que plataformas internacionales (Google Classroom, Canvas) no tienen.

4. **Datos de comportamiento estudiantil** — La tabla `resultados_actividades` guarda nota, tiempo empleado, intento número, respuestas JSON. Con estos datos se puede construir un motor predictivo sin necesidad de recolectar datos nuevos.

5. **En producción real** — No es un prototipo. Tiene usuarios reales generando datos reales. Esto es una ventaja brutal frente a competidores que siguen en "fase piloto".

6. **Stack simple y mantenible** — Node.js + MySQL + React sin dependencias complejas. Fácil de extender, fácil de escalar horizontalmente.

### Activos Tecnológicos

- Tabla `resultados_actividades` con respuestas JSON completas (no solo nota final) → base para análisis de patrones de error
- Tabla `docente_grupos_materias` → mapa completo de responsabilidades académicas
- Endpoint de reportes ya funcional → base para analítica avanzada
- Importación masiva por CSV → onboarding rápido de instituciones grandes

### Activos de Negocio

- Marca registrada en `.co` (playfesor.co)
- Primeros clientes reales generando casos de uso reales
- Conocimiento profundo del sistema MEN colombiano
- Posición en un mercado con +10.000 colegios en Colombia, mayormente sin digitalizar

---

## 1.4 Debilidades

### Vacíos Funcionales Críticos

1. **Sin capa de analítica institucional** — El rector no tiene visibilidad de su colegio. El dato más importante (¿cómo va mi colegio?) no existe como vista.

2. **Sin sistema de alertas** — Un estudiante puede ir cayendo durante semanas y nadie en la plataforma lo sabe hasta que ya es tarde.

3. **Sin módulo de padres** — Los acudientes no tienen acceso. En Colombia el padre es un actor clave en la permanencia del estudiante.

4. **Sin seguimiento longitudinal** — No hay comparación período a período, año a año. El histórico existe en la BD pero no se visualiza.

5. **Sin generación de documentos oficiales** — Observador, boletín, plan de mejoramiento, citación: el colegio los genera en Word manualmente.

6. **Sin integración con el calendario académico** — No hay concepto de "semana actual", "período activo", "días hábiles restantes".

7. **Sin gestión de asistencia** — La asistencia es el predictor #1 de deserción y no está en la plataforma.

### Riesgos

1. **Riesgo de comoditización** — Sin diferenciación por IA, cualquier colegio puede migrar a Google Classroom (gratis) o Phidias (más maduro).

2. **Riesgo de dato muerto** — Si los colegios generan datos pero no obtienen valor de ellos, el churn aumenta en el año 2.

3. **Riesgo de escalabilidad técnica** — MySQL en cPanel con una sola instancia no escala bien más allá de ~50 colegios activos concurrentes.

4. **Riesgo de incumbentes** — Q10 lleva más de 15 años en Colombia y tiene integración con el MEN. Phidias tiene app móvil y notificaciones push.

### Amenazas Competitivas

| Amenaza | Probabilidad | Impacto |
|---|---|---|
| Google lanza Classroom Pro con IA en español | Alta | Alto |
| Q10 integra IA generativa en 12 meses | Media | Alto |
| EdTech regional (Chile/México) entra a Colombia | Media | Medio |
| Colegio grande desarrolla plataforma propia | Baja | Medio |

---

# FASE 2 — ARQUITECTURA DE EVOLUCIÓN

## Modelo de 6 Capas de Inteligencia

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 6 — IA GENERATIVA                                 │
│  Generación de contenido, observaciones, planes, tutorías│
├─────────────────────────────────────────────────────────┤
│  CAPA 5 — AUTOMATIZACIÓN                                │
│  Acciones automáticas sin intervención humana            │
├─────────────────────────────────────────────────────────┤
│  CAPA 4 — RECOMENDACIÓN                                 │
│  Motor de sugerencias para cada rol                      │
├─────────────────────────────────────────────────────────┤
│  CAPA 3 — PREDICCIÓN                                    │
│  Scoring de riesgo, modelos probabilísticos              │
├─────────────────────────────────────────────────────────┤
│  CAPA 2 — ANALÍTICA                                     │
│  Dashboards, tendencias, comparativas, KPIs              │
├─────────────────────────────────────────────────────────┤
│  CAPA 1 — OPERACIÓN (YA EXISTE)                         │
│  Gestión académica, actividades, calificación             │
└─────────────────────────────────────────────────────────┘
```

---

### CAPA 1 — OPERACIÓN (Estado actual)

**Ya implementado:**
- Gestión de colegios, grupos, docentes, estudiantes, materias
- Motor de actividades con 5 tipos interactivos
- Calificación automática con escala MEN
- Reportes básicos grupo×materia

**Completar en esta capa (Roadmap corto plazo):**
- Export a Excel (Tarea 1 del roadmap actual)
- Dashboard director (Tarea 3)
- Lista de pendientes por actividad (Tarea 4)
- Alertas básicas de desempeño bajo (Tarea 5)
- Módulo de asistencia (nuevo)
- Boletín de calificaciones oficial (nuevo)
- Gestión de períodos académicos con fechas (nuevo)

---

### CAPA 2 — ANALÍTICA

**Objetivo:** Convertir datos dormidos en información accionable.

**Nuevos componentes:**

**Centro de Métricas Institucional (CMI)**
```
Entidad raíz: colegio_id
├── Salud académica global (promedio ponderado todos los grupos)
├── Evolución período a período (P1 vs P2 vs P3)
├── Ranking de grupos por desempeño
├── Ranking de materias por tasa de aprobación
├── Ranking de docentes por impacto académico
├── Mapa de calor: grado × materia × nivel de desempeño
└── Tendencia semanal: promedio institucional últimas 8 semanas
```

**Analítica del Docente**
```
Por docente:
├── Comparativa de sus grupos
├── Qué actividades tienen mayor impacto en la nota final
├── Distribución de tiempos: cuánto tarda cada estudiante en promedio
├── Tasa de finalización por actividad
└── Correlación: tipo de actividad vs nota obtenida
```

**Analítica del Estudiante**
```
Por estudiante:
├── Evolución de notas semana a semana
├── Comparativa vs promedio del grupo
├── Fortalezas: materias donde supera el promedio
├── Debilidades: materias donde está bajo el promedio
├── Tiempo de estudio acumulado (suma de tiempo_empleado_segundos)
└── Patron de actividad: ¿a qué hora del día hace las actividades?
```

**Tablas nuevas de BD:**
```sql
periodos_academicos (id, colegio_id, nombre, fecha_inicio, fecha_fin, activo)
asistencias (id, estudiante_id, grupo_id, fecha, estado ENUM('presente','ausente','tardanza','justificado'))
metricas_semanales (id, colegio_id, semana, promedio_institucional, total_actividades_completadas, created_at)
```

---

### CAPA 3 — PREDICCIÓN

**Objetivo:** Anticipar problemas antes de que ocurran.

**Motor de Scoring de Riesgo Académico (MSRA)**

Algoritmo basado en reglas ponderadas (sin ML en fase inicial, escalable a ML después):

```
SCORE_RIESGO_ACADEMICO = Σ (factor × peso)

Factores y pesos:
├── Promedio actual vs promedio del grupo          (peso: 25%)
├── Tendencia últimas 3 semanas (pendiente)        (peso: 20%)
├── Tasa de inasistencia en el período             (peso: 20%)
├── % actividades completadas vs asignadas         (peso: 15%)
├── Número de intentos promedio por actividad      (peso: 10%)
├── Velocidad de deterioro (caída > 1 punto/semana)(peso: 10%)

RESULTADO:
├── 0–30:  Riesgo Bajo (verde)
├── 31–60: Riesgo Medio (amarillo)
├── 61–80: Riesgo Alto (naranja)
└── 81–100: Riesgo Crítico (rojo)
```

**Motor de Predicción de Pérdida de Año**

```sql
-- Tabla nueva
predicciones_riesgo (
  id, estudiante_id, grupo_id, materia_id, periodo,
  score_riesgo DECIMAL(5,2),
  probabilidad_perdida DECIMAL(5,2),
  factores_detectados JSON,
  nivel_urgencia ENUM('bajo','medio','alto','critico'),
  calculado_en TIMESTAMP,
  accion_tomada BOOLEAN DEFAULT FALSE
)
```

**Proceso:** Job nocturno (cron) que recalcula scores para todos los estudiantes activos. Se ejecuta a las 2 AM cada día. Costo computacional mínimo, impacto de valor máximo.

---

### CAPA 4 — RECOMENDACIÓN

**Objetivo:** Decirle a cada actor qué hacer, no solo qué está pasando.

**Motor de Recomendaciones por Contexto**

```
Para el Rector:
├── "El grupo 8-A tiene el peor promedio del colegio (2.7). Recomendación: 
     revisar asignación docente en Matemáticas."
├── "La tasa de inasistencia de grado 6° aumentó 15% esta semana. 
     Revisar situación de convivencia."
└── "Período 2 cierra en 3 semanas. 23 estudiantes en riesgo de perder 
     al menos una materia."

Para el Docente:
├── "12 estudiantes de 8-A no han completado la actividad de Fracciones. 
     Considera extender el plazo o crear una versión más simple."
├── "Juan Pérez lleva 3 semanas con notas por debajo de 2.5. 
     Sugerencia: contactar al acudiente."
└── "Las actividades de tipo 'ordenar pasos' tienen 40% más tasa de 
     finalización que las de opción múltiple en tu grupo."

Para el Estudiante:
├── "Tu nota en Matemáticas bajó de 4.2 a 3.1 esta semana. 
     Tienes 2 actividades pendientes."
├── "¡Llevas 5 días sin actividad en Ciencias Naturales! 
     La actividad 'El ecosistema' vence el viernes."
└── "Tu mejor materia es Inglés (promedio 4.6). 
     Tu área de mejora prioritaria: Matemáticas."
```

---

### CAPA 5 — AUTOMATIZACIÓN

**Objetivo:** Acciones automáticas sin que nadie tenga que decidirlas manualmente.

**Automatizaciones de alto valor:**

| Trigger | Acción Automática |
|---|---|
| Estudiante con score riesgo > 80 | Crear alerta en panel del docente + notificación WhatsApp al padre |
| Período académico cerrado | Generar boletín PDF de todos los estudiantes del colegio |
| Actividad sin completar 48h antes del vencimiento | Notificación al estudiante y al padre |
| Docente sin subir actividades en 2 semanas | Alerta al director académico |
| Promedio del grupo cae > 0.5 puntos en una semana | Alerta automática al rector |
| Estudiante con 3+ inasistencias consecutivas | Notificación automática al acudiente |

**Tablas nuevas:**
```sql
automatizaciones_log (id, tipo, entidad_id, resultado, ejecutado_en)
notificaciones (id, destinatario_id, canal ENUM('plataforma','whatsapp','email'), 
                mensaje, leido, enviado_en)
```

---

### CAPA 6 — IA GENERATIVA

**Objetivo:** Usar LLMs para generar contenido educativo de alta calidad.

**Integración técnica recomendada:** Claude API (Anthropic) como motor de IA.

**Casos de uso generativos:**

1. **Generador de actividades** — El docente describe el tema y el nivel, la IA genera la actividad completa en formato JSON compatible con el motor existente.

2. **Observador automático** — La IA lee el historial del estudiante y genera la observación académica oficial en el formato del colegio.

3. **Planes de mejoramiento** — La IA genera el PIAR (Plan Individual de Ajustes Razonables) o Plan de Mejoramiento cuando un estudiante pierde una competencia.

4. **Copiloto de Rectoría** — Chat en lenguaje natural donde el rector pregunta y la IA responde con datos reales de la base de datos.

5. **Tutor personalizado** — La IA explica temas, genera ejercicios adicionales, y prepara al estudiante para recuperaciones.

**Arquitectura de integración IA:**
```
Frontend → Backend (Node.js) → Capa IA (Claude API)
                                      ↓
                              Contexto: datos del estudiante/colegio
                                      ↓
                              Respuesta estructurada (JSON o texto)
                                      ↓
                              Guardado en BD (cache de respuestas IA)
```

**Costo estimado Claude API:** $3–15 USD por cada 1 millón de tokens. Un colegio de 500 estudiantes generando observaciones mensuales: ~$2–5 USD/mes. Costo marginal insignificante comparado con el valor percibido.

---

# FASE 3 — SISTEMA DE ALERTA TEMPRANA ACADÉMICA 360°

## Motor de Alertas Institucionales

### Arquitectura del sistema

```
[Job nocturno — 2 AM]
        ↓
[Leer resultados_actividades + asistencias últimos 30 días]
        ↓
[Calcular score por estudiante×materia×período]
        ↓
[Clasificar: Bajo/Medio/Alto/Crítico]
        ↓
[Insertar/actualizar en tabla predicciones_riesgo]
        ↓
[Generar notificaciones para docente/director según umbral]
        ↓
[Enviar WhatsApp/email si configurado]
```

### Tipos de riesgo y detección

---

#### RIESGO ACADÉMICO

**Señales detectadas:**
```
Bajo rendimiento:
├── Promedio < 3.0 en cualquier materia del período activo
├── Nota en última actividad < 2.0 (desempeño bajo severo)
└── Promedio cae > 1.0 punto entre semanas consecutivas

Caída de desempeño:
├── Tendencia negativa en 3 semanas consecutivas
├── Varianza alta: notas inconsistentes (3.8, 2.1, 4.0, 1.8)
└── Mejora seguida de caída: patrón "montaña rusa"

Materias críticas:
├── Matemáticas o Lenguaje bajo 3.0 (materias ancla del MEN)
└── 2+ materias simultáneamente en riesgo

Incumplimiento de actividades:
├── > 30% de actividades sin completar en el período
└── Sin actividad registrada en los últimos 7 días hábiles
```

**Ejemplo de alerta generada:**
```json
{
  "tipo": "RIESGO_ACADEMICO",
  "nivel": "CRITICO",
  "estudiante": "Juan Pérez",
  "grupo": "8-A",
  "materia": "Matemáticas",
  "descripcion": "Juan pasó de 4.2 a 2.8 en 3 semanas consecutivas",
  "probabilidad_perdida": 0.73,
  "score_riesgo": 82,
  "urgencia": "ESTA_SEMANA",
  "recomendacion": "Contactar acudiente, programar refuerzo",
  "plan_accion": [
    "Llamar al padre/madre esta semana",
    "Asignar actividades de refuerzo nivel básico",
    "Programar clase de apoyo si el colegio lo permite",
    "Revisar en 5 días hábiles"
  ],
  "seguimiento": "2026-06-05"
}
```

---

#### RIESGO DE DESERCIÓN

**Señales detectadas:**
```
Ausencias:
├── 3+ inasistencias consecutivas
├── > 20% de inasistencias en el mes
└── Patrón: ausencias los lunes y viernes (señal clásica de desvinculación)

Bajo compromiso:
├── Tasa de completación de actividades < 40%
├── Tiempo empleado por actividad < 30% del tiempo promedio del grupo
└── Sin acceso a la plataforma en 5+ días hábiles

Historial académico:
├── Pérdida del año anterior (dato de matrícula)
└── Repitencia de grado

Tendencias negativas combinadas:
├── Bajo rendimiento + alta inasistencia simultáneos
└── Deterioro sostenido > 4 semanas sin recuperación
```

---

#### RIESGO DISCIPLINARIO

**Señales detectadas:**
```
├── Reportes en observador > 2 en el mismo período
├── Citaciones de acudiente > 1 en el período
└── Conductas repetitivas marcadas por docente en mismo período
```

**Nota:** Este módulo requiere el Observador Académico (Fase 6) para funcionar completamente.

---

#### RIESGO INSTITUCIONAL

**Señales detectadas a nivel colegio:**
```
Grupos críticos:
├── Grupo con promedio institucional más bajo (bottom 20%)
├── Grupo con mayor tasa de inasistencia
└── Grupo con menor tasa de completación de actividades

Áreas críticas:
├── Materia con mayor tasa de pérdida
├── Materia sin actividades asignadas en > 2 semanas
└── Materia sin docente asignado activo

Docentes con bajo desempeño:
├── Sus grupos tienen promedios consistentemente bajo el promedio institucional
├── No ha subido actividades en > 3 semanas
└── Tasa de respuesta a alertas < 20%
```

---

# FASE 4 — COPILOTO DE RECTORÍA

## Diseño del Asistente Ejecutivo con IA

### Concepto

El rector abre Playfesor en la mañana y ve un dashboard que le habla. No en jerga técnica sino en lenguaje ejecutivo:

> "Buenos días. Esta semana tienes 8 estudiantes en riesgo crítico, el grupo 7-B bajó su promedio 0.8 puntos en 5 días, y el período 2 cierra en 18 días. Te recomiendo revisar primero las alertas de 7-B."

### Interfaz del Copiloto

**Panel izquierdo:** Chat en lenguaje natural  
**Panel derecho:** Visualización dinámica de los datos consultados

```
Preguntas que el rector puede hacer:

Rendimiento:
├── "¿Cuál es el grupo con peor promedio esta semana?"
├── "¿Qué materias tienen más estudiantes en Desempeño Bajo?"
├── "¿Cómo va el colegio comparado con el período anterior?"
└── "¿Cuáles son mis 10 estudiantes con mayor riesgo de pérdida?"

Docentes:
├── "¿Qué docente tiene mejor impacto en sus grupos?"
├── "¿Qué docente lleva más tiempo sin subir actividades?"
└── "¿Cuál es el ranking de docentes por resultados?"

Decisiones:
├── "¿Qué debo hacer esta semana?"
├── "¿Qué grupos necesitan intervención urgente?"
└── "¿Tenemos riesgo de bajo rendimiento en las pruebas Saber?"
```

### Arquitectura técnica del Copiloto

```
[Rector escribe pregunta]
        ↓
[Backend convierte pregunta a intención: NLP básico o Claude API]
        ↓
[Motor de consulta: traduce intención a SQL o queries predefinidas]
        ↓
[Ejecuta query en MySQL: resultados reales del colegio]
        ↓
[Claude API: recibe datos + pregunta → genera respuesta en lenguaje natural]
        ↓
[Respuesta mostrada en chat + visualización en panel derecho]
```

**Ejemplo de flujo:**
```
Rector pregunta: "¿Qué grupo va peor esta semana?"

Backend ejecuta:
SELECT g.nombre, AVG(r.nota) as promedio
FROM grupos g
JOIN estudiante_grupos eg ON g.id = eg.grupo_id
JOIN resultados_actividades r ON eg.estudiante_id = r.estudiante_id
WHERE g.colegio_id = [colegio_del_rector]
AND r.completada_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY g.id ORDER BY promedio ASC LIMIT 1;

Resultado: { grupo: "7-B", promedio: 2.6 }

Claude API genera:
"El grupo 7-B tiene el peor promedio esta semana con 2.6 — Desempeño Bajo 
según la escala MEN. Esta calificación es 1.1 puntos por debajo del promedio 
institucional. Tienes 12 estudiantes en ese grupo que requieren atención prioritaria."
```

### Informes Automáticos Generados por IA

**Informe Semanal (cada lunes a las 6 AM):**
```
RESUMEN SEMANA DEL [fecha]

🏫 Estado Institucional: [Bueno/Regular/Crítico]
📊 Promedio general: [X.X] ([tendencia vs semana anterior])
⚠️ Alertas activas: [N] estudiantes en riesgo
📅 Días para cierre de período: [N]

TOP 3 SITUACIONES QUE REQUIEREN ATENCIÓN:
1. [Situación más crítica + recomendación]
2. [Segunda situación]
3. [Tercera situación]

LOGROS DE LA SEMANA:
- [Positivos: estudiantes que mejoraron, grupos que subieron]

DECISIONES RECOMENDADAS PARA ESTA SEMANA:
[Lista de 3-5 acciones concretas]
```

**Informe Mensual:** Tendencias del mes, comparativa con meses anteriores, proyección del período.

**Informe Trimestral (fin de período):** Análisis completo del período, ranking de grupos y docentes, estudiantes en riesgo de pérdida de año, recomendaciones para el siguiente período.

**Informe Anual:** Cierre del año lectivo, tasas de promoción/reprobación por grado, evolución del colegio, benchmark vs el año anterior.

---

# FASE 5 — CENTRO DE INTELIGENCIA INSTITUCIONAL

## El Dashboard más importante de Playfesor

### Diseño conceptual

Este es el "Power BI Educativo" integrado. Reemplaza o complementa el dashboard actual del admin con inteligencia real.

```
┌─────────────────────────────────────────────────────────────┐
│  CENTRO DE INTELIGENCIA INSTITUCIONAL                       │
│  Colegio: [Nombre] | Período: [1/2/3] | Semana: [N]        │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ SALUD        │ SALUD        │ SALUD        │ ALERTAS       │
│ ACADÉMICA    │ DOCENTE      │ ESTUDIANTIL  │ ACTIVAS       │
│              │              │              │               │
│ Promedio     │ Top docente: │ En riesgo: 8 │ 🔴 Críticas:3 │
│ inst.: 3.4   │ Prof. García │ Destacados:12│ 🟡 Medias: 5  │
│ ▲ +0.2 vs P1 │ Impacto: +0.8│ Sin actividad│ 🟢 Bajas: 8  │
│              │              │ 7 días: 15   │               │
├──────────────┴──────────────┴──────────────┴───────────────┤
│  MAPA DE CALOR: GRUPOS × MATERIAS                          │
│                                                             │
│         MAT   LEN   ING   CNT   CSO   INF                  │
│  5-A  [ 3.8] [4.1] [3.9] [4.2] [3.7] [4.4]               │
│  6-A  [ 2.9] [3.4] [3.1] [3.6] [3.2] [3.8]  ← ALERTA     │
│  7-B  [ 2.6] [3.0] [2.8] [3.1] [3.3] [3.5]  ← CRÍTICO    │
│  8-A  [ 3.5] [3.8] [3.6] [4.0] [3.9] [4.1]               │
│  9-A  [ 4.0] [4.2] [3.9] [4.3] [4.0] [4.5]               │
├─────────────────────────────────────────────────────────────┤
│  PREDICCIONES IA              │  RECOMENDACIONES IA         │
│                               │                             │
│  Riesgo pérdida asignatura:   │  1. Intervenir grupo 7-B   │
│  23 estudiantes (12.4%)       │     esta semana             │
│                               │  2. Revisar Matemáticas     │
│  Riesgo pérdida de año:       │     grado 6 y 7             │
│  8 estudiantes (4.3%)         │  3. Reconocer progreso      │
│                               │     grupo 9-A (motivación)  │
│  Riesgo deserción:            │  4. Solicitar plan de       │
│  5 estudiantes (2.7%)         │     refuerzo a Prof. López  │
└─────────────────────────────────────────────────────────────┘
```

### Módulos del Centro de Inteligencia

**SALUD ACADÉMICA**
- Promedio institucional con tendencia (flecha arriba/abajo vs período anterior)
- Distribución de estudiantes por nivel MEN: % Bajo, % Básico, % Alto, % Superior
- Rendimiento por sede (si el colegio tiene varias)
- Rendimiento por jornada (mañana/tarde)
- Rendimiento por grado (5° al 9°)
- Evolución semanal: gráfico de líneas de las últimas 8 semanas

**SALUD DOCENTE**
- Ranking de docentes por impacto: comparativa del promedio de sus grupos vs el promedio institucional
- Docentes con mayor y menor actividad en la plataforma
- Correlación: docentes que más actividades generan vs mejores promedios
- Alertas: docentes sin actividad en 2+ semanas

**SALUD ESTUDIANTIL**
- Estudiantes destacados: top 10 por promedio general
- Estudiantes en riesgo: lista con score de riesgo y materias afectadas
- Mapa de asistencia semanal: visualización del patrón de inasistencia
- Distribución de actividad: activos vs inactivos en los últimos 7 días

**SALUD INSTITUCIONAL**
- Tasa de retención del año lectivo (estudiantes matriculados vs activos)
- Tasa de inasistencia institucional con tendencia
- Tasa de completación de actividades: % del total asignado que fue respondido
- Tasa de aprobación proyectada del período actual

---

# FASE 6 — OBSERVADOR ACADÉMICO INTELIGENTE

## Generación Automática de Observaciones

### Concepto

El observador académico es el documento oficial en Colombia donde se registran los comportamientos y situaciones académicas del estudiante. Actualmente, los docentes lo escriben a mano en Word o en sistemas legacy. Playfesor lo automatiza.

### Tipos de observaciones generadas

**OBSERVACIONES POSITIVAS** (generadas cuando el estudiante mejora)
```
Trigger: promedio sube > 0.5 en una semana O nota > 4.5 en actividad
Prompt a Claude: "Genera una observación positiva formal para un estudiante de 
grado [X] que mejoró su nota en [materia] de [anterior] a [actual]. 
Tono institucional colombiano."

Ejemplo generado:
"El estudiante [Nombre] ha demostrado notable progreso académico en la 
asignatura de Matemáticas durante la semana del [fecha], elevando su 
desempeño de nivel Básico a nivel Alto según la escala de valoración MEN. 
Este avance evidencia compromiso con su proceso de aprendizaje."
```

**OBSERVACIONES DE MEJORA** (llamado de atención preventivo)
```
Trigger: score riesgo entre 31-60 (nivel MEDIO)
Ejemplo generado:
"Se registra que el estudiante [Nombre] presenta dificultades en el 
cumplimiento de las actividades académicas asignadas en la asignatura de 
[materia]. Se recomienda reforzar los hábitos de estudio y cumplimiento 
de compromisos académicos."
```

**OBSERVACIONES CRÍTICAS** (situación urgente)
```
Trigger: score riesgo > 60 O nota < 2.0 en actividad
Ejemplo generado:
"El estudiante [Nombre] presenta una situación académica de alto riesgo 
en la asignatura de [materia], con un promedio de [nota] correspondiente 
a Desempeño Bajo. Se genera citación de acudiente para el día [fecha]."
```

**COMPROMISOS ACADÉMICOS**
```
Generado con: nombre del estudiante, materia, período, indicadores por mejorar
Incluye: compromisos específicos, fechas de seguimiento, firma requerida
```

**ACUERDOS DE SEGUIMIENTO**
```
Documento estructurado que incluye:
├── Situación actual del estudiante
├── Compromisos del estudiante
├── Compromisos del docente/institución
├── Compromisos del acudiente
├── Fecha de revisión
└── Firmas (estudiante, docente, acudiente, coordinador)
```

**CITACIONES**
```
Generadas automáticamente cuando:
├── Score riesgo > 80 (crítico)
├── 3+ inasistencias consecutivas
├── Nota final de período < 2.5 en materia ancla
└── Docente marca manualmente "requiere citación"

El sistema genera la citación en PDF lista para imprimir.
```

**RECOMENDACIONES PEDAGÓGICAS**
```
Para el docente: qué estrategias usar con estudiantes específicos
Para el director: qué grupos requieren intervención pedagógica
Para el rector: tendencias que afectan la calidad académica institucional
```

### Flujo técnico del Observador

```
[Cron nocturno o trigger manual]
        ↓
[Recoger datos: notas, tendencias, asistencia, historial]
        ↓
[Clasificar tipo de observación necesaria]
        ↓
[Construir prompt con contexto del estudiante]
        ↓
[Llamar Claude API → recibir texto de observación]
        ↓
[Guardar en tabla observaciones + asociar a estudiante]
        ↓
[Docente revisa, edita si quiere, y firma/aprueba]
        ↓
[Generar PDF oficial listo para archivo]
```

**Tabla nueva:**
```sql
observaciones (
  id, estudiante_id, docente_id, grupo_id, periodo,
  tipo ENUM('positiva','mejora','critica','compromiso','citacion','pedagogica'),
  contenido TEXT,
  generado_por_ia BOOLEAN,
  revisado BOOLEAN DEFAULT FALSE,
  aprobado_en TIMESTAMP,
  created_at TIMESTAMP
)
```

---

# FASE 7 — PLANES DE MEJORAMIENTO AUTOMÁTICOS

## Flujo Completo cuando un Estudiante Pierde

### Triggers de generación de Plan de Mejoramiento

```
Condiciones que activan el plan:
├── Nota de período < 3.0 en alguna competencia
├── Promedio final de materia < 3.0 al cierre del período
├── Pérdida de más de 2 indicadores de desempeño
└── Solicitud manual del docente
```

### Flujo completo del Plan de Mejoramiento

```
PASO 1: DIAGNÓSTICO AUTOMÁTICO
├── Sistema analiza todas las actividades del período
├── Identifica qué competencias/indicadores están bajo 3.0
├── Identifica los temas específicos donde el estudiante falló
├── Genera perfil de debilidades: "Juan falló en [tema específico]"
└── Calcula brecha: qué tan lejos está del mínimo aprobatorio

PASO 2: GENERACIÓN DEL PLAN (IA)
Prompt a Claude API:
"Genera un plan de mejoramiento para un estudiante de grado [X] 
que perdió [competencia] en [materia]. Sus errores más frecuentes 
fueron [lista de errores detectados en respuestas JSON]. 
Genera: 3 actividades de refuerzo, 2 talleres, 1 cuestionario 
de recuperación, recursos recomendados, y cronograma de 4 semanas."

PASO 3: ACTIVIDADES GENERADAS
├── Actividad 1: Nivel básico (concepto fundamental)
│   Tipo: opcion_multiple o completar_espacios
│   Objetivo: verificar comprensión del concepto base
│
├── Actividad 2: Nivel medio (aplicación)
│   Tipo: relacionar_columnas o ordenar_pasos
│   Objetivo: aplicar el concepto en contextos simples
│
├── Actividad 3: Nivel evaluativo (recuperación)
│   Tipo: todos los tipos mezclados
│   Objetivo: evaluación formal de recuperación
│
├── Taller 1: Ejercicios guiados (documento PDF generado)
├── Taller 2: Práctica autónoma
│
└── Cuestionario de recuperación: 
    Actividad formal que reemplaza la nota si supera 3.0

PASO 4: CALENDARIO DEL PLAN
├── Semana 1: Diagnóstico + Actividad 1 (refuerzo básico)
├── Semana 2: Actividad 2 (aplicación)
├── Semana 3: Talleres de práctica
└── Semana 4: Cuestionario de recuperación oficial

PASO 5: SEGUIMIENTO
├── Sistema monitorea si el estudiante completa cada etapa
├── Si completa Actividad 1 con > 3.0 → avanza automáticamente a Actividad 2
├── Si no completa → alerta al docente + notificación al padre
├── Registro de progreso visible para docente, director y rector

PASO 6: CIERRE DEL PLAN
├── Si supera el cuestionario de recuperación (≥ 3.0):
│   → Nota actualizada automáticamente
│   → Plan marcado como SUPERADO
│   → Observación positiva generada
│
└── Si no supera:
    → Plan marcado como NO SUPERADO
    → Alerta de riesgo de pérdida de año
    → Comité de evaluación y promoción activo
```

**Tabla nueva:**
```sql
planes_mejoramiento (
  id, estudiante_id, materia_id, grupo_id, periodo,
  diagnostico JSON,
  actividades_ids JSON,
  estado ENUM('activo','superado','no_superado','en_seguimiento'),
  generado_por_ia BOOLEAN,
  fecha_inicio DATE, fecha_limite DATE,
  nota_recuperacion DECIMAL(3,1),
  created_at TIMESTAMP
)
```

---

# FASE 8 — TUTOR IA PERSONALIZADO

## Aprendizaje Adaptativo con IA

### Concepto pedagógico

El Tutor IA no reemplaza al docente. Complementa el tiempo fuera del aula: las tardes, los fines de semana, el momento de estudiar solo en casa.

### Flujo funcional

```
[Estudiante abre "Mi Tutor" en su dashboard]
        ↓
[Selecciona materia y tema]
        ↓
[Sistema presenta diagnóstico rápido: 5 preguntas de nivel]
        ↓
[IA detecta nivel actual y debilidades específicas]
        ↓
[Tutor explica el concepto desde el nivel detectado]
        ↓
[Genera ejercicios progresivos: fácil → medio → difícil]
        ↓
[Estudiante responde, IA corrige y explica cada error]
        ↓
[Si aprueba nivel → sube al siguiente]
[Si falla → re-explica con analogía diferente]
        ↓
[Al final: resumen de sesión + recomendación de práctica]
        ↓
[Datos de sesión registrados → docente ve progreso]
```

### Arquitectura técnica

```
Frontend: Componente chat "Mi Tutor"
├── Historial de conversación por sesión
├── Visualización de progreso: barra de nivel
└── Botón "Generar ejercicio" → activa motor de actividades

Backend: Nuevo endpoint /api/tutor
├── POST /api/tutor/sesion (inicia sesión, envía contexto del estudiante)
├── POST /api/tutor/mensaje (envía mensaje, recibe respuesta)
└── GET /api/tutor/historial (historial de sesiones del estudiante)

Motor IA: Claude API
├── System prompt fijo: [rol de tutor, contexto MEN, nivel del estudiante]
├── Contexto dinámico: [notas actuales, debilidades detectadas, grado]
├── Restricción: respuestas máximo 150 palabras para estudiantes de primaria
└── Modo visual: si el tema lo permite, usar tablas o listas estructuradas
```

### Valor pedagógico

| Beneficio | Impacto |
|---|---|
| Disponible 24/7 | El estudiante estudia cuando puede, no solo cuando el docente está disponible |
| Personalizado | Detecta el nivel real y adapta la dificultad |
| Sin juicio | El estudiante pregunta sin miedo a quedar mal |
| Registrado | El docente ve de qué temas necesitó ayuda cada estudiante |
| Escalable | Un solo tutor para todos los estudiantes del colegio simultáneamente |

---

# FASE 9 — ECOSISTEMA WHATSAPP PARA PADRES

## Módulo de Comunicación con Familias

### Por qué WhatsApp y no email

En Colombia, el padre de familia de estrato 1-3 (mayoría de colegios públicos y privados básicos) no usa email pero tiene WhatsApp en su teléfono. La tasa de apertura de WhatsApp es del 98% vs 20% del email.

### Integración técnica

**Opción A — WhatsApp Business API (Meta)**
- Requiere cuenta verificada de empresa
- Costo: ~$0.005–0.02 USD por mensaje
- Escala a millones de mensajes
- Recomendado para > 500 colegios activos

**Opción B — Twilio WhatsApp (más fácil para empezar)**
- API simple, integración en 1 día
- Mismo costo por mensaje
- Sandbox para desarrollo gratuito
- Recomendado para fase inicial

### Mensajes automáticos enviados

```
1. NOTA REGISTRADA
"Hola [Nombre del padre/madre]. La nota de [Nombre estudiante] 
en [Materia] por la actividad '[Título]' fue de [X.X] — 
Desempeño [nivel MEN]. Ingresa a playfesor.co para ver el detalle."

2. ACTIVIDAD PENDIENTE (48h antes de vencer)
"[Nombre estudiante] tiene la actividad '[Título]' en [Materia] 
que vence mañana. Aún no la ha completado. 
¡Recuérdale que ingrese a Playfesor! 🎯"

3. INASISTENCIA
"Se registra inasistencia de [Nombre] el día de hoy 
([fecha]) en el colegio [Nombre colegio]. 
Si tiene alguna justificación, comuníquese con la institución."

4. FELICITACIÓN POR LOGRO
"¡Felicitaciones! [Nombre estudiante] obtuvo Desempeño Superior 
(nota [X.X]) en la actividad '[Título]' de [Materia]. 
¡Excelente trabajo! 🌟"

5. ALERTA ACADÉMICA
"⚠️ Atención: [Nombre estudiante] presenta Desempeño Bajo 
en [Materia] (promedio [X.X]). El colegio solicita una 
reunión. Por favor comuníquese con [Nombre docente]."

6. CITACIÓN
"El colegio [Nombre] le invita a una reunión sobre el 
proceso académico de [Nombre estudiante] el día [fecha] 
a las [hora]. Por favor confirme su asistencia respondiendo 
SÍ o NO."
```

### Chatbot IA para Padres

```
PADRE envía a WhatsApp del colegio:
"¿Cómo va mi hijo Juan Pérez?"

SISTEMA:
├── Identifica al padre por número de teléfono
├── Encuentra al estudiante vinculado
├── Consulta: notas actuales, actividades pendientes, asistencia
├── Envía a Claude API: "Resume el estado académico de este estudiante en 
    lenguaje simple para un padre de familia"
└── Responde en WhatsApp:

"Hola! Juan Pérez va así esta semana:

📊 Promedio general: 3.4 (Desempeño Básico)
✅ Materias bien: Informática (4.2) e Inglés (4.0)
⚠️ Materia para reforzar: Matemáticas (2.8)
📋 Actividades pendientes: 2

¿Quieres saber más sobre alguna materia específica?"
```

**Preguntas que el chatbot responde:**
- "¿Qué tareas tiene?" → lista de actividades pendientes
- "¿Qué materias están en riesgo?" → materias bajo 3.0
- "¿Cómo le fue en la última actividad?" → última nota registrada
- "¿Qué debe reforzar?" → debilidades identificadas por la IA
- "¿Cuándo es la próxima evaluación?" → próximas actividades con fecha límite

**Tabla nueva:**
```sql
acudientes (id, estudiante_id, nombre, telefono_whatsapp, activo)
notificaciones_whatsapp (id, acudiente_id, tipo, mensaje, estado ENUM('enviado','fallido','pendiente'), enviado_en)
```

---

# FASE 10 — IA POR ROL

## Oportunidades de IA para cada actor

---

### RECTOR

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | No sabe qué pasa en el colegio hasta que el problema ya explotó. Toma decisiones basadas en intuición o en lo que los docentes reportan verbalmente |
| **Procesos repetitivos** | Revisión manual de boletines, reuniones de comité de evaluación, informes para secretaría de educación |
| **Soluciones IA** | Copiloto de Rectoría (Fase 4), informes automáticos, alertas ejecutivas, comparativas históricas |
| **Impacto** | De "enterarme después" a "anticipar antes". Decisiones basadas en datos |
| **ROI** | Reducción de reuniones innecesarias, detección temprana que evita pérdidas masivas de año |

---

### DIRECTOR ACADÉMICO

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | Coordinación manual de planes de mejoramiento, revisión de observadores, citaciones |
| **Procesos repetitivos** | Generar planes de mejoramiento, escribir observaciones, convocar comités |
| **Soluciones IA** | Planes de mejoramiento automáticos (Fase 7), Observador inteligente (Fase 6), alertas por grupo |
| **Impacto** | Lo que tomaba 2 horas de redacción se genera en 30 segundos |
| **ROI** | Ahorro de 5-10 horas/semana de trabajo administrativo |

---

### COORDINADOR

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | Gestión de disciplina sin datos, seguimiento de inasistencias manual |
| **Procesos repetitivos** | Generación de citaciones, seguimiento de compromisos académicos |
| **Soluciones IA** | Generación automática de citaciones, mapa de inasistencias, alertas de riesgo disciplinario |
| **Impacto** | Intervención preventiva antes de que el problema escale |
| **ROI** | Reducción de deserción por seguimiento temprano |

---

### DOCENTE

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | Crear actividades desde cero toma horas, escribir observaciones es repetitivo, no sabe qué estudiantes están en riesgo hasta que ya es tarde |
| **Procesos repetitivos** | Diseñar actividades, calificar (ya automatizado), generar reportes, escribir observaciones |
| **Soluciones IA** | Generador de actividades con IA (Fase 6), Observador automático, alertas de riesgo, recomendaciones pedagógicas |
| **Impacto** | De 2h diseñando actividad a 5 minutos revisando la que generó la IA |
| **ROI** | Más tiempo para enseñar, menos para administrar |

**Caso de uso específico — Generador de Actividades:**
```
Docente escribe: "Quiero una actividad de Matemáticas sobre fracciones 
para grado 7, nivel medio, 15 preguntas"

IA genera:
{
  "titulo": "Fracciones: Suma y Resta",
  "tipo": "opcion_multiple",
  "preguntas": [
    {
      "texto": "¿Cuánto es 1/2 + 1/4?",
      "opciones": ["1/6", "3/4", "2/6", "1/3"],
      "correcta": 1
    },
    ...15 preguntas
  ]
}
Docente revisa, edita si quiere, y publica con 1 clic.
```

---

### ESTUDIANTE

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | No sabe en qué está fallando específicamente, no tiene guía fuera del aula, no recibe retroalimentación personalizada |
| **Procesos repetitivos** | Buscar recursos en YouTube, preguntar al docente por WhatsApp fuera de horario |
| **Soluciones IA** | Tutor IA personalizado (Fase 8), retroalimentación explicada por actividad, recomendaciones de estudio |
| **Impacto** | Aprendizaje disponible 24/7, personalizado a sus debilidades específicas |
| **ROI** | Mayor tasa de aprobación, mayor satisfacción con la plataforma |

---

### PADRE DE FAMILIA

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | No sabe qué pasa con su hijo hasta que llega el boletín. El colegio solo llama cuando ya hay un problema grave |
| **Procesos repetitivos** | Llamar al colegio para pedir información, ir presencialmente a reclamar boletín |
| **Soluciones IA** | Ecosistema WhatsApp (Fase 9), chatbot de consulta, notificaciones automáticas |
| **Impacto** | El padre se convierte en aliado del proceso académico, no en reactor a crisis |
| **ROI** | Mayor retención estudiantil (padre informado = estudiante que permanece) |

---

### ADMINISTRADOR (del SaaS — equipo Playfesor)

| Dimensión | Detalle |
|---|---|
| **Problemas actuales** | No sabe qué colegios están en riesgo de churn, cuáles usan la plataforma realmente vs cuáles la tienen inactiva |
| **Soluciones IA** | Dashboard de salud del SaaS: actividad por colegio, uso de features, predicción de churn, alertas de colegios sin actividad |
| **Impacto** | Intervención proactiva en colegios que están dejando de usar la plataforma antes de que cancelen |
| **ROI** | Reducción de churn, incremento de LTV (valor de vida del cliente) |

---

# FASE 11 — APUESTAS ESTRATÉGICAS DE DIFERENCIACIÓN

## Las 6 Apuestas que definen el futuro de Playfesor

---

## APUESTA #1 — MOTOR DE RIESGO ACADÉMICO PREDICTIVO

**Propuesta de valor:** "Playfesor te dice quién va a perder el año antes de que sea tarde."

**Por qué es diferenciador:**  
Ninguna plataforma colombiana hace esto. Q10 y Phidias muestran notas. Playfesor **predice** lo que va a pasar con esas notas.

**Implementación técnica:**

*Fase inicial (reglas ponderadas):*
```javascript
// Score calculado cada noche para cada estudiante×materia×período
async function calcularScoreRiesgo(estudianteId, materiaId, grupoId, periodoId) {
  
  // Factor 1: Promedio actual vs promedio del grupo
  const promedioEstudiante = await getPromedio(estudianteId, materiaId, periodoId);
  const promedioGrupo = await getPromedioGrupo(grupoId, materiaId, periodoId);
  const gap = promedioGrupo - promedioEstudiante;
  const f1 = Math.min(gap * 10, 25); // máx 25 puntos
  
  // Factor 2: Tendencia (pendiente de las últimas 3 semanas)
  const tendencia = await calcularTendencia(estudianteId, materiaId, 3);
  const f2 = tendencia < 0 ? Math.abs(tendencia) * 10 : 0; // máx 20 puntos
  
  // Factor 3: Tasa de inasistencia
  const tasaInasistencia = await getTasaInasistencia(estudianteId, grupoId);
  const f3 = tasaInasistencia * 0.20; // máx 20 puntos
  
  // Factor 4: % actividades no completadas
  const tasaIncumplimiento = await getTasaIncumplimiento(estudianteId, materiaId, periodoId);
  const f4 = tasaIncumplimiento * 0.15; // máx 15 puntos
  
  const scoreTotal = f1 + f2 + f3 + f4;
  
  return {
    score: Math.min(scoreTotal, 100),
    nivel: scoreTotal > 80 ? 'CRITICO' : scoreTotal > 60 ? 'ALTO' : 
           scoreTotal > 30 ? 'MEDIO' : 'BAJO',
    probabilidadPerdida: scoreTotal / 100 * 0.85 // calibración empírica
  };
}
```

*Fase avanzada (ML):*  
Después de 12 meses con datos históricos suficientes, reemplazar el modelo de reglas por un modelo de regresión logística entrenado con los propios datos de Playfesor. Los datos de `resultados_actividades` son el training set perfecto.

**KPIs de éxito:**  
- Precisión de predicción > 75% (de los predichos como "en riesgo", al menos 75% efectivamente pierde)
- Recall > 60% (de los que realmente pierden, al menos 60% fue predicho)
- Tiempo de anticipación: detectar el riesgo al menos 4 semanas antes del cierre del período

---

## APUESTA #2 — COPILOTO DE RECTORÍA

**Propuesta de valor:** "Tu asistente ejecutivo que conoce cada estudiante, cada grupo y cada docente de tu colegio."

**Por qué es diferenciador:**  
El rector colombiano típico gestiona entre 200 y 2.000 estudiantes sin un sistema de información ejecutivo real. Playfesor le da lo que ninguna otra plataforma ofrece: contexto institucional completo en lenguaje natural.

**Funcionalidades clave:**
1. Chat en lenguaje natural conectado a la BD real del colegio
2. Informes automáticos semanales/mensuales/trimestrales/anuales por email
3. Alertas ejecutivas: las 3 cosas más urgentes de la semana
4. Comparativas históricas: "¿Vamos mejor o peor que el período 1 del año pasado?"
5. Proyecciones: "¿Cuántos estudiantes proyecta perder el año con los datos actuales?"

**Argumento de venta B2B:**  
"Por $X al mes, tu rector tiene un asistente de inteligencia institucional que analiza toda la información del colegio cada noche y le dice exactamente qué hacer en la mañana."

---

## APUESTA #3 — OBSERVADOR INTELIGENTE

**Propuesta de valor:** "El observador académico se escribe solo."

**Por qué es diferenciador:**  
El observador académico es obligatorio en Colombia por normativa MEN. Es una de las tareas más tediosas del docente. Ninguna plataforma lo automatiza con IA.

**Impacto directo en venta:**  
Un docente colombiano escribe en promedio 30-50 observaciones al mes. Con Playfesor, la IA las genera en segundos y el docente solo revisa y firma. Tiempo ahorrado: 3-5 horas al mes por docente.

Este módulo solo, puede justificar la suscripción al Plan Profesional para muchos colegios.

---

## APUESTA #4 — TUTOR IA PERSONALIZADO

**Propuesta de valor:** "Cada estudiante tiene su propio tutor disponible 24/7."

**Por qué es diferenciador:**  
En Colombia, las clases de apoyo y tutorías privadas son un privilegio económico. Playfesor democratiza el acceso a tutoría personalizada para colegios públicos y privados de estrato bajo y medio.

**Diferenciación vs ChatGPT:** El Tutor IA de Playfesor conoce las notas del estudiante, sabe en qué actividades falló, conoce el currículo del colegio, y adapta la explicación al nivel del grado. ChatGPT no tiene ese contexto.

---

## APUESTA #5 — CENTRO DE INTELIGENCIA INSTITUCIONAL

**Propuesta de valor:** "El Power BI educativo que los colegios colombianos no tenían."

**Por qué es diferenciador:**  
Power BI y Tableau son herramientas genéricas que requieren expertos para configurarlas. El Centro de Inteligencia de Playfesor está preconfigurado para el contexto educativo colombiano: escala MEN, estructuras de grupos, períodos académicos, competencias curriculares.

**Caso de uso para secretarías de educación:**  
Si Playfesor logra que varias secretarías de educación municipal adopten la plataforma, el CII se convierte en un tablero de mando para toda la red de colegios de una ciudad. Ese es el paso al gobierno educativo.

---

## APUESTA #6 — GEMELO DIGITAL DEL COLEGIO

**Propuesta de valor:** "La versión digital completa de tu institución, viva y actualizada en tiempo real."

### Diseño del Gemelo Digital

El Gemelo Digital es la representación visual e interactiva del estado completo de un colegio en un momento dado. No es un reporte. Es una vista viva.

```
┌─────────────────────────────────────────────────────────────┐
│  🏫 COLEGIO NUESTRA SEÑORA DE LA ESPERANZA                  │
│  Gemelo Digital — Semana 22 de 2026                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ESTADO GENERAL: 🟡 ATENCIÓN REQUERIDA                      │
│  Salud Académica: 68/100 | Riesgo Proyectado: MEDIO         │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  MAPA DEL COLEGIO (vista por grado)       │               │
│  │                                           │               │
│  │  GRADO 5: 🟢 Saludable  (prom. 3.9)      │               │
│  │  GRADO 6: 🟡 Atención   (prom. 3.1)      │               │
│  │  GRADO 7: 🔴 Crítico    (prom. 2.7)      │               │
│  │  GRADO 8: 🟢 Saludable  (prom. 3.7)      │               │
│  │  GRADO 9: 🟢 Saludable  (prom. 4.0)      │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  📈 TENDENCIA: ↓ Bajando desde semana 18                    │
│  ⚠️ RIESGOS EMERGENTES: 3 grupos, 23 estudiantes           │
│  🔴 RIESGOS CRÍTICOS: 8 estudiantes necesitan intervención  │
│  🎯 RECOMENDACIÓN PRIORITARIA: Intervenir grado 7           │
│                                                             │
│  PROYECCIÓN FIN DE PERÍODO:                                 │
│  Sin intervención: 31 estudiantes perderían al menos 1 mat. │
│  Con intervención ahora: proyección baja a 12 estudiantes   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Componentes del Gemelo Digital:**
1. **Pulso académico:** Promedio institucional en tiempo real (se actualiza cada vez que un estudiante completa una actividad)
2. **Mapa de calor de grupos:** Visualización de todos los grupos con semáforo de salud
3. **Termómetro de riesgo:** Escala de 0-100 que sintetiza todos los indicadores
4. **Timeline de eventos:** Últimas alertas, últimas actividades, últimas notas registradas
5. **Panel de proyecciones:** Qué pasa si se actúa ahora vs qué pasa si no se actúa
6. **Feed de recomendaciones:** Las 5 acciones más urgentes con prioridad y responsable

---

# FASE 12 — VENTAJA COMPETITIVA

## Análisis Comparativo

| Característica | Moodle | Google Classroom | Canvas | Phidias | Q10 | **Playfesor** |
|---|---|---|---|---|---|---|
| Gratuito | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| En español Colombia | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| Escala MEN | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Actividades interactivas nativas | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ |
| Calificación automática | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ |
| IA Predictiva de riesgo | ❌ | ❌ | ❌ | ❌ | ❌ | 🔜 |
| Copiloto de Rectoría | ❌ | ❌ | ❌ | ❌ | ❌ | 🔜 |
| Observador automático | ❌ | ❌ | ❌ | ❌ | ❌ | 🔜 |
| Tutor IA personalizado | ❌ | ❌ | ❌ | ❌ | ❌ | 🔜 |
| WhatsApp para padres | ❌ | ❌ | ❌ | ⚠️ | ❌ | 🔜 |
| Planes mejoramiento automáticos | ❌ | ❌ | ❌ | ❌ | ⚠️ | 🔜 |
| App móvil | ❌ | ✅ | ✅ | ✅ | ⚠️ | 🔜 |
| Integración MEN oficial | ❌ | ❌ | ❌ | ⚠️ | ✅ | 🔜 |

**Qué tienen que Playfesor no tiene hoy:**
- Phidias: App móvil nativa, módulo de convivencia, gestión de horarios
- Q10: Integración directa con reportes MEN, ERP completo (nómina, cartera), presencia en 20+ años
- Google Classroom: Ecosistema completo Google (Drive, Meet, Gmail), gratuito

**Qué puede hacer Playfesor mejor que todos:**
1. **IA educativa contextualizada Colombia** — Ninguno tiene esto planeado en el corto plazo
2. **Inteligencia predictiva** — El modelo de datos de Playfesor ya tiene lo necesario para construirla
3. **Experiencia unificada** — Sin necesidad de integrar 5 herramientas diferentes
4. **Onboarding rápido** — Desde cero a operativo en 1 día (vs semanas con Q10)
5. **Precio accesible** — Dirigido a colegios medianos que Q10 ignora por no ser rentables

**Ventana de oportunidad:**  
Hay una ventana de 18-24 meses antes de que Q10 o Phidias integren IA real. Playfesor debe llegar primero y crear lock-in por datos (cuanto más tiempo usa el colegio Playfesor, más datos históricos tiene, más preciso es el motor predictivo, más caro es migrar).

---

# FASE 13 — MODELO DE NEGOCIO

## Estrategia SaaS por Planes

---

### PLAN BÁSICO — "Aula Digital"
**Precio:** $80.000 COP/mes (~$20 USD) por institución

**Público objetivo:** Colegios pequeños (<200 estudiantes), microcolegios, jardines con primaria

**Funcionalidades:**
- Hasta 200 estudiantes
- Gestión completa (colegios, grupos, docentes, estudiantes, materias)
- Motor de actividades interactivas (5 tipos)
- Calificación automática escala MEN
- Reporte básico por grupo×materia
- Export a Excel
- 1 colegio por cuenta
- Soporte por email

---

### PLAN PROFESIONAL — "Institución Inteligente"
**Precio:** $250.000 COP/mes (~$62 USD) por institución

**Público objetivo:** Colegios medianos (200-800 estudiantes)

**Funcionalidades (todo el Básico más):**
- Hasta 800 estudiantes
- Dashboard director con semáforo por grupos
- Alertas automáticas de Desempeño Bajo
- Sistema de alertas de riesgo académico (Fase 3)
- Centro de Métricas Institucional básico
- Observador académico (generación manual + asistida por IA)
- Planes de mejoramiento (con IA generativa básica)
- Notificaciones por email automáticas
- Módulo de asistencia
- Boletín oficial generado automáticamente
- Soporte prioritario

---

### PLAN PREMIUM — "Plataforma Educativa Completa"
**Precio:** $600.000 COP/mes (~$150 USD) por institución

**Público objetivo:** Colegios grandes (800-2.000 estudiantes), colegios privados con alto estándar

**Funcionalidades (todo el Profesional más):**
- Hasta 2.000 estudiantes
- Copiloto de Rectoría con chat en lenguaje natural
- Sistema de alerta temprana 360° completo (Fases 3 y 5)
- Centro de Inteligencia Institucional completo
- Tutor IA personalizado para estudiantes
- Planes de mejoramiento automáticos completos
- WhatsApp para padres (hasta 2.000 acudientes)
- Chatbot IA para padres
- Informes automáticos semanales/mensuales para rector
- Gemelo Digital del Colegio
- App móvil (año 2027)
- Soporte dedicado con gerente de cuenta

---

### PLAN IA INSTITUCIONAL — "Sistema Educativo Inteligente"
**Precio:** $1.500.000–5.000.000 COP/mes (negociado)

**Público objetivo:** Redes de colegios (3+), secretarías de educación, alianzas con alcaldías

**Funcionalidades (todo el Premium más):**
- Ilimitados estudiantes y colegios
- Panel de red: visión consolidada de todos los colegios
- IA entrenada con datos propios de la red
- Benchmark entre instituciones de la red
- API de integración con sistemas del MEN
- Reportes oficiales para Secretaría de Educación
- Consultoría de implementación incluida
- SLA garantizado (99.9% uptime)
- Servidor dedicado o despliegue en nube privada
- Equipo de soporte exclusivo

---

### Proyección de ingresos a 36 meses

| Mes | Colegios Básico | Colegios Pro | Colegios Premium | MRR Estimado |
|---|---|---|---|---|
| M6 | 20 | 5 | 1 | $2.9M COP |
| M12 | 50 | 20 | 5 | $11.5M COP |
| M18 | 100 | 50 | 15 | $25.5M COP |
| M24 | 200 | 120 | 40 | $62M COP |
| M36 | 400 | 300 | 100 | $155M COP |

**ARR proyectado año 3:** ~$1.860M COP (~$465.000 USD)

---

# FASE 14 — ROADMAP 2026–2030

## Cronograma Estratégico de Evolución

---

### ETAPA 1 — SISTEMA ACADÉMICO INTELIGENTE (2026 Q2–Q3)
**Duración:** 3–4 meses  
**Inversión:** Baja (trabajo en el stack actual)

**Hitos:**
- [ ] Export Excel (Tarea 1) — Semana 1
- [ ] Checklist onboarding admin (Tarea 2) — Semana 1
- [ ] Dashboard director con semáforo (Tarea 3) — Semana 2-3
- [ ] Lista de pendientes por actividad (Tarea 4) — Semana 3
- [ ] Alertas básicas Desempeño Bajo (Tarea 5) — Semana 4
- [ ] Módulo de asistencia — Mes 2
- [ ] Boletín oficial PDF — Mes 2-3
- [ ] Gestión de períodos con fechas — Mes 2
- [ ] Rol director en producción — Mes 3

**Meta comercial:** 30 colegios pagando al final de esta etapa

---

### ETAPA 2 — ANALÍTICA INSTITUCIONAL (2026 Q3–Q4)
**Duración:** 3–4 meses  
**Inversión:** Media (nuevas tablas, nuevos endpoints, nuevas vistas)

**Hitos:**
- [ ] Centro de Métricas Institucional (CMI) — básico
- [ ] Mapa de calor grupos×materias
- [ ] Dashboard de salud estudiantil
- [ ] Comparativas período a período
- [ ] Ranking de grupos y docentes
- [ ] Analítica por docente (impacto académico)
- [ ] Historial de evolución del estudiante
- [ ] Notificaciones por email automáticas
- [ ] Sistema de períodos académicos con fechas

**Meta comercial:** 80 colegios, primeros contratos Plan Profesional

---

### ETAPA 3 — PREDICCIÓN ACADÉMICA (2026 Q4 – 2027 Q1)
**Duración:** 4–5 meses  
**Inversión:** Alta (primer módulo de IA, integración Claude API)

**Hitos:**
- [ ] Motor de Scoring de Riesgo Académico (reglas ponderadas)
- [ ] Job nocturno de recálculo de riesgo
- [ ] Panel de alertas de riesgo en dashboard director y rector
- [ ] Copiloto de Rectoría básico (consultas predefinidas)
- [ ] Informes automáticos semanales (generados por IA)
- [ ] Primer módulo de Observador Académico asistido
- [ ] WhatsApp básico para padres (notificaciones unidireccionales)

**Meta comercial:** 150 colegios, primeros contratos Plan Premium

---

### ETAPA 4 — AUTOMATIZACIÓN INSTITUCIONAL (2027 Q1–Q3)
**Duración:** 6 meses  
**Inversión:** Alta (integraciones complejas, IA generativa completa)

**Hitos:**
- [ ] Planes de mejoramiento automáticos completos
- [ ] Observador académico completamente automático
- [ ] Tutor IA personalizado para estudiantes
- [ ] Chatbot WhatsApp para padres (bidireccional)
- [ ] Copiloto de Rectoría con lenguaje natural completo
- [ ] Automatizaciones de acciones (cron jobs complejos)
- [ ] Generador de actividades con IA
- [ ] Centro de Inteligencia Institucional completo
- [ ] Gemelo Digital básico

**Meta comercial:** 300 colegios, primeras redes de colegios

---

### ETAPA 5 — COLEGIO INTELIGENTE ASISTIDO POR IA (2027 Q4 – 2028+)
**Duración:** 12+ meses  
**Inversión:** Muy alta (infraestructura cloud, ML propio, app móvil)

**Hitos:**
- [ ] App móvil iOS y Android
- [ ] Motor ML entrenado con datos propios de Playfesor
- [ ] IA curricular: alineación con estándares MEN automatizada
- [ ] Integración API con MEN (reportes oficiales)
- [ ] Panel de red para múltiples colegios
- [ ] Secretarías de educación como cliente institucional
- [ ] Expansión a Ecuador, Perú, Venezuela
- [ ] Gemelo Digital completo con proyecciones
- [ ] Motor de benchmarking entre colegios

**Meta comercial:** 1.000 colegios en Colombia + primeros contratos internacionales

---

# ENTREGABLES FINALES CONSOLIDADOS

## Diagnóstico Estratégico (resumen ejecutivo)

| Aspecto | Diagnóstico | Acción |
|---|---|---|
| Madurez actual | Básico–Intermedio | Avanzar a Intermedio en 6 meses |
| Tipo de producto | Sistema Académico Digital | Evolucionar a Plataforma de Inteligencia |
| Diferenciador actual | Motor de actividades interactivas | Mantener y potenciar |
| Vacío más crítico | Sin analítica ni predicción | Etapa 2 y 3 del roadmap |
| Riesgo más urgente | Comoditización sin IA | Integrar IA en < 12 meses |
| Oportunidad mayor | Mercado no digitalizado | Expansión agresiva en Colombia |

---

## Arquitectura Objetivo (stack recomendado a 36 meses)

```
Capa de presentación:
├── React 18 (actual) → PWA (Progressive Web App) → App Móvil React Native
├── Dashboard por rol (admin, director, docente, estudiante, padre)
└── Chat Copiloto IA embebido

Capa de API:
├── Node.js 22 + Express (actual) → Migración gradual a microservicios
├── Nuevos servicios: /ai, /analytics, /notifications, /whatsapp
└── API Gateway (cuando escale a 500+ colegios)

Capa de IA:
├── Claude API (Anthropic) — motor de lenguaje natural
├── Motor de reglas propio — scoring de riesgo (corto plazo)
└── Modelo ML propio — predicción (largo plazo, año 2028)

Capa de datos:
├── MySQL (actual) → separar en: BD transaccional + BD analítica
├── Cola de mensajes (Redis o similar) para jobs nocturnos
└── Almacenamiento de archivos (PDFs, Excel) — S3 o equivalente

Capa de infraestructura:
├── Corto plazo: cPanel Conexcol (actual)
├── Mediano plazo: VPS propio (DigitalOcean/Hetzner) cuando > 100 colegios
└── Largo plazo: Cloud (AWS/GCP) cuando > 500 colegios
```

---

## Nuevos Módulos Priorizados

| Módulo | Valor | Complejidad | Prioridad |
|---|---|---|---|
| Export Excel | Muy Alto | Baja | INMEDIATO |
| Dashboard director | Alto | Media | INMEDIATO |
| Módulo asistencia | Alto | Baja | MES 2 |
| Alertas de riesgo básico | Muy Alto | Media | MES 2 |
| Centro de métricas institucional | Muy Alto | Media-Alta | MES 3 |
| Boletín oficial PDF | Alto | Media | MES 3 |
| Motor de scoring de riesgo | Muy Alto | Alta | MES 4-5 |
| Copiloto de Rectoría básico | Alto | Alta | MES 5-6 |
| Observador automático IA | Muy Alto | Alta | MES 6-7 |
| WhatsApp padres (básico) | Muy Alto | Media | MES 6 |
| Planes de mejoramiento IA | Muy Alto | Muy Alta | MES 8-10 |
| Tutor IA personalizado | Alto | Muy Alta | MES 10-12 |
| Chatbot padres WhatsApp | Alto | Alta | MES 10-12 |
| App móvil | Medio | Muy Alta | Año 2 |
| ML propio de predicción | Muy Alto | Muy Alta | Año 2-3 |

---

## Matriz Impacto vs Complejidad

```
IMPACTO
  ^
  |  [Motor scoring] [Copiloto rector]
  |  [Observador IA] [Planes mejora]   |  [Tutor IA]
H |                                    |  [App móvil]
I |  [Export Excel]  [Alertas riesgo]  |
G |  [Dashboard dir] [CMI básico]      |
H |  [Módulo asist.] [Boletín PDF]     |
  |                                    |
  |  [Pendientes act][Checklist admin] |  [ML propio]
  |  [WhatsApp bás.] [Chatbot padres]  |
L |                                    |
O |                                    |
W +------------------------------------+-------->
       LOW           MEDIUM           HIGH
                   COMPLEJIDAD

Cuadrante ideal de inicio: Alto Impacto + Baja Complejidad (esquina sup-izq)
Orden de ejecución: empezar por el cuadrante bajo-izquierdo, avanzar en espiral
```

---

## Estrategia Comercial

**Go-to-market inicial:**

1. **Colegios âncora:** Conseguir 3-5 colegios de referencia en Bogotá, Medellín, Cali que sirvan como casos de estudio. Ofrecerles precio especial a cambio de testimonios y referidos.

2. **Canal de ventas directo:** Rector/director → demo personalizada → piloto gratuito 30 días → cierre.

3. **Canal de referidos:** Cada colegio satisfecho recomienda 2-3 colegios. Sistema de referidos con descuento para el que refiere.

4. **Presencia en eventos educativos:** EXPOCOLEGIO, Semana de la Educación, eventos de secretarías de educación departamentales.

5. **Contenido de autoridad:** Blog/YouTube sobre gestión académica inteligente. Posicionarse como referentes en IA educativa colombiana antes de que lleguen los grandes.

**Argumento de venta diferenciado por plan:**
- Básico: "Deja el Excel, digitaliza tu colegio en 1 día"
- Profesional: "Sabe qué estudiantes van a perder antes de que sea tarde"
- Premium: "Tu rector tiene un asistente de inteligencia institucional"
- IA Institucional: "La gestión de 10 colegios desde un solo panel"

---

## Estrategia Tecnológica

**Principio rector:** No reescribir, extender. El stack actual (Node.js + MySQL + React) es capaz de soportar todas las funcionalidades descritas en este documento hasta 500 colegios activos. No hay razón para cambiarlo antes.

**Orden de inversión tecnológica:**

| Año | Foco tecnológico | Inversión relativa |
|---|---|---|
| 2026 | Completar stack actual, agregar analítica | Baja |
| 2026-2027 | Integrar Claude API, construir motores de IA | Media |
| 2027 | Migrar a VPS, separar servicios, WhatsApp API | Media-Alta |
| 2028 | Infraestructura cloud, ML propio, app móvil | Alta |
| 2029-2030 | Expansión internacional, integración MEN | Muy Alta |

**Deuda técnica a resolver antes de escalar:**
1. Separar BD transaccional de BD analítica (cuando > 50 colegios)
2. Implementar rate limiting en la API
3. Agregar sistema de backups automáticos
4. Crear ambiente de staging antes de producción

---

## Estrategia de IA

**Filosofía:** IA como capa de inteligencia encima de datos reales, no como reemplazo de procesos. La IA de Playfesor siempre tiene contexto educativo colombiano específico.

**Stack de IA recomendado:**

| Función | Tecnología | Cuándo |
|---|---|---|
| Lenguaje natural, generación de texto | Claude API (Anthropic) | Desde el primer módulo de IA |
| Scoring de riesgo inicial | Motor de reglas propio (JavaScript) | Corto plazo (sin costo de API) |
| Predicción ML | Scikit-learn o TensorFlow.js | Año 2, cuando hay datos suficientes |
| Embeddings / búsqueda semántica | Claude Embeddings o alternativa | Año 2 (para tutor IA avanzado) |
| Notificaciones inteligentes | Reglas + Claude para redacción | Mediano plazo |

**Por qué Claude API (Anthropic):**
- Soporte nativo de español latinoamericano
- Calidad superior en razonamiento y generación de texto académico
- Precios competitivos: ~$3 USD/millón tokens (Haiku para tareas simples, Sonnet para complejas)
- Política clara de datos educativos (importante para compliance con padres y colegios)
- Capacidad multimodal para analizar imágenes de documentos en el futuro

**Estimación de costo de IA por colegio/mes (Plan Premium):**
```
Observaciones automáticas: 200 obs × 500 tokens = 100K tokens → $0.30
Copiloto rector: 50 consultas × 2.000 tokens = 100K tokens → $0.30
Planes mejoramiento: 30 planes × 3.000 tokens = 90K tokens → $0.27
Tutor IA: 1.000 sesiones × 1.000 tokens = 1M tokens → $3.00
WhatsApp respuestas: 500 resp × 500 tokens = 250K tokens → $0.75

TOTAL IA por colegio Premium/mes: ~$4.62 USD
Precio del plan Premium: ~$150 USD/mes
Margen después de costo IA: $145 USD/mes por colegio = 96% margen bruto sobre IA
```

---

## Conclusión Estratégica

Playfesor tiene hoy el activo más valioso en EdTech: datos reales de comportamiento estudiantil en producción.

El mercado colombiano tiene +10.000 colegios, de los cuales menos del 15% usa una plataforma digital real. El 85% restante gestiona en Excel, WhatsApp de docentes y Word.

La ventana de oportunidad es ahora. En 18-24 meses, los players grandes internacionales van a integrar IA en sus plataformas. Playfesor debe llegar primero al mercado colombiano con IA educativa contextualizada, construir el lock-in por datos históricos, y posicionarse como el estándar antes de que llegue la competencia con presupuestos de marketing que Playfesor no puede igualar.

La estrategia no es competir en precio con Google Classroom (gratuito).  
La estrategia es competir en valor: **"Playfesor es lo único que le dice al rector colombiano qué va a pasar mañana en su colegio."**

Eso no tiene precio en un mercado donde la pérdida de año y la deserción estudiantil son problemas reales, medibles, y que cuestan dinero a las instituciones.

---

*Documento generado: Mayo 2026*  
*Próxima revisión recomendada: Septiembre 2026 (después de completar Etapa 1)*  
*Contacto estratégico: kikofong@gmail.com*
