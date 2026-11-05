<?php

declare(strict_types=1);

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\Enums\FilterOperator;
use EduardoApatat\InertiaDataTable\Parsing\FilterParser;

it('parses a parameter into its operator and normalized value', function (Column $column, string $param, FilterOperator $operator, string|array $value) {
    $filter = (new FilterParser)->parse($column, $param);

    expect($filter?->operator)->toBe($operator)
        ->and($filter?->value)->toBe($value);
})->with([
    'implicit operator of multi-select' => [Column::make('status')->multiSelect(), 'active,draft', FilterOperator::InArray, ['active', 'draft']],
    'quoted list item with a comma' => [Column::make('status')->multiSelect(), '"Pérez, Ana",Luis', FilterOperator::InArray, ['Pérez, Ana', 'Luis']],
    'doubled quote inside quotes' => [Column::make('status')->multiSelect(), '"say ""hi""",x', FilterOperator::InArray, ['say "hi"', 'x']],
    'explicit url operator' => [Column::make('status')->multiSelect(), 'not.in.archived', FilterOperator::NotInArray, ['archived']],
    'operator given by its key' => [Column::make('status')->multiSelect(), 'notInArray.archived', FilterOperator::NotInArray, ['archived']],
    'operator in upper case' => [Column::make('name')->text(), 'NEQ.Lámpara', FilterOperator::Ne, 'Lámpara'],
    'text value with a dot' => [Column::make('email')->text(), 'foo.bar', FilterOperator::ILike, 'foo.bar'],
    'operator name alone is a literal value' => [Column::make('name')->text(), 'eq', FilterOperator::ILike, 'eq'],
    'operator not allowed for the variant' => [Column::make('name')->text(), 'gt.5', FilterOperator::ILike, 'gt.5'],
    'valueless operator' => [Column::make('sku')->text(), 'is.empty', FilterOperator::IsEmpty, ''],
    'range bounds in reverse order' => [Column::make('price')->range(), '50,10', FilterOperator::IsBetween, ['10', '50']],
    'range with an open lower bound' => [Column::make('price')->range(), ',100', FilterOperator::IsBetween, ['', '100']],
    'date between' => [Column::make('released_on')->date(), 'between.2026-01-31,2026-01-01', FilterOperator::IsBetween, ['2026-01-01', '2026-01-31']],
    'boolean in upper case' => [Column::make('featured')->boolean(), 'TRUE', FilterOperator::Eq, 'true'],
    'declared options keep known values' => [Column::make('status')->select(['active' => 'Activo', 'draft' => 'Borrador']), 'active,unknown', FilterOperator::InArray, ['active']],
]);

it('discards a parameter whose value does not fit the variant', function (Column $column, string $param) {
    expect((new FilterParser)->parse($column, $param))->toBeNull();
})->with([
    'empty value' => [Column::make('name')->text(), ''],
    'blank text' => [Column::make('name')->text(), '   '],
    'non numeric number' => [Column::make('stock')->number(), 'abc'],
    'range without bounds' => [Column::make('price')->range(), ','],
    'range with an invalid bound' => [Column::make('price')->range(), '10,abc'],
    'impossible date' => [Column::make('released_on')->date(), '2026-02-30'],
    'boolean other than true or false' => [Column::make('featured')->boolean(), 'yes'],
    'only undeclared options' => [Column::make('status')->multiSelect(['active' => 'Activo']), 'unknown'],
    'column without filter' => [Column::make('name'), 'anything'],
]);
