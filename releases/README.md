# /releases

Cada versión del producto tiene su propia carpeta con versionado semántico:

```
releases/
  v1.0.0/
  v1.1.0/
  v2.0.0/
```

Cada carpeta de versión debe incluir: `CHANGELOG.md` (qué cambió y por qué), lista de archivos
modificados, scripts SQL de migración correspondientes (copiados o referenciados desde
`database/migrations/`), instrucciones de aplicación, notas de compatibilidad, y riesgos conocidos.

Convención de versionado:
- **MAYOR** (v**X**.0.0): cambios de modelo de despliegue o de configuración incompatibles con
  versiones anteriores.
- **MENOR** (v1.**X**.0): funcionalidades o tablas nuevas, compatibles hacia atrás.
- **PARCHE** (v1.0.**X**): corrección de errores, sin cambios de comportamiento nuevos.

Ver `/versiones` para el registro de qué versión tiene instalada cada colegio cliente.

Pendiente (Fase 5 del plan): crear `v1.0.0` como snapshot documentado del estado real en producción
al 14/07/2026, antes de aplicar ningún cambio de la Fase 1.
