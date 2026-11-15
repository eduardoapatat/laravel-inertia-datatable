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
    'month' => 'Mes',
    'year' => 'Año',

    // Listas de filtros y de orden
    'filters' => 'Filtros',
    'filters_none' => 'Sin filtros aplicados',
    'filters_description' => 'Agrega filtros para acotar las filas.',
    'add_filter' => 'Agregar filtro',
    'remove_filter' => 'Quitar el filtro de :label',
    'filter_where' => 'Donde',
    'filter_and' => 'y',
    'filter_or' => 'o',
    'filter_join' => 'Combinar filtros',
    'field' => 'Campo',
    'search_fields' => 'Buscar campos...',
    'no_fields' => 'No se encontraron campos.',
    'filter_operator' => 'Operador de :label',
    'filter_value' => 'Valor de :label',
    'enter_value' => 'Ingresa un valor...',
    'select_options' => 'Selecciona opciones...',
    'pick_date' => 'Elige una fecha',
    'operator_ilike' => 'Contiene',
    'operator_not_ilike' => 'No contiene',
    'operator_eq' => 'Es',
    'operator_ne' => 'No es',
    'operator_lt' => 'Es menor que',
    'operator_lte' => 'Es menor o igual que',
    'operator_gt' => 'Es mayor que',
    'operator_gte' => 'Es mayor o igual que',
    'operator_between' => 'Está entre',
    'operator_in' => 'Es alguno de',
    'operator_not_in' => 'No es ninguno de',
    'operator_empty' => 'Está vacío',
    'operator_not_empty' => 'No está vacío',
    'operator_before' => 'Es antes del',
    'operator_after' => 'Es después del',
    'operator_on_or_before' => 'Es el o antes del',
    'operator_on_or_after' => 'Es el o después del',
    'sort' => 'Ordenar',
    'sort_none' => 'Sin orden aplicado',
    'sort_description' => 'Agrega un orden para organizar las filas.',
    'sort_by' => 'Ordenar por',
    'add_sort' => 'Agregar orden',
    'reset_sorting' => 'Restablecer orden',
    'remove_sort' => 'Quitar el orden de :label',
    'sort_direction' => 'Dirección de :label',
    'move_up' => 'Subir :label',
    'move_down' => 'Bajar :label',

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
