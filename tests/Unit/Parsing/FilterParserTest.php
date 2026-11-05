<?php

declare(strict_types=1);

use InertiaDataTable\Column;
use InertiaDataTable\Enums\FilterOperator;
use InertiaDataTable\Parsing\FilterParser;

it('parses a parameter into its operator and normalized value', function (Column $column, string $param, FilterOperator $operator, string|array $value) {
    $filter = (new FilterParser)->parse($column, $param);

    expect($filter?->operator)->toBe($operator)
        ->and($filter?->value)->toBe($value);
})->with([
    'implicit operator of multi-select' => [Column::option('status')->filterMultiSelect(), 'active,draft', FilterOperator::InArray, ['active', 'draft']],
    'quoted list item with a comma' => [Column::option('status')->filterMultiSelect(), '"Pérez, Ana",Luis', FilterOperator::InArray, ['Pérez, Ana', 'Luis']],
    'doubled quote inside quotes' => [Column::option('status')->filterMultiSelect(), '"say ""hi""",x', FilterOperator::InArray, ['say "hi"', 'x']],
    'explicit url operator' => [Column::option('status')->filterMultiSelect(), 'not.in.archived', FilterOperator::NotInArray, ['archived']],
    'operator given by its key' => [Column::option('status')->filterMultiSelect(), 'notInArray.archived', FilterOperator::NotInArray, ['archived']],
    'operator in upper case' => [Column::text('name')->filterInput(), 'NEQ.Lámpara', FilterOperator::Ne, 'Lámpara'],
    'text value with a dot' => [Column::text('email')->filterInput(), 'foo.bar', FilterOperator::ILike, 'foo.bar'],
    'operator name alone is a literal value' => [Column::text('name')->filterInput(), 'eq', FilterOperator::ILike, 'eq'],
    'operator not allowed for the variant' => [Column::text('name')->filterInput(), 'gt.5', FilterOperator::ILike, 'gt.5'],
    'valueless operator' => [Column::text('sku')->filterInput(), 'is.empty', FilterOperator::IsEmpty, ''],
    'range bounds in reverse order' => [Column::number('price')->filterRange(), '50,10', FilterOperator::IsBetween, ['10', '50']],
    'range with an open lower bound' => [Column::number('price')->filterRange(), ',100', FilterOperator::IsBetween, ['', '100']],
    'date between' => [Column::date('released_on')->filterDate(), 'between.2026-01-31,2026-01-01', FilterOperator::IsBetween, ['2026-01-01', '2026-01-31']],
    'boolean in upper case' => [Column::boolean('featured')->filterSelect(), 'TRUE', FilterOperator::Eq, 'true'],
    'declared options keep known values' => [Column::option('status')->options(['active' => 'Activo', 'draft' => 'Borrador'])->filterSelect(), 'active,unknown', FilterOperator::InArray, ['active']],
]);

it('discards a parameter whose value does not fit the variant', function (Column $column, string $param) {
    expect((new FilterParser)->parse($column, $param))->toBeNull();
})->with([
    'empty value' => [Column::text('name')->filterInput(), ''],
    'blank text' => [Column::text('name')->filterInput(), '   '],
    'non numeric number' => [Column::number('stock')->filterInput(), 'abc'],
    'range without bounds' => [Column::number('price')->filterRange(), ','],
    'range with an invalid bound' => [Column::number('price')->filterRange(), '10,abc'],
    'impossible date' => [Column::date('released_on')->filterDate(), '2026-02-30'],
    'boolean other than true or false' => [Column::boolean('featured')->filterSelect(), 'yes'],
    'only undeclared options' => [Column::option('status')->options(['active' => 'Activo'])->filterMultiSelect(), 'unknown'],
    'column without filter' => [Column::text('name'), 'anything'],
]);
