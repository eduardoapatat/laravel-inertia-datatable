# Contrato HTTP del DataTable

Este documento define cómo se comunican el frontend (DataTable de shadcn sobre TanStack Table, en React o Vue) y el backend (paquete `eduardoapatat/laravel-inertia-datatable`).

Principios:

- **El servidor es la fuente de verdad.** Paginación, ordenamiento, filtros, búsqueda global y visibilidad de columnas se resuelven en el servidor. TanStack Table trabaja en modo manual (`manualPagination`, `manualSorting`, `manualFiltering`).
- **El estado vive en la URL.** Todo el estado de la tabla se serializa en el query string, así que recargar, compartir el enlace o usar atrás/adelante reproduce la misma vista.
- **Listas blancas.** Solo se puede ordenar, filtrar, buscar y mostrar por columnas declaradas en el servidor. Los nombres que llegan en la request nunca se interpolan en SQL.
- **Normalizar, no fallar.** Un valor inválido (columna no permitida, `per_page` fuera de la lista, página inexistente…) se ignora o se corrige; no devuelve 400. La respuesta incluye el estado normalizado para que el cliente se rehidrate con lo que realmente se aplicó.
- **Convención compatible con spatie/laravel-query-builder** (`sort=-col`, `filter[col]=a,b`), por si en el futuro conviene migrar.

---

## 1. Request

Petición `GET` a la ruta de la página (Inertia) o a un endpoint JSON. Todos los parámetros son opcionales.

| Parámetro | Ejemplo | Significado |
|---|---|---|
| `page` | `page=3` | Página, base 1 |
| `per_page` | `per_page=20` | Tamaño de página |
| `sort` | `sort=-created_at,name` | Ordenamiento, admite varias columnas |
| `filter[<col>]` | `filter[status]=active,pending` | Filtro por columna |
| `search` | `search=ana perez` | Búsqueda global |
| `columns` | `columns=name,email,status` | Columnas visibles |

Ejemplo completo:

```
/users?page=2&per_page=20&sort=-created_at,name&filter[status]=active,pending&filter[role]=admin&search=ana&columns=name,email,status
```

### 1.1 `page`

- Entero ≥ 1. Por defecto `1`.
- No numérico o < 1 → `1`.
- Mayor que la última página → se usa la última (`meta` y `state` reflejan la página real).

### 1.2 `per_page`

- Debe estar en `perPageOptions` de la tabla (por defecto `[10, 20, 30, 50]`). Si no está → valor por defecto de la tabla (por defecto `10`).
- Es una lista cerrada, no un máximo, para evitar `per_page=100000`.

### 1.3 `sort`

- Lista separada por comas; el prefijo `-` indica descendente: `sort=-created_at,name`.
- Se respeta el orden (prioridad de izquierda a derecha).
- Se descartan columnas que no son `sortable`, duplicados y lo que supere `maxSorts` (por defecto 3).
- Sin orden válido → se aplica `defaultSort` de la tabla, si existe.
- Siempre se añade la clave primaria como desempate final (si no está ya), para que la paginación sea estable.
- `state.sorting` refleja **solo el orden pedido explícitamente** (vacío si se usó el de por defecto); el de por defecto se informa en `config.default_sorting`. Así el cliente no escribe en la URL un orden que el usuario no eligió.

### 1.4 `filter[<col>]`

Solo columnas declaradas como filtrables. Tipos en esta fase:

| Tipo | Uso en TanStack | Sintaxis | SQL |
|---|---|---|---|
| `facet` | faceted filter (selección múltiple) | `filter[status]=active,pending` o `filter[status][]=active&filter[status][]=pending` | `WHERE status IN (…)` |
| `text` | input de texto por columna | `filter[email]=gmail` | `WHERE email LIKE %gmail%` (sin distinguir mayúsculas) |

