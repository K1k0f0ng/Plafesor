// Expresión SQL para ordenar listados de estudiantes alfabéticamente por su
// PRIMER APELLIDO (no por el nombre completo). El campo `nombre` guarda el
// nombre completo en un solo texto ("Nombre1 Nombre2 Apellido1 Apellido2"),
// así que el primer apellido se infiere por posición:
//   - 2 palabras o menos → la última palabra es el (único) apellido.
//   - 3 palabras o más   → se asume la convención colombiana de 2 apellidos
//     al final, así que el primer apellido es la penúltima palabra.
// No es infalible (nombres de 3 palabras son ambiguos sin un campo de
// apellido separado), pero cubre correctamente los casos más comunes.
function ordenApellido(columna = 'nombre') {
  const col = `TRIM(${columna})`;
  const totalPalabras = `(LENGTH(${col}) - LENGTH(REPLACE(${col}, ' ', '')) + 1)`;
  return `
    CASE
      WHEN ${totalPalabras} <= 2 THEN SUBSTRING_INDEX(${col}, ' ', -1)
      ELSE SUBSTRING_INDEX(SUBSTRING_INDEX(${col}, ' ', -2), ' ', 1)
    END
  `;
}

// Misma regla que ordenApellido(), pero en JS — para cuando la lista de
// estudiantes se arma en memoria (p.ej. Object.values(mapa) construido a
// partir del estudiante_id) en vez de venir directo de una consulta SQL ya
// ordenada. Object.values()/Object.keys() reordena automáticamente las
// claves numéricas de forma ascendente sin importar el orden de inserción,
// así que un ORDER BY en la consulta no basta en esos casos — hay que
// reordenar el arreglo final explícitamente.
function primerApellidoJS(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length <= 2) return palabras[palabras.length - 1];
  return palabras[palabras.length - 2];
}

function ordenarPorApellido(lista, campo = 'nombre') {
  return [...lista].sort((a, b) =>
    primerApellidoJS(a?.[campo]).localeCompare(primerApellidoJS(b?.[campo]), 'es', { sensitivity: 'base' })
  );
}

// Reordena el nombre completo para mostrarlo como "Apellido1 Apellido2
// Nombre1 Nombre2" (ej: "Juan José López Carmona" → "López Carmona Juan
// José") — mismo criterio de posición que primerApellidoJS(). Se usa donde
// el nombre del estudiante se imprime en un documento generado en el
// servidor (boletín en PDF).
function formatearApellidoPrimero(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return palabras.join(' ');
  if (palabras.length === 2) return `${palabras[1]} ${palabras[0]}`;
  const apellidos = palabras.slice(-2).join(' ');
  const nombres = palabras.slice(0, -2).join(' ');
  return `${apellidos} ${nombres}`;
}

module.exports = { ordenApellido, primerApellidoJS, ordenarPorApellido, formatearApellidoPrimero };
