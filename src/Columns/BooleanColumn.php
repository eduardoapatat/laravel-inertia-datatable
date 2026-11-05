<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use InertiaDataTable\Column;
use InertiaDataTable\Concerns\HasBadge;
use InertiaDataTable\Enums\FilterVariant;

/**
 * Yes / No: `Column::boolean('featured')->labels('Sí', 'No')->badge()->filter()`.
 * Without `labels()`, the Yes / No of the UI texts in the app language. The
 * badge variants use the keys `true` and `false` (also given as 1 / 0).
 */
final class BooleanColumn extends Column
{
    use HasBadge;

    /** @var array{true: string, false: string}|null */
    private ?array $labels = null;

    public function labels(string $true, string $false): self
    {
        $this->labels = ['true' => $true, 'false' => $false];

        return $this;
    }

    /**
     * Yes / No filter.
     */
    public function filter(): self
    {
        return $this->withFilter(FilterVariant::Boolean);
    }

    public function display(): array
    {
        return [
            'type' => 'boolean',
            ...($this->labels === null ? [] : ['labels' => $this->labels]),
            ...$this->badgeDisplay(),
        ];
    }

    protected function badgeKey(int|string $value): string
    {
        return match ((string) $value) {
            '1' => 'true',
            '0' => 'false',
            default => (string) $value,
        };
    }
}
