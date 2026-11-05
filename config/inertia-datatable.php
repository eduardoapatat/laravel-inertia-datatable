<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Nombres de los parámetros del query string
    |--------------------------------------------------------------------------
    |
    | Nombres base de los parámetros del contrato (docs/contract.md). Si una
    | tabla tiene nombre, se usan con prefijo: "users_page", "users_sort"…
    |
    */

    'query' => [
        'page' => 'page',
        'per_page' => 'per_page',
        'sort' => 'sort',
        'filter' => 'filter',
        'search' => 'search',
        'columns' => 'columns',
    ],

    /*
    |--------------------------------------------------------------------------
    | Valores por defecto de cada tabla
    |--------------------------------------------------------------------------
    */

    'per_page' => 10,

    'per_page_options' => [10, 20, 30, 50],

    'max_sorts' => 3,

    'max_filters' => 20,

    'max_search_length' => 100,

    /*
    |--------------------------------------------------------------------------
    | Registro shadcn del frontend
    |--------------------------------------------------------------------------
    |
    | Base de los items del registro que usan `make:datatable --install-ui` e
    | `inertia-datatable:ui`. Con null se usa el de la misma versión que el
    | paquete instalado (`…/v0.1.0/r`, o `…/main/r` en versiones de desarrollo).
    | También puede ser otra URL o una carpeta local con los JSON compilados.
    |
    */

    'registry_url' => env('INERTIA_DATATABLE_REGISTRY_URL'),

];
