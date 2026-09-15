import * as XLSX from 'xlsx';

// columnas: [{ header: 'Nombre', campo: 'nombre' }] o [{ header: 'Estado', valor: fila => fila.activo ? 'Activo' : 'Inactivo' }]
export function exportarExcel(filas, columnas, nombreArchivo, nombreHoja = 'Datos') {
  const datos = filas.map(fila => {
    const obj = {};
    columnas.forEach(c => {
      obj[c.header] = c.valor ? c.valor(fila) : (fila[c.campo] ?? '');
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, nombreArchivo);
}
