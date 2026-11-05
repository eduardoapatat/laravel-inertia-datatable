<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

use InertiaDataTable\Enums\DatePreset;
use InvalidArgumentException;

/**
 * How the cells of a column are displayed (docs/contract.md §2.6). Independent
 * of the filter: `->dateRange()` filters by dates, `->dateFormat('long')` shows
 * them. The value is formatted on the client with Intl and the table locale;
 * the row keeps the raw value.
 */
trait HasDisplay
{
    /** @var array<string, mixed>|null */
    private ?array $display = null;

    /**
     * Amount in a currency (ISO 4217 code): `money('CLP')` → `$1.234`. Without
     * a currency, the one of `inertia-datatable.currency`.
     */
    public function money(?string $currency = null, ?int $decimals = null): static
    {
        $currency ??= config('inertia-datatable.currency');

        if (! is_string($currency)) {
            throw new InvalidArgumentException('Pass a currency to money() or set inertia-datatable.currency.');
        }

        if (preg_match('/^[A-Z]{3}$/', $currency) !== 1) {
            throw new InvalidArgumentException("The currency [{$currency}] must be an ISO 4217 code, such as USD or CLP.");
        }

        return $this->withNumberFormat(['style' => 'currency', 'currency' => $currency, ...$this->fractionDigits($decimals)]);
    }

    /**
     * Fixed number of decimals: `decimals(2)` → `1.234,50`.
     */
    public function decimals(int $decimals): static
    {
        return $this->withNumberFormat($this->fractionDigits($decimals));
    }

    /**
     * A ratio shown as a percentage: `0.25` → `25 %`.
     */
    public function percent(?int $decimals = null): static
    {
        return $this->withNumberFormat(['style' => 'percent', ...$this->fractionDigits($decimals)]);
    }

    /**
     * Any Intl.NumberFormat option, such as `['notation' => 'compact']`.
     *
     * @param  array<string, mixed>  $options
     */
    public function numberFormat(array $options): static
    {
        return $this->withNumberFormat($options);
    }

    /**
     * A preset (`short`, `medium`, `long`, `datetime`, `relative`) or Intl.DateTimeFormat
     * options. Without a format, the one of `inertia-datatable.date_format`.
     *
     * @param  string|array<string, mixed>|null  $format
     */
    public function dateFormat(string|array|null $format = null): static
    {
        $format ??= (string) config('inertia-datatable.date_format', 'long');

        if (is_string($format)) {
            DatePreset::ensure($format, 'The date format');
        }

        $this->display = ['type' => 'date', 'format' => $format === [] ? 'long' : $format];

        return $this;
    }

    /**
     * Cuts long texts to the given characters; the full text stays in the tooltip.
     */
    public function limit(int $characters): static
    {
        if ($characters < 1) {
            throw new InvalidArgumentException('The text limit must be at least 1 character.');
        }

        return $this->withText(['limit' => $characters]);
    }

    /**
     * Shows the value as a link (only http and https URLs).
     */
    public function url(): static
    {
        return $this->withText(['link' => 'url']);
    }

    /**
     * Shows the value as a mailto link.
     */
    public function email(): static
    {
        return $this->withText(['link' => 'email']);
    }

    public function booleanLabels(string $true, string $false): static
    {
        $this->display = ['type' => 'boolean', 'labels' => ['true' => $true, 'false' => $false]];

        return $this;
    }

    /**
     * Shows the option labels with the project's shadcn Badge (and the icons
     * declared in React, if any): `badge('secondary', ['archived' => 'destructive'])`
     * gives the column variant and the variant of some values. Any variant of the
     * project's badge.tsx works; `false` shows plain labels.
     *
     * @param  array<string, string>  $variants  Variant per option value.
     */
    public function badge(string|false $variant = 'outline', array $variants = []): static
    {
        if ($variant === false) {
            $this->display = ['type' => 'option', 'badge' => false];

            return $this;
        }

        foreach ([$variant, ...array_values($variants)] as $name) {
            if (trim($name) === '') {
                throw new InvalidArgumentException('A badge variant must be a non-empty string, such as outline or secondary.');
            }
        }

        $this->display = ['type' => 'option', 'badge' => true, 'variant' => $variant];

        if ($variants !== []) {
            $this->display['variants'] = array_combine(array_map(strval(...), array_keys($variants)), array_values($variants));
        }

        return $this;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function display(): ?array
    {
        return $this->display;
    }

    /**
     * Number methods add up (`->money('CLP')->decimals(0)`); a method of another type replaces them.
     *
     * @param  array<string, mixed>  $format
     */
    private function withNumberFormat(array $format): static
    {
        $current = ($this->display['type'] ?? null) === 'number' ? (array) ($this->display['format'] ?? []) : [];
        $merged = [...$current, ...$format];

        $this->display = $merged === [] ? ['type' => 'number'] : ['type' => 'number', 'format' => $merged];

        return $this;
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private function withText(array $options): static
    {
        $current = ($this->display['type'] ?? null) === 'text' ? $this->display : ['type' => 'text'];
        $this->display = [...$current, ...$options];

        return $this;
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
