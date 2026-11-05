# Changelog

Todos los cambios relevantes de este paquete se documentan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/). Mientras la versión sea 0.x, una versión menor (0.2, 0.3…) puede traer cambios incompatibles.

## [Sin publicar]

## [0.1.0] - 2026-11-05

Primera versión publicada: backend para Laravel y UI para React.

### Backend (paquete Composer)

- Clases de tabla (`DataTable`) y forma rápida `DataTable::for($query)`, con columnas declarativas (`Column`): orden, búsqueda global, filtros `text`, `number`, `range`, `date`, `dateRange`, `boolean`, `select` y `multiSelect` (también con enums), columnas ocultas y no ocultables.
- Contrato HTTP documentado en `docs/contract.md`: paginación, orden múltiple, filtros con operadores, búsqueda, visibilidad de columnas y prefijo por tabla para tener varias en la misma página. Los parámetros no válidos se ignoran y la respuesta devuelve el estado normalizado.
- Facetas con conteos cruzados (cada filtro cuenta con los demás aplicados) y límites de los rangos.
- Columnas de relaciones uno a uno (`belongsTo`, `hasOne`) para mostrar, filtrar, ordenar y buscar, y tablas hijas de un registro padre.
- Orden estable: la clave primaria desempata siempre, en la dirección del primer criterio.
- Funciona con SQLite, MySQL y Postgres.
- `php artisan make:datatable`: deduce las columnas del modelo (casts, esquema, enums y relaciones) y, con `--react`/`--page`, genera el componente y la página de React. Lista los modelos disponibles si el indicado no existe.
- `php artisan inertia-datatable:ui [--update]`: instala o actualiza la UI desde el registro de la misma versión del paquete, sin sobrescribir los `ui/` del proyecto. Se puede cambiar con `INERTIA_DATATABLE_REGISTRY_URL`.

### UI de React (registro shadcn)

- Hook `useServerDataTable` sobre TanStack Table v9: el estado vive en la URL y cada cambio es una visita parcial de Inertia, con debounce en filtros de texto y búsqueda.
- La clase PHP decide qué columnas se ven y en qué orden; el componente solo personaliza celdas o añade columnas propias (acciones, selección). Celdas por defecto según el tipo de filtro.
- Toolbar con búsqueda, un filtro por columna (texto, número, rango, fechas, Sí/No y facetados con conteos), Reset y menú de columnas, y paginación con los tamaños que define el servidor.
- Piezas exportadas (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, `DataTableResetButton`, `DataTableViewOptions`, `DataTablePagination`) para cambiar la disposición en el componente de cada tabla.

### Otros

- Skill de Claude Code (`data-table-skill`) para instalar el paquete y crear tablas.
- CI: tests con PHP 8.3 a 8.5 y Laravel 12 y 13, MySQL y Postgres, registro recompilado, e instalación real en el starter kit de React con npm y pnpm (también cada semana).

[Sin publicar]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/releases/tag/v0.1.0
