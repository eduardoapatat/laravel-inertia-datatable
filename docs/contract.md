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
- Nota: tablecn escribe `sort=created_at.desc`; aquí se mantiene `-created_at` (convención de spatie y JSON:API). La traducción la hace `registry/shared`, sin tocar los componentes.
- Se descartan columnas que no son `sortable`, duplicados y lo que supere `maxSorts` (por defecto 3).
- Sin orden válido → se aplica `defaultSort` de la tabla, si existe.
- Siempre se añade la clave primaria como desempate final (si no está ya), para que la paginación sea estable.
- `state.sorting` refleja **solo el orden pedido explícitamente** (vacío si se usó el de por defecto); el de por defecto se informa en `config.default_sorting`. Así el cliente no escribe en la URL un orden que el usuario no eligió.

### 1.4 `filter[<col>]`

Solo columnas declaradas como filtrables. El modelo de filtros es el de [tablecn](https://github.com/sadmann7/tablecn) (variantes + operadores), para reutilizar sus componentes (faceted filter, range/slider, date filter, filter menu, sort menu) sin cambiar su lógica.

#### Sintaxis

```
filter[<col>]=[<operador>.]<valor>
```

- **Sin operador** se aplica el operador implícito de la variante: `filter[status]=active,pending` = `filter[status]=in.active,pending`.
- **Listas** separadas por comas. Un valor que contenga coma, comillas o espacios en los extremos va entre comillas dobles, y las comillas internas se duplican: `filter[name]=in."Pérez, Ana",Luis`.
- **Varios filtros sobre la misma columna** con la forma de array; se combinan con AND: `filter[price][]=gte.10&filter[price][]=lte.100`.
- Si el prefijo no es un operador válido para la variante, todo el texto se toma como valor con el operador implícito (`filter[email]=foo.bar` busca «foo.bar»). Para evitar ambigüedades, el cliente escribe el operador explícito cuando el valor empieza por un nombre de operador.
- Los nombres de operador no distinguen mayúsculas y se aceptan en las dos formas de tablecn: nombre de URL (`neq`, `not.in`) o clave (`ne`, `notInArray`).

#### Variantes y operadores

| Variante | Columna en tablecn (`meta`) | Operador implícito | Operadores (nombre en URL) | Valor |
|---|---|---|---|---|
| `text` | `variant: "text"` | `ilike` | `ilike`, `not.ilike`, `eq`, `neq`, `is.empty`, `not.is.empty` | texto |
| `number` | `variant: "number"` | `eq` | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between`, `is.empty`, `not.is.empty` | número (`.` decimal) |
| `range` | `variant: "number", filter: "range"` | `between` | igual que `number` | `min,max`; un extremo puede ir vacío (`10,` / `,100`) |
| `date` | `variant: "date"` | `eq` | `eq`, `neq`, `lt`, `gt`, `lte`, `gte`, `between`, `is.empty`, `not.is.empty` (`rel` en fase futura) | `YYYY-MM-DD` |
| `date-range` | `variant: "date", filter: "range"` | `between` | igual que `date` | `desde,hasta` (`YYYY-MM-DD`) |
| `boolean` | `variant: "boolean"` | `eq` | `eq`, `neq` | `true` / `false` |
| `select` | `variant: "select"` | `in` | `in`, `eq`, `neq`, `is.empty`, `not.is.empty` | valor o lista |
| `multi-select` | `variant: "multi-select"` | `in` | `in`, `not.in`, `is.empty`, `not.is.empty` | lista |

#### Traducción a SQL

| Operador | SQL |
|---|---|
| `ilike` / `not.ilike` | `whereLike` / `whereNotLike` con `%valor%`, sin distinguir mayúsculas y escapando `%` y `_` |
| `eq` / `neq` | `=` / `<>`; en `date` compara el día completo (`whereDate`); en `text` no distingue mayúsculas |
| `lt` `lte` `gt` `gte` | comparación; en `date` por día (`lte` 2026-01-31 incluye todo ese día) |
| `between` | ambos extremos inclusivos; con un extremo vacío equivale a `gte` / `lte` |
| `in` / `not.in` | `whereIn` / `whereNotIn` |
| `is.empty` / `not.is.empty` | `IS NULL` (o `''` en `text`) / lo contrario |

- Las negaciones (`not.ilike`, `neq`, `not.in`) incluyen las filas sin valor (`NULL`): «no es X» también vale para lo que no tiene valor. En columnas de relaciones incluyen las filas sin relación.
- «Sin distinguir mayúsculas» depende de la base de datos: en MySQL/MariaDB (collation `_ci`) y PostgreSQL (`ILIKE`, `lower()`) funciona con cualquier letra; en SQLite solo con letras ASCII (`Á` ≠ `á`).

#### Normalización

- Un filtro sin valor (salvo `is.empty` / `not.is.empty`) se ignora: `filter[status]=` = sin filtro.
- Un valor que no corresponde a la variante (`filter[price]=abc`, fecha inválida, booleano distinto de `true`/`false`) descarta ese filtro.
- `between` con `min > max` intercambia los extremos.
- En `select` / `multi-select` con opciones declaradas, se descartan los valores que no estén en la lista.
- Las columnas de relaciones `belongsTo` / `hasOne` se filtran igual (ver §5).

#### Etapas

- **Fase 1:** todas las variantes y operadores de la tabla, varios filtros por columna, combinación AND.
- **Fase futura:** `join=or` (combinar filtros con OR, usado por el filter menu avanzado de tablecn; el nombre del parámetro queda reservado), operador `rel` (fechas relativas a hoy) y relaciones a muchos (`hasMany`, `belongsToMany`).

### 1.5 `search`

- Se recorta (`trim`). Si queda vacío, no hay búsqueda. Longitud máxima: 100 caracteres (lo que exceda se corta).
- Se divide en palabras: **cada palabra** debe coincidir en **alguna** columna `searchable`: `(name LIKE %ana% OR email LIKE %ana%) AND (name LIKE %perez% OR email LIKE %perez%)`.
- Usa `whereLike(..., caseSensitive: false)` de Laravel (en PostgreSQL usa `ILIKE`) y escapa `%` y `_`.
- Se mapea 1:1 con `globalFilter` de TanStack; por eso es un parámetro de primer nivel y no `filter[search]`.

### 1.6 `columns`

- Lista separada por comas de las columnas **visibles**.
- Ausente → visibilidad por defecto (cada columna declara si se ve por defecto).
- Se ignoran las columnas desconocidas; las no ocultables (`hideable: false`) siempre se muestran.
- Las filas de `data` no incluyen las claves de las columnas ocultas (ver §2.2). Mostrar una columna oculta implica pedirla de nuevo al servidor.
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
    'users' => fn () => UsersTable::make(),
]);
```

Inertia convierte el objeto con `toArray()` (es `Arrayable`). Usar un closure evita resolver la tabla cuando una recarga parcial no la pide (`router.get(url, {}, { only: ['users'] })`).

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
      { "id": "status", "filterId": "status-0", "variant": "multi-select", "operator": "inArray", "value": ["active", "pending"] },
      { "id": "email", "filterId": "email-0", "variant": "text", "operator": "iLike", "value": "gmail" },
      { "id": "price", "filterId": "price-0", "variant": "range", "operator": "isBetween", "value": ["10", "100"] }
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
    ],
    "price": { "min": 0, "max": 2490 }
  },
  "config": {
    "columns": [
      { "id": "name", "label": "Nombre", "sortable": true, "variant": null, "placeholder": null, "hideable": false, "visible": true },
      { "id": "email", "label": "Email", "sortable": true, "variant": "text", "placeholder": "Buscar email…", "hideable": true, "visible": true },
      { "id": "status", "label": "Estado", "sortable": false, "variant": "multi-select", "placeholder": null, "hideable": true, "visible": true },
      { "id": "price", "label": "Precio", "sortable": true, "variant": "range", "placeholder": null, "unit": "$", "hideable": true, "visible": true }
    ],
    "searchable": true,
    "per_page": 10,
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

Filas de la página actual:

- **Sin `transform`:** solo las columnas visibles más las claves fijas (`alwaysInclude`, por defecto la clave primaria). Cada valor sale del `toArray()` del modelo (respeta `$hidden`, casts y formato de fechas); las columnas de relaciones se aplanan bajo su id.
- **Con `transform`:** lo que devuelva el método `transform()` de la clase o el closure de `->transform()`, quitando las claves de las columnas ocultas. Las claves que no son columnas (por ejemplo `url`) se mantienen.

### 2.3 `meta`

Igual que el `LengthAwarePaginator` de Laravel (en snake_case). `from` y `to` son `null` si no hay resultados.

### 2.4 `state`

Estado **normalizado y aplicado**, con las formas de TanStack Table v9 (`PaginationState`, `SortingState`, `ColumnFiltersState`, `globalFilter`, `VisibilityState`) para pasarlo tal cual a la tabla. `pageIndex` es base 0 (`page - 1`).

Cada elemento de `columnFilters` tiene la forma `ColumnFilterItem` de tablecn: `id`, `filterId` (`<id>-<índice>`), `variant`, `operator` (clave del operador: `iLike`, `notILike`, `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `isBetween`, `inArray`, `notInArray`, `isEmpty`, `isNotEmpty`) y `value` (`string` o `string[]`, siempre como texto, igual que en la URL).

### 2.5 `facets`

Datos que el cliente no puede calcular por sí mismo en modo servidor (sustituyen a `getFacetedUniqueValues` / `getFacetedMinMaxValues` de TanStack):

**`select` / `multi-select`** → lista de opciones con la forma `ColumnSelectOption` de tablecn (`value`, `label`, `count`; el icono lo pone el cliente):

- **Conteo cruzado:** el conteo de cada faceta se calcula con todos los demás filtros y la búsqueda aplicados, **excepto el de la propia faceta**. Así, al marcar «active» se siguen viendo los conteos de «pending» e «inactive». Es un `GROUP BY` por faceta.
- **Origen de las opciones:**
  - Declaradas (`->multiSelect(['active' => 'Activo', …])`): aparecen todas, en el orden declarado y con `count: 0` si no hay filas.
  - No declaradas: valores distintos presentes en la base de datos, ordenados por valor, con `label = value`.
- Los valores seleccionados aparecen siempre, aunque su conteo sea 0.
- En esta fase se excluyen los valores `NULL`.
- Los conteos se pueden desactivar por columna (`->withCounts(false)`); entonces `count` no se envía.

**`range`** → `{ "min": …, "max": … }` de la columna sobre la consulta base (sin filtros), para los límites del slider / range filter. Se pueden fijar a mano con `->range(min: 0, max: 5000)` y evitar la consulta.

### 2.6 `config`

Metadatos estáticos de la tabla para construir la UI: columnas (etiqueta, si se puede ordenar, variante de filtro, placeholder, unidad, si se puede ocultar, visibilidad por defecto), si hay búsqueda global, `per_page` por defecto y sus opciones, orden por defecto y nombres efectivos de los parámetros de la URL.

El adaptador del cliente traduce cada columna a la `meta` de tablecn (`label`, `placeholder`, `variant`, `filter: "range"`, `unit`, `options`) y a `enableSorting` / `enableColumnFilter` / `enableHiding`, de modo que la definición vive en un solo lugar: el servidor.

---

## 3. Del estado de TanStack a la URL (lo hace `registry/shared`)

Funciones puras de TypeScript compartidas entre React y Vue:

- `stateToQuery(state, config) → Record<string, string | string[]>`: serializa, omitiendo los valores por defecto (página 1, `per_page` por defecto, sin orden, sin filtros, visibilidad por defecto) para que las URLs queden limpias. Los filtros con su operador implícito se escriben sin prefijo (`filter[status]=active,pending`).
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
- Coste por petición: 1 `COUNT` + 1 `SELECT` paginado + 1 `GROUP BY` por columna `select` / `multi-select` con conteos + 1 `MIN/MAX` por columna `range` sin límites fijos. Conviene indexar las columnas filtrables y ordenables, y las claves foráneas usadas por columnas de relaciones.
- Número máximo de filtros por petición (por defecto 20) para acotar el tamaño de la consulta.

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
            Column::make('price', 'Precio')->sortable()->range(unit: '$'),
            Column::make('status', 'Estado')->multiSelect(['active' => 'Activo', 'draft' => 'Borrador']),
            Column::make('category', 'Categoría')->from('category.name')->multiSelect()->sortable()->searchable(),
            Column::make('featured', 'Destacado')->boolean(),
            Column::make('created_at', 'Creado')->sortable()->dateRange()->hidden(),
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
        Column::make('role', 'Rol')->select(),
    ])
    ->defaultSort('name');
```

### 5.3 Tablas a partir de un modelo padre

La consulta base puede ser cualquier `Builder` o relación de Eloquent. `make()` crea la tabla desde el contenedor, así que el constructor admite argumentos por nombre (y dependencias inyectadas):

```php
class UserProductsTable extends DataTable
{
    public function __construct(private readonly User $user) {}

    public function query(): HasMany
    {
        return $this->user->products();
    }

    // columns(), …
}

UserProductsTable::make(user: $user);
```

### 5.4 Columnas de relaciones (`belongsTo` / `hasOne`)

`->from('relacion.columna')` toma el valor de un modelo relacionado. El id público (`category`) es independiente de la ruta interna (`category.name`): el frontend no sabe que hay una relación.

| Operación | Cómo se resuelve |
|---|---|
| `data` | Se hace eager loading de la relación automáticamente; la fila lleva `"category": "Electrónica"` (aplanado bajo el id público) |
| `sort` | Subconsulta correlacionada: `ORDER BY (SELECT name FROM categories WHERE categories.id = products.category_id)` |
| `filter` | `whereHas('category', …)` con el operador correspondiente sobre la columna relacionada (`is.empty` también incluye los registros sin relación) |
| `search` | `orWhereHas('category', …)` dentro del grupo de cada palabra |
| `facets` | `GROUP BY` sobre el valor de la subconsulta; las opciones son los valores de la columna relacionada (por ejemplo, nombres de categoría) |

Límites de esta fase:

- Solo relaciones a uno (`belongsTo`, `hasOne`, `morphOne`, `hasOneThrough`), con un nivel de profundidad (`category.name`; no `category.parent.name`). Declarar una columna sobre una relación a muchos lanza una `LogicException` al resolver la tabla, aunque solo se muestre.
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
| Opciones con conteo cruzado y min/max | ❌ Hay que reconstruir el builder con una Request modificada por faceta | ✅ Diseñado para eso |
| Estado normalizado en formato TanStack | ❌ | ✅ |
| Valores no permitidos | Lanza `InvalidFilterQuery` / `InvalidSortQuery` (400), configurable a medias | Normaliza e informa en `state` |
| Conceptos ajenos al caso (includes, fields, appends) | Sí | No |
| Requisitos | PHP ^8.4, `spatie/laravel-package-tools` | Solo `illuminate/*` (PHP ^8.3, igual que Laravel 13) |

spatie solo resolvería la parte más pequeña (el parseo); facetas, paginación, búsqueda y forma de la respuesta habría que escribirlas igualmente, y encima pelearse con su manejo de errores. Al compartir convención de URL, se podría migrar a spatie más adelante sin tocar el frontend.
