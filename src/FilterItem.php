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
     * @param  array{string, string}|null  $range  Days a `rel` filter resolved to (`YYYY-MM-DD`).
     */
    public function __construct(
        public string $id,
        public FilterVariant $variant,
        public FilterOperator $operator,
        public string|array $value,
        public ?array $range = null,
    ) {}

    /**
     * @return array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>, range?: array{string, string}}
     */
    public function toArray(int $index): array
    {
        $item = [
            'id' => $this->id,
            'filterId' => "{$this->id}-{$index}",
            'variant' => $this->variant->value,
            'operator' => $this->operator->value,
            'value' => $this->value,
        ];

        if ($this->range !== null) {
            $item['range'] = $this->range;
        }

        return $item;
    }
}
