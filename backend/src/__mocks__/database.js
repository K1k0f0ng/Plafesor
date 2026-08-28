// Mock manual para tests que importan un controller y no necesitan una conexión
// real a MySQL — evita que Jest abra un pool de verdad (y el ruido de consola
// del intento de conexión fallido) solo para probar una función pura del archivo.
module.exports = { query: jest.fn() };
