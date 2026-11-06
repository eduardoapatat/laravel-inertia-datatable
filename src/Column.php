<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Illuminate\Support\Str;
use InertiaDataTable\Columns\BooleanColumn;
use InertiaDataTable\Columns\DateColumn;
use InertiaDataTable\Columns\NumberColumn;
use InertiaDataTable\Columns\OptionColumn;
use InertiaDataTable\Columns\TextColumn;
use InertiaDataTable\Enums\FilterVariant;
use InvalidArgumentException;
use LogicException;

/**
 * A DataTable column: public id, source of the value and capabilities (sort,
 * search, hide). The type of the column (`Column::number()`, `Column::date()`…)
 * says how its cells are displayed and which filters it can have, so every
 * column only offers the methods that make sense for its values.
 */
abstract class Column
{
    private string $label;

    private string $path;

    private bool $sortable = false;

    private bool $searchable = false;

    private bool $hideable = true;

    private bool $visible = true;

    private ?FilterVariant $filter = null;

    final protected function __construct(private readonly string $id, ?string $label)
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $id) !== 1) {
            throw new InvalidArgumentException("The column id [{$id}] may only contain letters, numbers and underscores.");
        }

        $this->label = $label ?? Str::headline($id);
        $this->path = $id;
    }

    /**
     * Plain text, cut with `limit()` or shown as a link with `url()` / `email()`.
     */
    public static function text(string $id, ?string $label = null): TextColumn
    {
        return new TextColumn($id, $label);
    }

    /**
     * Number, amount (`money()`) or percentage, with an exact or range filter.
     */
    public static function number(string $id, ?string $label = null): NumberColumn
    {
        return new NumberColumn($id, $label);
    }

    /**
     * Date or date and time, with a date or date range filter.
     */
    public static function date(string $id, ?string $label = null): DateColumn
    {
        return new DateColumn($id, $label);
    }

    /**
     * Yes / No, with its labels and badge.
     */
    public static function boolean(string $id, ?string $label = null): BooleanColumn
    {
        return new BooleanColumn($id, $label);
    }

    /**
     * One value of a list (an enum, a status, a relation name…), with its
     * labels, badge and a select filter with counts.
     */
    public static function option(string $id, ?string $label = null): OptionColumn
    {
        return new OptionColumn($id, $label);
    }

    /**
     * Takes the value from another column or from a to-one relation: `from('category.name')`.
     */
    public function from(string $path): static
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $path) !== 1) {
            throw new InvalidArgumentException("The path [{$path}] must be 'column' or 'relation.column' (one level).");
        }

        $this->path = $path;

        return $this;
    }

    public function sortable(bool $sortable = true): static
    {
        $this->sortable = $sortable;

        return $this;
    }

    /**
     * Whether the user can hide the column; `hideable(false)` for the column
     * that identifies the row.
     */
    public function hideable(bool $hideable = true): static
    {
        $this->hideable = $hideable;
        $this->ensureCanBeShown();

        return $this;
    }

    /**
     * Hides the column by default (the user can show it).
     */
    public function hidden(bool $hidden = true): static
    {
        $this->visible = ! $hidden;
        $this->ensureCanBeShown();

        return $this;
    }

    public function id(): string
    {
        return $this->id;
    }

    public function label(): string
    {
        return $this->label;
    }

    public function relation(): ?string
    {
        return str_contains($this->path, '.') ? Str::before($this->path, '.') : null;
    }

    public function attribute(): string
    {
        return str_contains($this->path, '.') ? Str::after($this->path, '.') : $this->path;
    }

    public function isSortable(): bool
    {
        return $this->sortable;
    }

    public function isSearchable(): bool
    {
        return $this->searchable;
    }

    public function isHideable(): bool
    {
        return $this->hideable;
    }

    public function isVisibleByDefault(): bool
    {
        return $this->visible;
    }

    /**
     * Variant of the filter of the column, or null without one. Read by the
     * engine; to add a filter use the `filter…()` methods of each type.
     *
     * @internal
     */
    public function variantOfFilter(): ?FilterVariant
    {
        return $this->filter;
    }

    /**
     * How the cells are displayed; `type` is the type of the column (docs/contract.md §2.6).
     *
     * @return array{type: string}&array<string, mixed>
     */
    abstract public function display(): array;

    /**
     * @return array{id: string, label: string, sortable: bool, hideable: bool, visible: bool, display: array<string, mixed>, filter: array<string, mixed>|null}
     */
    public function toConfig(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'sortable' => $this->sortable,
            'hideable' => $this->hideable,
            'visible' => $this->isVisibleByDefault(),
            'display' => $this->display(),
            'filter' => $this->filter === null ? null : ['variant' => $this->filter->value, ...$this->filterOptions()],
        ];
    }

    /**
     * Extra keys of the filter in the config, such as the placeholder.
     *
     * @return array<string, mixed>
     */
    protected function filterOptions(): array
    {
        return [];
    }

    /**
     * Included in the global search, which compares text (`LIKE`): offered by
     * the text, number and option columns.
     */
    protected function withSearch(bool $searchable): static
    {
        $this->searchable = $searchable;

        return $this;
    }

    /**
     * A column has one filter: a second filter method is a mistake, not a change.
     */
    protected function withFilter(FilterVariant $variant): static
    {
        if ($this->filter !== null) {
            throw new LogicException("The column [{$this->id}] already has a {$this->filter->value} filter.");
        }

        $this->filter = $variant;

        return $this;
    }

    /**
     * A hidden column that cannot be hidden would have no way to be shown.
     */
    private function ensureCanBeShown(): void
    {
        if (! $this->visible && ! $this->hideable) {
            throw new LogicException("The column [{$this->id}] is hidden but not hideable, so the user could never show it.");
        }
    }
}
