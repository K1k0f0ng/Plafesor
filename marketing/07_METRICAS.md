# 07 · Métricas

**Estado honesto:** no existen métricas comerciales reales todavía (cero clientes pagadores bajo el
modelo single-tenant, ver `01_EMPRESA.md`). Este documento separa lo que sí se puede verificar hoy
de lo que falta instrumentar antes de poder reportarlo con confianza.

## Métricas de producto/técnicas verificables hoy

Estas no son métricas de negocio, pero son ciertas y auditables en el código:

| Métrica | Dato verificado |
|---|---|
| Módulos de IA en producción | 6: Motor de riesgo, Copiloto de Rectoría, Observador académico, Tutor IA, Planes de mejoramiento, Informes semanales |
| Modelo de IA en uso | `claude-haiku-4-5-20251001` (un solo modelo para todas las capacidades) |
| Frecuencia de recálculo de riesgo | Diaria (cron nocturno) |
| Frecuencia de informe ejecutivo al director | Semanal, domingo 6pm COT, vía WhatsApp |
| Fecha de despliegue del núcleo de IA | 2026-06-05 |
| Instalaciones bajo el modelo single-tenant actual | 0 clientes reales, 1 instalación de prueba interna (`Colegio_Prueba`) |
| Costo marginal estimado de IA por colegio | Estimado ~$2–5 USD/mes para 500 estudiantes con observaciones mensuales (`ESTRATEGIA_EVOLUCION_2026_2030.md`, no verificado con facturación real de Anthropic) |

## Métricas comerciales: no hay dato real todavía

La landing page usa deliberadamente estadísticas de producto ("En operación real", "24/7 Tutor
disponible") en vez de cifras de clientes, precisamente porque no existen cifras de clientes que
mostrar (ver `04_MARCA_Y_POSICIONAMIENTO.md`, sección de prueba social). No hay:

- Número de colegios activos pagando
- Ingreso mensual recurrente (MRR/ARR real — las proyecciones de `ESTRATEGIA_EVOLUCION_2026_2030.md`
  son hipótesis del plan de mayo de 2026, no resultados)
- Tasa de conversión demo → cliente
- Costo de adquisición de cliente (CAC)
- Retención / churn
- NPS o satisfacción de rectores/docentes

## Qué instrumentar antes de poder llenar este documento con datos reales

En orden de lo más simple a lo más estructural:

1. **Solicitudes de demo:** hoy llegan por `mailto:demo@playfesor.co` sin registro — ni siquiera se
   cuenta cuántas llegan. Lo mínimo: llevar un conteo manual o conectar un formulario con registro.
2. **Instalaciones reales vs. de prueba:** `versiones/registro_clientes.md` ya está preparado como
   tabla de control — solo falta tener el primer cliente real que registrar.
3. **Adopción de IA por colegio instalado:** cuántas observaciones genera el Observador al mes,
   cuántas conversaciones tiene el Tutor IA, cuántas preguntas recibe el Copiloto — señalado como
   pendiente explícito en `ESTRATEGIA_ADENDUM_JULIO_2026.md`, sección 6, punto 4.
4. **Ingreso real:** depende de que exista primero una oferta con precio definido — ver
   `08_OFERTAS.md`, donde el modelo de cobro está identificado como el vacío más grande del proyecto.

## Uso recomendado de este documento

Actualizar esta tabla cada vez que se cierre una instalación real o se defina un mecanismo de
medición nuevo — no rellenar con estimaciones optimistas mientras el dato real no exista.
