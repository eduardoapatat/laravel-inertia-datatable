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

    /** @var array<string, string> Badge variant per value, from `badgeVariant()` of the enum. */
    private array $enumVariants = [];

    private bool $withCounts = true;

    /**
     * A list of values, a value => label map or a backed enum. The enum gives
     * the label of each case with a `label()` method and, with `badge()`, its
     * badge variant with a `badgeVariant()` method (the variants passed to
     * `badge()` win).
     *
     * A map whose values are the numbers 0, 1, 2… in order (`[0 => 'Low',
     * 1 => 'High']`) is the same array as a list for PHP, so it is read as
     * the values "Low" and "High": use an int backed enum for those.
     *
     * @param  array<array-key, string|int>|class-string<BackedEnum>  $options
     */
    public function options(array|string $options): self
    {
        $this->options = self::normalizeOptions($options);
        $this->enumVariants = is_string($options) ? self::enumVariants($options) : [];

        return $this;
    }

    /**
     * List of the options in the toolbar to pick one. `counts: false` skips the
     * query that counts the rows of each option; `empty: true` adds an option
     * for the rows without a value.
     */
    public function filterSelect(bool $counts = true, bool $empty = false): self
    {
        $this->withCounts = $counts;

        return $this->withFilter(FilterVariant::Select, $empty);
    }

    /**
     * List of the options in the toolbar to pick several. `counts: false` skips
     * the query that counts the rows of each option; `empty: true` adds an
     * option for the rows without a value.
     */
    public function filterMultiSelect(bool $counts = true, bool $empty = false): self
    {
        $this->withCounts = $counts;

        return $this->withFilter(FilterVariant::MultiSelect, $empty);
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
        $badge = $this->badgeDisplay();

        if (($badge['badge'] ?? false) && $this->enumVariants !== []) {
            $badge['variants'] = [...$this->enumVariants, ...$badge['variants'] ?? []];
        }

        return ['type' => 'option', ...$badge];
    }

    /**
     * @param  class-string<BackedEnum>  $enum
     * @return array<string, string>
     */
    private static function enumVariants(string $enum): array
    {
        $variants = [];

        foreach ($enum::cases() as $case) {
            if (! method_exists($case, 'badgeVariant')) {
                return [];
            }

            $variant = $case->badgeVariant();

            if (! is_string($variant) || trim($variant) === '') {
                throw new InvalidArgumentException("{$enum}::badgeVariant() must return a badge variant, such as outline or secondary.");
            }

            $variants[(string) $case->value] = $variant;
        }

        return $variants;
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
