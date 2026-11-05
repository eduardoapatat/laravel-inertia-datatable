<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use BackedEnum;
use Illuminate\Support\Str;
use InertiaDataTable\Column;
use InertiaDataTable\Concerns\HasBadge;
use InertiaDataTable\Concerns\Searchable;
use InertiaDataTable\Enums\FilterVariant;
use InvalidArgumentException;

/**
 * One value of a list, shown with its label:
 * `Column::option('status')->options(Status::class)->badge()->filterMultiSelect()`.
 * Without declared options, the filter offers the values of the column.
 */
final class OptionColumn extends Column
{
    use HasBadge;
    use Searchable;

    /** @var array<string, string>|null */
    private ?array $options = null;

    private bool $withCounts = true;

    /**
     * A list of values, a value => label map or a backed enum (with its
     * `label()` method, if it has one).
     *
     * @param  array<array-key, string|int>|class-string<BackedEnum>  $options
     */
    public function options(array|string $options): self
    {
        $this->options = self::normalizeOptions($options);

        return $this;
    }

    /**
     * List of the options in the toolbar to pick one. `counts: false` skips the
     * query that counts the rows of each option.
     */
    public function filterSelect(bool $counts = true): self
    {
        $this->withCounts = $counts;

        return $this->withFilter(FilterVariant::Select);
    }

    /**
     * List of the options in the toolbar to pick several. `counts: false` skips
     * the query that counts the rows of each option.
     */
    public function filterMultiSelect(bool $counts = true): self
    {
        $this->withCounts = $counts;

        return $this->withFilter(FilterVariant::MultiSelect);
    }

    /**
     * Declared options (value => label), or null to take them from the data.
     *
     * @return array<string, string>|null
     */
    public function optionLabels(): ?array
    {
        return $this->options;
    }

    public function hasCounts(): bool
    {
        return $this->withCounts;
    }

    public function display(): array
    {
        return ['type' => 'option', ...$this->badgeDisplay()];
    }

    /**
     * @param  array<array-key, string|int>|class-string<BackedEnum>  $options
     * @return array<string, string>
     */
    private static function normalizeOptions(array|string $options): array
    {
        if (is_string($options)) {
            if (! is_subclass_of($options, BackedEnum::class)) {
                throw new InvalidArgumentException("[{$options}] is not a backed enum.");
            }

            $normalized = [];

            foreach ($options::cases() as $case) {
                $normalized[(string) $case->value] = method_exists($case, 'label')
                    ? (string) $case->label()
                    : Str::headline($case->name);
            }

            return $normalized;
        }

        if (array_is_list($options)) {
            $options = array_combine(array_map(strval(...), $options), $options);
        }

        $normalized = [];

        foreach ($options as $value => $label) {
            $normalized[(string) $value] = (string) $label;
        }

        return $normalized;
    }
}
