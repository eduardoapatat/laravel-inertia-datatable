<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

use InertiaDataTable\Enums\DatePreset;
use InertiaDataTable\Enums\FilterVariant;
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

    /**
     * Texts of true and false; without them, the Yes / No of the UI texts in the
     * app language. Adds up with `badge()`.
     */
    public function booleanLabels(string $true, string $false): static
    {
        $this->display = ['type' => 'boolean', 'labels' => ['true' => $true, 'false' => $false], ...$this->currentBadge()];

        return $this;
    }

    /**
     * Shows the option labels with the project's shadcn Badge (and the icons
     * declared in React, if any): `badge('secondary', ['archived' => 'destructive'])`
     * gives the column variant and the variant of some values. Any variant of the
     * project's badge.tsx works; `false` shows plain labels. In a boolean column
     * the values are `true` and `false`, and it adds up with `booleanLabels()`.
     *
     * @param  array<array-key, string>  $variants  Variant per option value.
     */
    public function badge(string|false $variant = 'outline', array $variants = []): static
    {
        if ($variant === false) {
            return $this->withBadge(['badge' => false]);
        }

        foreach ([$variant, ...array_values($variants)] as $name) {
            if (trim($name) === '') {
                throw new InvalidArgumentException('A badge variant must be a non-empty string, such as outline or secondary.');
            }
        }

        $badge = ['badge' => true, 'variant' => $variant];

        if ($variants !== []) {
            $badge['variants'] = array_combine(array_map(strval(...), array_keys($variants)), array_values($variants));
        }

        return $this->withBadge($badge);
    }

    /**
     * The display of the column; in a boolean column, `badge()` displays
     * booleans (with keys `true` / `false`, also given as 1 / 0).
     *
     * @return array<string, mixed>|null
     */
    public function display(): ?array
    {
        $display = $this->display;

        if ($display === null || $this->variant !== FilterVariant::Boolean || ! in_array($display['type'], ['option', 'boolean'], true)) {
            return $display;
        }

        $display['type'] = 'boolean';

        if (isset($display['variants']) && is_array($display['variants'])) {
            $variants = [];

            foreach ($display['variants'] as $key => $name) {
                $variants[match ((string) $key) {
                    '1' => 'true',
                    '0' => 'false',
                    default => (string) $key,
                }] = $name;
            }

            $display['variants'] = $variants;
        }

        return $display;
    }

    /**
     * `badge()` keeps the labels of `booleanLabels()` and the other way around.
     *
     * @param  array<string, mixed>  $badge
     */
    private function withBadge(array $badge): static
    {
        $this->display = ($this->display['type'] ?? null) === 'boolean'
            ? [...array_diff_key($this->display, array_flip(['badge', 'variant', 'variants'])), ...$badge]
            : ['type' => 'option', ...$badge];

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    private function currentBadge(): array
    {
        if (! in_array($this->display['type'] ?? null, ['option', 'boolean'], true)) {
            return [];
        }

        return array_intersect_key((array) $this->display, array_flip(['badge', 'variant', 'variants']));
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
