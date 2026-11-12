<?php

declare(strict_types=1);

/*
 * Texts of the DataTable UI, sent to the client in config.messages. Publish them
 * with `php artisan vendor:publish --tag=inertia-datatable-lang` to translate
 * them or change them; `:label`, `:count`, `:page` and `:pages` are replaced
 * in the browser.
 */
return [
    // Toolbar
    'search' => 'Search...',
    'reset' => 'Reset',
    'reset_filters' => 'Reset filters',
    'view' => 'View',
    'view_columns' => 'View columns',
    'columns' => 'Columns',
    'search_columns' => 'Search columns...',
    'no_columns' => 'No columns found.',

    // Table
    'no_results' => 'No results.',
    'loading' => 'Loading table…',
    'yes' => 'Yes',
    'no' => 'No',
    'empty' => '—',
    'no_value' => 'No value',

    // Column header
    'sort_ascending' => 'Asc',
    'sort_descending' => 'Desc',
    'hide' => 'Hide',
    'column_menu' => ':label column options',

    // Filters
    'filter' => ':label filter',
    'clear' => 'Clear',
    'clear_filter' => 'Clear :label filter',
    'clear_filters' => 'Clear filters',
    'no_options' => 'No results found.',
    'selected' => ':count selected',
    'from' => 'From',
    'to' => 'to',
    'slider' => ':label slider',
    'previous_month' => 'Go to the previous month',
    'next_month' => 'Go to the next month',

    // Pagination
    'rows_per_page' => 'Rows per page',
    'page_of' => 'Page :page of :pages',
    'row_selected' => ':count row selected.',
    'rows_selected' => ':count rows selected.',
    'not_shown' => '(:count not shown)',
    'first_page' => 'Go to first page',
    'previous_page' => 'Go to previous page',
    'next_page' => 'Go to next page',
    'last_page' => 'Go to last page',
];
