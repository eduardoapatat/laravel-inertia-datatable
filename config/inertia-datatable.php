<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Query string parameter names
    |--------------------------------------------------------------------------
    |
    | Base names of the contract parameters (docs/contract.md). When a table
    | has a name they are prefixed: "users_page", "users_sort"…
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
    | Defaults for every table
    |--------------------------------------------------------------------------
    */

    'per_page' => 10,

    'per_page_options' => [10, 20, 30, 50],

    'max_sorts' => 3,

    'max_filters' => 20,

    'max_search_length' => 100,

    /*
    |--------------------------------------------------------------------------
    | Frontend shadcn registry
    |--------------------------------------------------------------------------
    |
    | Base of the registry items used by `make:datatable --install-ui` and
    | `inertia-datatable:ui`. With null, the registry of the installed package
    | version is used (`…/v0.1.0/r`, or `…/main/r` for development versions).
    | It can also be another URL or a local folder with the compiled JSON.
    |
    */

    'registry_url' => env('INERTIA_DATATABLE_REGISTRY_URL'),

];
