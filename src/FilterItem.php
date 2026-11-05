<?php

declare(strict_types=1);

namespace InertiaDataTable;

use InertiaDataTable\Enums\FilterOperator;
use InertiaDataTable\Enums\FilterVariant;

/**
 * Normalized filter (the frontend `ColumnFilterItem` shape).
 */
final readonly class FilterItem
{
    /**
     * @param  string|list<string>  $value
     */
    public function __construct(
        public string $id,
        public FilterVariant $variant,
        public FilterOperator $operator,
        public string|array $value,
    ) {}

    /**
     * @return array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>}
     */
    public function toArray(int $index): array
    {
        return [
            'id' => $this->id,
            'filterId' => "{$this->id}-{$index}",
            'variant' => $this->variant->value,
            'operator' => $this->operator->value,
            'value' => $this->value,
        ];
    }
}
