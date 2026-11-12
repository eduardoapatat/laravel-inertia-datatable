<?php

declare(strict_types=1);

/*
 * Textos de la UI del DataTable, enviados al cliente en config.messages.
 * Publícalos con `php artisan vendor:publish --tag=inertia-datatable-lang`
 * para cambiarlos; `:label`, `:count`, `:page` y `:pages` se reemplazan en el
 * navegador.
 */
return [
    // Barra de herramientas
    'search' => 'Buscar...',
    'reset' => 'Restablecer',
    'reset_filters' => 'Restablecer filtros',
    'view' => 'Columnas',
    'view_columns' => 'Mostrar columnas',
    'columns' => 'Columnas',
    'search_columns' => 'Buscar columnas...',
    'no_columns' => 'No se encontraron columnas.',

    // Tabla
    'no_results' => 'Sin resultados.',
    'loading' => 'Cargando tabla…',
    'load_error' => 'No se pudo cargar la tabla.',
    'retry' => 'Reintentar',
    'yes' => 'Sí',
    'no' => 'No',
    'empty' => '—',
    'no_value' => 'Sin valor',

    // Encabezado de columna
    'sort_ascending' => 'Asc',
    'sort_descending' => 'Desc',
    'hide' => 'Ocultar',
    'column_menu' => 'Opciones de la columna :label',

    // Filtros
    'filter' => 'Filtro de :label',
    'clear' => 'Limpiar',
    'clear_filter' => 'Limpiar el filtro de :label',
    'clear_filters' => 'Limpiar filtros',
    'no_options' => 'No se encontraron resultados.',
    'selected' => ':count seleccionados',
    'from' => 'Desde',
    'to' => 'hasta',
    'slider' => 'Control deslizante de :label',
    'previous_month' => 'Ir al mes anterior',
    'next_month' => 'Ir al mes siguiente',

    // Paginación
    'rows_per_page' => 'Filas por página',
    'page_of' => 'Página :page de :pages',
    'row_selected' => ':count fila seleccionada.',
    'rows_selected' => ':count filas seleccionadas.',
    'not_shown' => '(:count sin mostrar)',
    'first_page' => 'Ir a la primera página',
    'previous_page' => 'Ir a la página anterior',
    'next_page' => 'Ir a la página siguiente',
    'last_page' => 'Ir a la última página',
];
