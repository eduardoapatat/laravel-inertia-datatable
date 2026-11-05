<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use BackedEnum;
use Illuminate\Support\Str;
use InertiaDataTable\Column;
use InertiaDataTable\Concerns\HasBadge;
use InertiaDataTable\Enums\FilterVariant;
use InvalidArgumentException;

/**
 * One value of a list, shown with its label:
 * `Column::option('status')->options(Status::class)->badge()->filter(multiple: true)`.
 * Without declared options, the filter offers the values of the column.
 */
final class OptionColumn extends Column
{
    use HasBadge;

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
     * Shows or hides the number of rows of each option in the filter.
     */
    public function withCounts(bool $withCounts = true): self
    {
        $this->withCounts = $withCounts;

        return $this;
    }

    /**
     * Filter by the options: one at a time, or several with `multiple: true`.
     */
    public function filter(bool $multiple = false): self
    {
        return $this->withFilter($multiple ? FilterVariant::MultiSelect : FilterVariant::Select);
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