- El servidor acepta las dos formas de `facet`. El cliente usa la forma con comas y pasa a la forma de array solo si algún valor contiene una coma.
- Los valores vacíos se ignoran (`filter[status]=` = sin filtro).
- En un `facet`, si la columna declara sus opciones, se descartan los valores que no estén en esa lista.
- Las columnas de relaciones `belongsTo` / `hasOne` se filtran igual (ver §5).
- Reservado para fases futuras: rangos (`filter[created_at]=2026-01-01..2026-01-31`), booleanos y relaciones a muchos (`hasMany`, `belongsToMany`).

### 1.5 `search`

- Se recorta (`trim`). Si queda vacío, no hay búsqueda. Longitud máxima: 100 caracteres (lo que exceda se corta).
- Se divide en palabras: **cada palabra** debe coincidir en **alguna** columna `searchable`: `(name LIKE %ana% OR email LIKE %ana%) AND (name LIKE %perez% OR email LIKE %perez%)`.
- Usa `whereLike(..., caseSensitive: false)` de Laravel (en PostgreSQL usa `ILIKE`) y escapa `%` y `_`.
- Se mapea 1:1 con `globalFilter` de TanStack; por eso es un parámetro de primer nivel y no `filter[search]`.

### 1.6 `columns`

- Lista separada por comas de las columnas **visibles**.
- Ausente → visibilidad por defecto (cada columna declara si se ve por defecto).
- Se ignoran las columnas desconocidas; las no ocultables (`hideable: false`) siempre se muestran.
- Las filas de `data` solo incluyen las claves de las columnas visibles más las claves fijas (`alwaysInclude`, por defecto la clave primaria). Mostrar una columna oculta implica pedirla de nuevo al servidor.
- Se usa una lista de visibles (no de ocultas) para poder mostrar columnas ocultas por defecto.

### 1.7 Varias tablas en la misma página

Cada tabla puede tener un nombre que se usa como prefijo de sus parámetros:

```
/dashboard?users_page=2&users_sort=-name&orders_filter[status]=paid
```

Los nombres efectivos se devuelven en `config.query`, así que el cliente nunca los deduce por su cuenta. Los nombres base (`page`, `per_page`, …) se pueden cambiar en `config/inertia-datatable.php`.

---

## 2. Respuesta

El backend devuelve un objeto que sirve como **prop de Inertia** o como **respuesta JSON** (implementa `Arrayable`, `JsonSerializable` y `Responsable`).

```php
return Inertia::render('users/index', [
    'users' => fn () => DataTable::for(User::query())->…->toArray(),
]);
```

Usar un closure permite que funcionen las recargas parciales de Inertia (`router.get(url, {}, { only: ['users'] })`).

### 2.1 Forma

```json
{
  "data": [
    { "id": 41, "name": "Ana Pérez", "email": "ana@example.com", "status": "active" }
  ],
  "meta": {
    "current_page": 2,
    "per_page": 20,
    "last_page": 9,
    "total": 172,
    "from": 21,
    "to": 40
  },
  "state": {
    "pagination": { "pageIndex": 1, "pageSize": 20 },
    "sorting": [ { "id": "created_at", "desc": true }, { "id": "name", "desc": false } ],
    "columnFilters": [
      { "id": "status", "value": ["active", "pending"] },
      { "id": "email", "value": "gmail" }
    ],
    "globalFilter": "ana",
    "columnVisibility": { "name": true, "email": true, "status": true, "role": false, "created_at": false }
  },
  "facets": {
    "status": [
      { "value": "active", "label": "Activo", "count": 120 },
      { "value": "pending", "label": "Pendiente", "count": 31 },
      { "value": "inactive", "label": "Inactivo", "count": 0 }
    ],
    "role": [
      { "value": "admin", "label": "admin", "count": 4 }
    ]
  },
  "config": {
    "columns": [
      { "id": "name", "label": "Nombre", "sortable": true, "filter": null, "hideable": false, "visible": true },
      { "id": "email", "label": "Email", "sortable": true, "filter": "text", "hideable": true, "visible": true },
      { "id": "status", "label": "Estado", "sortable": false, "filter": "facet", "hideable": true, "visible": true }
    ],
    "searchable": true,
    "per_page_options": [10, 20, 30, 50],
    "default_sorting": [ { "id": "created_at", "desc": true } ],
    "query": {
      "page": "page", "per_page": "per_page", "sort": "sort",
      "filter": "filter", "search": "search", "columns": "columns"
    }
  }
}
```

