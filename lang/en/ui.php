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
    'load_error' => 'The table could not be loaded.',
    'retry' => 'Retry',
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
    'month' => 'Month',
    'year' => 'Year',

    // Filter and sort lists
    'filters' => 'Filters',
    'filters_none' => 'No filters applied',
    'filters_description' => 'Add filters to refine your rows.',
    'add_filter' => 'Add filter',
    'remove_filter' => 'Remove :label filter',
    'filter_where' => 'Where',
    'filter_and' => 'and',
    'filter_or' => 'or',
    'filter_join' => 'Combine filters',
    'field' => 'Field',
    'search_fields' => 'Search fields...',
    'no_fields' => 'No fields found.',
    'filter_operator' => ':label operator',
    'filter_value' => ':label value',
    'enter_value' => 'Enter a value...',
    'select_options' => 'Select options...',
    'pick_date' => 'Pick a date',
    'operator_ilike' => 'Contains',
    'operator_not_ilike' => 'Does not contain',
    'operator_eq' => 'Is',
    'operator_ne' => 'Is not',
    'operator_lt' => 'Is less than',
    'operator_lte' => 'Is less than or equal to',
    'operator_gt' => 'Is greater than',
    'operator_gte' => 'Is greater than or equal to',
    'operator_between' => 'Is between',
    'operator_in' => 'Has any of',
    'operator_not_in' => 'Has none of',
    'operator_empty' => 'Is empty',
    'operator_not_empty' => 'Is not empty',
    'operator_before' => 'Is before',
    'operator_after' => 'Is after',
    'operator_on_or_before' => 'Is on or before',
    'operator_on_or_after' => 'Is on or after',
    'sort' => 'Sort',
    'sort_none' => 'No sorting applied',
    'sort_description' => 'Add sorting to organize your rows.',
    'sort_by' => 'Sort by',
    'add_sort' => 'Add sort',
    'reset_sorting' => 'Reset sorting',
    'remove_sort' => 'Remove :label sort',
    'sort_direction' => ':label direction',
    'move_up' => 'Move :label up',
    'move_down' => 'Move :label down',

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
