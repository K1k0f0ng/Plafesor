// Identidad visual de la institución — se configura por colegio vía variables de
// entorno REACT_APP_* (ver .env.example), nunca hardcodeada en los componentes.
export const NOMBRE_INSTITUCION = process.env.REACT_APP_NOMBRE_INSTITUCION || 'Mi Institución';
export const COLOR_PRIMARIO = process.env.REACT_APP_COLOR_PRIMARIO || '#667eea';
export const COLOR_SECUNDARIO = process.env.REACT_APP_COLOR_SECUNDARIO || '#764ba2';

// Los componentes existentes usan los colores como literales hex dentro de objetos de
// estilo inline (const es = {...}). En vez de tocar cada archivo para importar estas
// constantes, esos literales se reemplazaron por las variables CSS definidas aquí, que
// esta misma función inyecta en el documento al arrancar la aplicación.
export function aplicarVariablesCss() {
  document.documentElement.style.setProperty('--color-primario', COLOR_PRIMARIO);
  document.documentElement.style.setProperty('--color-secundario', COLOR_SECUNDARIO);
}
