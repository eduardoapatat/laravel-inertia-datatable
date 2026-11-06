<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use InertiaDataTable\Column;
use InertiaDataTable\Concerns\Searchable;
use InertiaDataTable\Enums\FilterVariant;
use InvalidArgumentException;

/**
 * Number, amount or percentage, formatted on the client with Intl and the
 * table locale: `Column::number('price')->money('CLP')->filterRange()`. The
 * format methods add up (`->money('CLP')->decimals(0)`).
 */
final class NumberColumn extends Column
{
    use Searchable;

    /** @var array<string, mixed> */
    private array $format = [];

    private ?string $unit = null;

    private ?string $placeholder = null;

    private int|float|null $min = null;

    private int|float|null $max = null;

    /**
     * How the currency of `money()` is shown, when it is not the symbol before the number.
     *
     * @var array{cell?: 'code'|'both'|'none', filter?: 'code'|'none'}
     */
    private array $currency = [];

    private const array CELL_CURRENCY_DISPLAYS = ['symbol', 'code', 'both', 'none'];

    private const array FILTER_CURRENCY_DISPLAYS = ['symbol', 'code', 'none'];

    /**
     * Amount in a currency (ISO 4217 code). Without a currency, the one of
     * `inertia-datatable.currency`. `cell` and `filter` choose how the currency
     * is shown in the cells (and the filter label) and next to the filter inputs:
     * `symbol` before the number (`$1.234`, by default), `code` after it
     * (`1.234 CLP`) or `none` (`1.234`); the cells also take `both`
     * (`$1.234 CLP`). The locale gives the separators.
     *
     * @param  string  $cell  `symbol`, `code`, `both` or `none`.
     * @param  string  $filter  `symbol`, `code` or `none`.
     */
    public function money(?string $currency = null, ?int $decimals = null, string $cell = 'symbol', string $filter = 'symbol'): self
    {
        $currency ??= config('inertia-datatable.currency');

        if (! is_string($currency)) {
            throw new InvalidArgumentException('Pass a currency to money() or set inertia-datatable.currency.');
        }

        if (preg_match('/^[A-Z]{3}$/', $currency) !== 1) {
            throw new InvalidArgumentException("The currency [{$currency}] must be an ISO 4217 code, such as USD or CLP.");
        }

        foreach (['cell' => [$cell, self::CELL_CURRENCY_DISPLAYS], 'filter' => [$filter, self::FILTER_CURRENCY_DISPLAYS]] as $place => [$display, $allowed]) {
            if (! in_array($display, $allowed, true)) {
                throw new InvalidArgumentException("The {$place} currency display [{$display}] is not one of: ".implode(', ', $allowed).'.');
            }
        }

        /** @var array{cell?: 'code'|'both'|'none', filter?: 'code'|'none'} $displays */
        $displays = array_filter(['cell' => $cell, 'filter' => $filter], fn (string $display): bool => $display !== 'symbol');
        $this->currency = $displays;

        return $this->format(['style' => 'currency', 'currency' => $currency, ...$this->fractionDigits($decimals)]);
    }

    /**
     * Fixed number of decimals: `decimals(2)` → `1.234,50`.
     */
    public function decimals(int $decimals): self
    {
        return $this->format($this->fractionDigits($decimals));
    }

    /**
     * A ratio shown as a percentage: `0.25` → `25 %`.
     */
    public function percent(?int $decimals = null): self
    {
        return $this->format(['style' => 'percent', ...$this->fractionDigits($decimals)]);
    }

    /**
     * Any Intl.NumberFormat option, such as `['notation' => 'compact']`.
     *
     * @param  array<string, mixed>  $options
     */
    public function format(array $options): self
    {
        $this->format = [...$this->format, ...$options];
        $this->ensureUnitFits();

        return $this;
    }

    /**
     * Unit after plain numbers, in the cells and in the filters: `unit('kg')` → `12 kg`.
     */
    public function unit(string $unit): self
    {
        if (trim($unit) === '') {
            throw new InvalidArgumentException('The unit cannot be empty.');
        }

        $this->unit = $unit;
        $this->ensureUnitFits();

        return $this;
    }

    /**
     * Number input in the toolbar that keeps the rows with that exact value.
     * The URL also accepts other operators (`gt.100`, `between.10,50`…,
     * docs/contract.md §1.4).
     */
    public function filterInput(?string $placeholder = null): self
    {
        $this->placeholder = $placeholder;

        return $this->withFilter(FilterVariant::Number);
    }

    /**
     * Slider with a from / to input in the toolbar. Without `min`/`max` its
     * bounds are computed from the base query.
     */
    public function filterRange(int|float|null $min = null, int|float|null $max = null): self
    {
        if ($min !== null && $max !== null && $min > $max) {
            throw new InvalidArgumentException("The range of the column [{$this->id()}] starts after it ends.");
        }

        $this->min = $min;
        $this->max = $max;

        return $this->withFilter(FilterVariant::Range);
    }

    public function min(): int|float|null
    {
        return $this->min;
    }

    public function max(): int|float|null
    {
        return $this->max;
    }

    public function display(): array
    {
        return array_filter(
            [
                'type' => 'number',
                'format' => $this->format === [] ? null : $this->format,
                'unit' => $this->unit,
                'currency' => $this->currency === [] ? null : $this->currency,
            ],
            fn (mixed $value): bool => $value !== null,
        );
    }

    protected function filterOptions(): array
    {
        return $this->placeholder === null ? [] : ['placeholder' => $this->placeholder];
    }

    /**
     * A currency or a percentage already says the unit.
     */
    private function ensureUnitFits(): void
    {
        if ($this->unit !== null && isset($this->format['style'])) {
            throw new InvalidArgumentException("The column [{$this->id()}] has a unit and a currency or percent format: use one of them.");
        }
    }

    /**
     * @return array<string, int>
     */
    private function fractionDigits(?int $decimals): array
    {
        if ($decimals === null) {
            return [];
        }

        if ($decimals < 0) {
            throw new InvalidArgumentException('The number of decimals cannot be negative.');
        }

        return ['minimumFractionDigits' => $decimals, 'maximumFractionDigits' => $decimals];
    }
}
