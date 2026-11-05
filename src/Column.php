<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable;

use BackedEnum;
use EduardoApatat\InertiaDataTable\Enums\FilterVariant;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Columna de un DataTable: id público, origen del valor y capacidades
 * (ordenar, filtrar, buscar, ocultar).
 */
final class Column
{
    private string $label;

    private string $path;

    private bool $sortable = false;

    private bool $searchable = false;

    private bool $hideable = true;

    private bool $visible = true;

    private ?FilterVariant $variant = null;

    /** @var array<string, string>|null */
    private ?array $options = null;

    private bool $withCounts = true;

    private int|float|null $min = null;

    private int|float|null $max = null;

    private ?string $unit = null;

    private ?string $placeholder = null;

    private function __construct(private readonly string $id, ?string $label)
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $id) !== 1) {
            throw new InvalidArgumentException("El id de columna [{$id}] solo puede contener letras, números y guiones bajos.");
        }

        $this->label = $label ?? Str::headline($id);
        $this->path = $id;
    }

    public static function make(string $id, ?string $label = null): self
    {
        return new self($id, $label);
    }

    /**
     * Toma el valor de otra columna o de una relación a uno: `from('category.name')`.
     */
    public function from(string $path): self
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $path) !== 1) {
            throw new InvalidArgumentException("La ruta [{$path}] debe ser 'columna' o 'relacion.columna' (un solo nivel).");
        }

        $this->path = $path;

        return $this;
    }

    public function sortable(bool $sortable = true): self
    {
        $this->sortable = $sortable;

        return $this;
    }

    public function searchable(bool $searchable = true): self
    {
        $this->searchable = $searchable;

        return $this;
    }

    public function hideable(bool $hideable = true): self
    {
        $this->hideable = $hideable;

        return $this;
    }

    /**
     * Oculta la columna por defecto (el usuario puede mostrarla).
     */
    public function hidden(bool $hidden = true): self
    {
        $this->visible = ! $hidden;

        return $this;
    }

    public function placeholder(string $placeholder): self
    {
        $this->placeholder = $placeholder;

        return $this;
    }

    public function text(?string $placeholder = null): self
    {
        $this->placeholder = $placeholder ?? $this->placeholder;

        return $this->variant(FilterVariant::Text);
    }

    public function number(?string $unit = null): self
    {
        $this->unit = $unit;

        return $this->variant(FilterVariant::Number);
    }

    /**
     * Filtro de rango numérico. Sin `min`/`max` se calculan con la consulta base.
     */
    public function range(int|float|null $min = null, int|float|null $max = null, ?string $unit = null): self
    {
        $this->min = $min;
        $this->max = $max;
        $this->unit = $unit;

        return $this->variant(FilterVariant::Range);
    }

    public function date(): self
    {
        return $this->variant(FilterVariant::Date);
    }

    public function dateRange(): self
    {
        return $this->variant(FilterVariant::DateRange);
    }

    public function boolean(): self
    {
        return $this->variant(FilterVariant::Boolean);
    }

    /**
     * @param  array<array-key, string|int>|class-string<BackedEnum>|null  $options
     */
    public function select(array|string|null $options = null): self
    {
        $this->options = self::normalizeOptions($options);

        return $this->variant(FilterVariant::Select);
    }

    /**
     * @param  array<array-key, string|int>|class-string<BackedEnum>|null  $options
     */
    public function multiSelect(array|string|null $options = null): self
    {
        $this->options = self::normalizeOptions($options);

        return $this->variant(FilterVariant::MultiSelect);
    }

    /**
     * Activa o desactiva los conteos de las opciones (select / multi-select).
     */
    public function withCounts(bool $withCounts = true): self
    {
        $this->withCounts = $withCounts;

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
        return $this->visible || ! $this->hideable;
    }

    public function variant(?FilterVariant $variant = null): self
    {
        $this->variant = $variant;

        return $this;
    }

    public function filterVariant(): ?FilterVariant
    {
        return $this->variant;
    }

    /**
     * @return array<string, string>|null
     */
    public function options(): ?array
    {
        return $this->options;
    }

    public function hasCounts(): bool
    {
        return $this->withCounts;
    }

    public function min(): int|float|null
    {
        return $this->min;
    }

    public function max(): int|float|null
    {
        return $this->max;
    }

    /**
     * @return array{id: string, label: string, sortable: bool, variant: string|null, placeholder: string|null, unit: string|null, hideable: bool, visible: bool}
     */
    public function toConfig(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'sortable' => $this->sortable,
            'variant' => $this->variant?->value,
            'placeholder' => $this->placeholder,
            'unit' => $this->unit,
            'hideable' => $this->hideable,
            'visible' => $this->isVisibleByDefault(),
        ];
    }

    /**
     * Acepta una lista de valores, un mapa valor => etiqueta o un enum respaldado.
     *
     * @param  array<array-key, string|int>|class-string<BackedEnum>|null  $options
     * @return array<string, string>|null
     */
    private static function normalizeOptions(array|string|null $options): ?array
    {
        if ($options === null) {
            return null;
        }

        if (is_string($options)) {
            if (! is_subclass_of($options, BackedEnum::class)) {
                throw new InvalidArgumentException("[{$options}] no es un enum respaldado.");
            }

            $normalized = [];

            foreach ($options::cases() as $case) {
                $normalized[(string) $case->value] = method_exists($case, 'label')
                    ? (string) $case->label()
                    : Str::headline($case->name);
            }

            return $normalized;
        }

        $normalized = [];

        foreach ($options as $value => $label) {
            if (array_is_list($options)) {
                $normalized[(string) $label] = (string) $label;
            } else {
                $normalized[(string) $value] = (string) $label;
            }
        }

        return $normalized;
    }
}
