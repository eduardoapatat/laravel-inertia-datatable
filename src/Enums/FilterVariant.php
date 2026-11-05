<?php

declare(strict_types=1);

namespace InertiaDataTable\Enums;

/**
 * Filter variants of the contract (same as the frontend DataTable).
 */
enum FilterVariant: string
{
    case Text = 'text';
    case Number = 'number';
    case Range = 'range';
    case Date = 'date';
    case DateRange = 'date-range';
    case Boolean = 'boolean';
    case Select = 'select';
    case MultiSelect = 'multi-select';

    /**
     * Operator applied when the parameter does not specify one.
     */
    public function implicitOperator(): FilterOperator
    {
        return match ($this) {
            self::Text => FilterOperator::ILike,
            self::Select, self::MultiSelect => FilterOperator::InArray,
            self::Range, self::DateRange => FilterOperator::IsBetween,
            default => FilterOperator::Eq,
        };
    }

    /**
     * Operators allowed for the variant.
     *
     * @return list<FilterOperator>
     */
    public function operators(): array
    {
        return match ($this) {
            self::Text => [
                FilterOperator::ILike, FilterOperator::NotILike, FilterOperator::Eq, FilterOperator::Ne,
                FilterOperator::IsEmpty, FilterOperator::IsNotEmpty,
            ],
            self::Number, self::Range, self::Date, self::DateRange => [
                FilterOperator::Eq, FilterOperator::Ne, FilterOperator::Lt, FilterOperator::Lte,
                FilterOperator::Gt, FilterOperator::Gte, FilterOperator::IsBetween,
                FilterOperator::IsEmpty, FilterOperator::IsNotEmpty,
            ],
            self::Boolean => [FilterOperator::Eq, FilterOperator::Ne],
            self::Select => [
                FilterOperator::InArray, FilterOperator::Eq, FilterOperator::Ne,
                FilterOperator::IsEmpty, FilterOperator::IsNotEmpty,
            ],
            self::MultiSelect => [
                FilterOperator::InArray, FilterOperator::NotInArray,
                FilterOperator::IsEmpty, FilterOperator::IsNotEmpty,
            ],
        };
    }

    public function allows(FilterOperator $operator): bool
    {
        return in_array($operator, $this->operators(), true);
    }

    public function isDate(): bool
    {
        return $this === self::Date || $this === self::DateRange;
    }

    public function isNumeric(): bool
    {
        return $this === self::Number || $this === self::Range;
    }

    /**
     * Variants whose options (and counts) the server computes.
     */
    public function hasOptions(): bool
    {
        return $this === self::Select || $this === self::MultiSelect;
    }
}
