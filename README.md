# laravel-inertia-datatable

DataTable reutilizable para **Laravel + Inertia** (React y Vue), basado en shadcn/ui y TanStack Table, con paginación, ordenamiento, filtros, búsqueda global y visibilidad de columnas **resueltos en el servidor**.

> Estado: en desarrollo (fase 1: contrato HTTP y backend).

## Qué contiene este repo

| Parte | Dónde | Cómo se instala |
|---|---|---|
| Paquete Composer (backend) | `src/`, `config/` | `composer require eduardoapatat/laravel-inertia-datatable` |
| Registro shadcn (React) y shadcn-vue (Vue) | `registry.json`, `registry/`, `r/` | `pnpm dlx shadcn@latest add <url>` / `pnpm dlx shadcn-vue@latest add <url>` |
| Skill de Claude Code | `skill/` | — |

El contrato entre frontend y backend está en [`docs/contract.md`](docs/contract.md).

## Instalación del backend

Desde GitHub (repositorio `vcs`):

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/eduardoapatat/laravel-inertia-datatable" }
]
```

O desde una carpeta local (`path`), útil para desarrollo:

```json
"repositories": [
    { "type": "path", "url": "../laravel-inertia-datatable", "options": { "symlink": true } }
]
```

```bash
composer require eduardoapatat/laravel-inertia-datatable:@dev
php artisan vendor:publish --tag=inertia-datatable-config   # opcional
```

## Crear una tabla

```bash
php artisan make:datatable ProductsTable            # modelo deducido: App\Models\Product
php artisan make:datatable ProductsTable --react    # además, resources/js/pages/products/index.tsx
php artisan make:datatable OrdersTable --model=Domain/Sales/Order --empty
```

Propone las columnas leyendo los casts del modelo y el esquema de la tabla: texto (buscable y ordenable), números, booleanos, fechas, enums (`multiSelect(Enum::class)`) y relaciones `belongsTo` (`category_id` → `from('category.name')`). Omite la clave primaria, los atributos `$hidden` y columnas sensibles (`password`, `remember_token`…). Los stubs se pueden personalizar con `php artisan vendor:publish --tag=inertia-datatable-stubs`.

## Instalación del frontend (React)

En un proyecto con el starter kit de React de Laravel:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-react.json
```

Instala `@tanstack/react-table` v9, el hook `useServerDataTable`, los componentes en `resources/js/components/data-table/` y las primitivas de shadcn que falten. Cuando pregunte si sobrescribir componentes de `ui/` que ya existen, se puede responder que no: el DataTable solo usa variantes que ya tiene el starter kit.

Si `resources/js/components/ui/dialog.tsx` es una versión antigua (sin la prop `showCloseButton`), la primitiva `command` no compila; actualízala con `pnpm dlx shadcn@latest add dialog --overwrite`.

Uso en una página:

```tsx
const { table, isLoading } = useServerDataTable({ table: users, prop: 'users', columns });

<DataTable table={table}>
    <DataTableToolbar table={table} searchable={users.config.searchable} />
</DataTable>
```

## Desarrollo

```bash
composer install
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # todo lo anterior (Pint en modo --test)
pnpm install
pnpm run test           # tests del código compartido (Vitest)
pnpm run check          # formato y lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compila registry.json en r/
```

## Créditos

Parte del código de frontend incluye software de terceros con licencia MIT; ver [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