### 2.2 `data`

Filas de la página actual. Sin `transform`, es el `toArray()` del modelo; con `->transform(fn ($row) => [...])`, lo que devuelva el closure. En ambos casos se recortan a las columnas visibles más `alwaysInclude`.

### 2.3 `meta`

Igual que el `LengthAwarePaginator` de Laravel (en snake_case). `from` y `to` son `null` si no hay resultados.

### 2.4 `state`

Estado **normalizado y aplicado**, con las formas de TanStack Table (`PaginationState`, `SortingState`, `ColumnFiltersState`, `globalFilter`, `VisibilityState`) para pasarlo tal cual a `useReactTable` / `useVueTable`. `pageIndex` es base 0 (`page - 1`).

### 2.5 `facets`

Opciones y conteos de cada columna con filtro `facet`:

- **Conteo cruzado:** el conteo de cada faceta se calcula con todos los demás filtros y la búsqueda aplicados, **excepto el de la propia faceta**. Así, al marcar «active» se siguen viendo los conteos de «pending» e «inactive». Es un `GROUP BY` por faceta.
- **Origen de las opciones:**
  - Declaradas (`->facet('status', options: ['active' => 'Activo', …])`): aparecen todas, en el orden declarado y con `count: 0` si no hay filas.
  - No declaradas: valores distintos presentes en la base de datos, ordenados por valor, con `label = value`.
- Los valores seleccionados aparecen siempre, aunque su conteo sea 0.
- En esta fase se excluyen los valores `NULL`.

### 2.6 `config`

Metadatos estáticos de la tabla para construir la UI: columnas (etiqueta, si se puede ordenar, tipo de filtro, si se puede ocultar, visibilidad por defecto), si hay búsqueda global, opciones de `per_page`, orden por defecto y nombres efectivos de los parámetros de la URL.

---

## 3. Del estado de TanStack a la URL (lo hace `registry/shared`)

Funciones puras de TypeScript compartidas entre React y Vue:

- `stateToQuery(state, config) → Record<string, string | string[]>`: serializa, omitiendo los valores por defecto (página 1, `per_page` por defecto, sin orden, sin filtros, visibilidad por defecto) para que las URLs queden limpias.
- `queryToState(query, config) → Partial<TableState>`: lo inverso. Solo se usa como respaldo, porque el estado oficial es `state` de la respuesta.

Reglas que el cliente debe cumplir:

- Al cambiar el orden, los filtros, la búsqueda o `per_page`, se vuelve a la página 1.
- La búsqueda va con debounce (unos 300 ms).
- Las navegaciones usan `preserveState: true`, `preserveScroll: true`, `replace: true` (salvo al cambiar de página, que puede añadir historial) y `only: [<prop>]`.

---

## 4. Seguridad y rendimiento

- Los identificadores de columna del contrato son nombres públicos que el servidor asocia a columnas reales, siempre calificadas (`users.status`), o a rutas de relaciones declaradas (`category.name`).
- Ningún valor de la request se usa como identificador SQL; los valores van siempre como bindings.
- `per_page` limitado a una lista cerrada; `sort` limitado por `maxSorts`; `search` limitado en longitud.
- Coste por petición: 1 `COUNT` + 1 `SELECT` paginado + 1 `GROUP BY` por faceta. Conviene indexar las columnas `facet` y `sortable`, y las claves foráneas usadas por columnas de relaciones.

---

## 5. Definición de tablas por modelo y relaciones

El contrato es el mismo para cualquier modelo (users, products, orders…); lo que cambia es la **definición de la tabla** en el backend. Hay dos formas equivalentes.

### 5.1 Clase por tabla (recomendada; la generará `make:datatable`)

