<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use InertiaDataTable\Column;
use InertiaDataTable\Enums\DatePreset;
use InertiaDataTable\Enums\FilterVariant;

/**
 * Date or date and time: `Column::date('published_at')->format('short')->filterRange()`.
 * Without `format()`, the date format of the table.
 */
final class DateColumn extends Column
{
    /** @var string|array<string, mixed>|null */
    private string|array|null $format = null;

    private bool $presets = false;

    /**
     * A preset (`short`, `medium`, `long`, `datetime`, `relative`) or Intl.DateTimeFormat options.
     *
     * @param  string|array<string, mixed>  $format
     */
    public function format(string|array $format): self
    {
        if (is_string($format)) {
            DatePreset::ensure($format, 'The date format');
        }

        $this->format = $format === [] ? null : $format;

        return $this;
    }

    /**
     * Calendar in the toolbar to pick one day. The URL also accepts other
     * operators (`lt.2026-01-01`, `rel.-7d`, `is.empty`…, docs/contract.md §1.4).
     * `empty: true` adds a check for the rows without a date; `presets: true`,
     * days relative to today (Today, Last 7 days, This month…) next to the calendar.
     */
    public function filterDate(bool $empty = false, bool $presets = false): self
    {
        $this->presets = $presets;

        return $this->withFilter(FilterVariant::Date, $empty);
    }

    /**
     * Calendar in the toolbar to pick a from / to range of days. `empty: true`
     * adds a check for the rows without a date; `presets: true`, ranges relative
     * to today (Today, Last 7 days, This month…) next to the calendar.
     */
    public function filterRange(bool $empty = false, bool $presets = false): self
    {
        $this->presets = $presets;

        return $this->withFilter(FilterVariant::DateRange, $empty);
    }

    protected function filterOptions(): array
    {
        return $this->presets ? ['presets' => true] : [];
    }

    public function display(): array
    {
        return $this->format === null ? ['type' => 'date'] : ['type' => 'date', 'format' => $this->format];
    }
}
