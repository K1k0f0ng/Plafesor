# /assets/plantilla-generica

Activos gráficos neutros (logo y favicon genéricos, sin relación con la marca "Playfesor" ni con
ningún colegio real) usados como valor por defecto dentro de `deployment/PLAYFESOR_TEMPLATE/` antes
de que `scripts/aplicar-marca.js` los reemplace por los del colegio real.

Contenido: `logo-icon.png`, `logo192.png`, `logo512.png`, `apple-touch-icon.png`, `favicon-16.png`,
`favicon-32.png`, `favicon.ico` — imágenes cuadradas de color sólido (`#667eea`, el color por
defecto de la plantilla), sin ningún texto ni símbolo, generadas para esta plantilla. Son el
respaldo neutro que `deployment/PLAYFESOR_TEMPLATE/frontend/public/` ya trae por defecto; sirven
para restaurar esos archivos a un estado neutro si alguna vez se sobrescriben por error, o como
punto de partida antes de reemplazarlos por el logo real de cada colegio.