```php
// app/DataTables/ProductsTable.php
class ProductsTable extends DataTable
{
    public function query(): Builder
    {
        return Product::query();
    }

    public function columns(): array
    {
        return [
            Column::make('name', 'Nombre')->sortable()->searchable()->hideable(false),
            Column::make('price', 'Precio')->sortable(),
            Column::make('status', 'Estado')->facet(['active' => 'Activo', 'draft' => 'Borrador']),
            Column::make('category', 'Categoría')->from('category.name')->facet()->sortable()->searchable(),
            Column::make('created_at', 'Creado')->sortable()->hidden(),
        ];
    }

    public function defaultSort(): string
    {
        return '-created_at';
    }
}

// Controller
return Inertia::render('products/index', ['products' => fn () => ProductsTable::make()]);
```

### 5.2 Forma rápida (casos simples)

```php
DataTable::for(User::query())
    ->columns([
        Column::make('name', 'Nombre')->sortable()->searchable(),
        Column::make('role', 'Rol')->facet(),
    ])
    ->defaultSort('name');
```

### 5.3 Tablas a partir de un modelo padre

La consulta base puede ser cualquier `Builder` o relación de Eloquent, así que una tabla puede mostrar solo los registros de un padre:

```php
UserProductsTable::for($user->products());
```

### 5.4 Columnas de relaciones (`belongsTo` / `hasOne`)

`->from('relacion.columna')` toma el valor de un modelo relacionado. El id público (`category`) es independiente de la ruta interna (`category.name`): el frontend no sabe que hay una relación.

| Operación | Cómo se resuelve |
|---|---|
| `data` | Se hace eager loading de la relación automáticamente; la fila lleva `"category": "Electrónica"` (aplanado bajo el id público) |
| `sort` | Subconsulta correlacionada: `ORDER BY (SELECT name FROM categories WHERE categories.id = products.category_id)` |
| `filter` `facet` / `text` | `whereHas('category', …)` con `IN` o `LIKE` sobre la columna relacionada |
| `search` | `orWhereHas('category', …)` dentro del grupo de cada palabra |
| `facets` | `GROUP BY` sobre el valor de la subconsulta; las opciones son los valores de la columna relacionada (por ejemplo, nombres de categoría) |

Límites de esta fase:

- Solo relaciones a uno (`belongsTo`, `hasOne`), con un nivel de profundidad (`category.name`; no `category.parent.name`).
- Los valores de la faceta son los de la columna mostrada (`filter[category]=Electrónica`). Si hay valores repetidos (dos categorías con el mismo nombre), se agrupan.
- Las relaciones a muchos (`hasMany`, `belongsToMany`, por ejemplo tags) quedan para una fase futura.

---

## 6. ¿spatie/laravel-query-builder o implementación propia?

**Recomendación: implementación propia**, con la misma convención de spatie en la URL.

| | spatie/laravel-query-builder 7.3 | Propio |
|---|---|---|
| Parseo y lista blanca de `sort` / `filter` | ✅ Maduro | ~150 líneas, cubiertas por tests |
| `per_page` con lista cerrada y página fuera de rango | ❌ Hay que hacerlo encima | ✅ |
| Búsqueda global en varias columnas | ⚠️ Con un `AllowedFilter::callback` propio | ✅ |
| Facetas con conteo cruzado | ❌ Hay que reconstruir el builder con una Request modificada por faceta | ✅ Diseñado para eso |
| Estado normalizado en formato TanStack | ❌ | ✅ |
| Valores no permitidos | Lanza `InvalidFilterQuery` / `InvalidSortQuery` (400), configurable a medias | Normaliza e informa en `state` |
| Conceptos ajenos al caso (includes, fields, appends) | Sí | No |
| Requisitos | PHP ^8.4, `spatie/laravel-package-tools` | Solo `illuminate/*` (PHP ^8.3, igual que Laravel 13) |

spatie solo resolvería la parte más pequeña (el parseo); facetas, paginación, búsqueda y forma de la respuesta habría que escribirlas igualmente, y encima pelearse con su manejo de errores. Al compartir convención de URL, se podría migrar a spatie más adelante sin tocar el frontend.
