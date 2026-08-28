// Ordena listados de estudiantes por su PRIMER APELLIDO (no por el nombre
// completo). El nombre se guarda como un solo texto ("Nombre1 Nombre2
// Apellido1 Apellido2"), así que el primer apellido se infiere por posición:
//   - 2 palabras o menos → la última palabra es el (único) apellido.
//   - 3 palabras o más   → se asume la convención colombiana de 2 apellidos
//     al final, así que el primer apellido es la penúltima palabra.
export function primerApellido(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length <= 2) return palabras[palabras.length - 1];
  return palabras[palabras.length - 2];
}

// Comparador listo para usar en Array.prototype.sort(). `campo` es el nombre
// de la propiedad que contiene el nombre completo (por defecto "nombre").
export function compararPorApellido(a, b, campo = 'nombre') {
  return primerApellido(a?.[campo]).localeCompare(primerApellido(b?.[campo]), 'es', { sensitivity: 'base' });
}

// Devuelve una copia de la lista ordenada por primer apellido. Útil sobre
// todo después de un Object.values(mapa) construido a partir de un id
// numérico (estudiante_id), ya que JS reordena esas claves de forma
// ascendente sin importar el orden de inserción.
export function ordenarPorApellido(lista, campo = 'nombre') {
  return [...lista].sort((a, b) => compararPorApellido(a, b, campo));
}

// Reordena el nombre completo para mostrarlo como "Apellido1 Apellido2
// Nombre1 Nombre2" (ej: "Juan José López Carmona" → "López Carmona Juan
// José") — mismo criterio de posición que primerApellido().
export function formatearApellidoPrimero(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return palabras.join(' ');
  if (palabras.length === 2) return `${palabras[1]} ${palabras[0]}`;
  const apellidos = palabras.slice(-2).join(' ');
  const nombres = palabras.slice(0, -2).join(' ');
  return `${apellidos} ${nombres}`;
}
