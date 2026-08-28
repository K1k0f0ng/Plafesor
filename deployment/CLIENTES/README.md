# CLIENTES

Cada institución con una instalación propia tiene aquí su propia carpeta, por ejemplo:

```
CLIENTES/
  Colegio_San_Rafael/
  Colegio_Nueva_Esperanza/
```

Cada carpeta de cliente contiene **solo**:

- documentación de la implementación (ficha institucional completada, fecha de entrega)
- archivos de configuración específicos (copia de su `.env`, sin subir a ningún control de versiones
  compartido si contiene secretos)
- logos, escudos, favicon del colegio
- manuales entregados
- respaldos (`backups/`)
- registro de qué versión del producto tiene instalada (ver también `/versiones`)
- scripts específicos de ese cliente, si los hubiera

**Nunca se modifica el código fuente del core desde estas carpetas.** El código vive en
`deployment/PLAYFESOR_TEMPLATE/` (para instalaciones nuevas) o en el propio servidor de cada colegio
(para instalaciones ya entregadas) — aquí solo se guarda lo que identifica y configura a ese cliente
puntual.

Vacía hasta que se entregue la primera instalación bajo este modelo.
