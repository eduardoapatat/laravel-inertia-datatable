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

## Desarrollo

```bash
composer install
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # todo lo anterior (Pint en modo --test)
```

## Créditos

Los componentes de frontend se basan en [tablecn](https://github.com/sadmann7/tablecn) de sadmann7 (MIT), adaptados para Inertia.
