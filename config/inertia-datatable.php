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
    | Display locale
    |--------------------------------------------------------------------------
    |
    | Locale used by the UI to format numbers, currencies and dates (for
    | example "es-CL": 1.234,50 and "5 de noviembre de 2026"). With null,
    | each browser uses its own.
    |
    */

    'locale' => null,

    /*
    |--------------------------------------------------------------------------
    | Column validation
    |--------------------------------------------------------------------------
    |
    | Checks on every request that the declared columns exist: the ones used
    | to sort, search or filter must be columns of their table, and the
    | displayed ones must have a value in the model (column, query alias or
    | $appends). A typo then fails on the first load with a clear message
    | instead of when someone sorts. With null, only in debug mode.
    |
    */

    'validate_columns' => null,

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
