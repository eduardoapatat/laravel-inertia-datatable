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
    'implicit operator of multi-select' => [Column::option('status')->filter(multiple: true), 'active,draft', FilterOperator::InArray, ['active', 'draft']],
    'quoted list item with a comma' => [Column::option('status')->filter(multiple: true), '"Pérez, Ana",Luis', FilterOperator::InArray, ['Pérez, Ana', 'Luis']],
    'doubled quote inside quotes' => [Column::option('status')->filter(multiple: true), '"say ""hi""",x', FilterOperator::InArray, ['say "hi"', 'x']],
    'explicit url operator' => [Column::option('status')->filter(multiple: true), 'not.in.archived', FilterOperator::NotInArray, ['archived']],
    'operator given by its key' => [Column::option('status')->filter(multiple: true), 'notInArray.archived', FilterOperator::NotInArray, ['archived']],
    'operator in upper case' => [Column::text('name')->filter(), 'NEQ.Lámpara', FilterOperator::Ne, 'Lámpara'],
    'text value with a dot' => [Column::text('email')->filter(), 'foo.bar', FilterOperator::ILike, 'foo.bar'],
    'operator name alone is a literal value' => [Column::text('name')->filter(), 'eq', FilterOperator::ILike, 'eq'],
    'operator not allowed for the variant' => [Column::text('name')->filter(), 'gt.5', FilterOperator::ILike, 'gt.5'],
    'valueless operator' => [Column::text('sku')->filter(), 'is.empty', FilterOperator::IsEmpty, ''],
    'range bounds in reverse order' => [Column::number('price')->range(), '50,10', FilterOperator::IsBetween, ['10', '50']],
    'range with an open lower bound' => [Column::number('price')->range(), ',100', FilterOperator::IsBetween, ['', '100']],
    'date between' => [Column::date('released_on')->filter(), 'between.2026-01-31,2026-01-01', FilterOperator::IsBetween, ['2026-01-01', '2026-01-31']],
    'boolean in upper case' => [Column::boolean('featured')->filter(), 'TRUE', FilterOperator::Eq, 'true'],
    'declared options keep known values' => [Column::option('status')->options(['active' => 'Activo', 'draft' => 'Borrador'])->filter(), 'active,unknown', FilterOperator::InArray, ['active']],
]);

it('discards a parameter whose value does not fit the variant', function (Column $column, string $param) {
    expect((new FilterParser)->parse($column, $param))->toBeNull();
})->with([
    'empty value' => [Column::text('name')->filter(), ''],
    'blank text' => [Column::text('name')->filter(), '   '],
    'non numeric number' => [Column::number('stock')->filter(), 'abc'],
    'range without bounds' => [Column::number('price')->range(), ','],
    'range with an invalid bound' => [Column::number('price')->range(), '10,abc'],
    'impossible date' => [Column::date('released_on')->filter(), '2026-02-30'],
    'boolean other than true or false' => [Column::boolean('featured')->filter(), 'yes'],
    'only undeclared options' => [Column::option('status')->options(['active' => 'Activo'])->filter(multiple: true), 'unknown'],
    'column without filter' => [Column::text('name'), 'anything'],
]);
