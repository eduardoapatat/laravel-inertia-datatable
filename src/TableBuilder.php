<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Closure;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use InertiaDataTable\Concerns\ResolvesDataTable;
use JsonSerializable;

/**
 * Forma rápida de declarar una tabla: `DataTable::for(User::query())->columns([...])`.
 *
 * @implements Arrayable<string, mixed>
 */
final class TableBuilder implements Arrayable, JsonSerializable, Responsable
{
    use ResolvesDataTable;

    /** @var list<Column> */
    private array $columns = [];

    private ?string $defaultSort = null;

    private ?int $perPage = null;

    /** @var list<int>|null */
    private ?array $perPageOptions = null;

    private ?string $name = null;

    /** @var list<string>|null */
    private ?array $alwaysInclude = null;

    /** @var (Closure(Model): array<string, mixed>)|null */
    private ?Closure $transformer = null;

    /**
     * @param  Builder<covariant Model>|Relation<covariant Model, covariant Model, mixed>  $query
     */
    public function __construct(private readonly Builder|Relation $query) {}

    /**
     * @param  list<Column>  $columns
     */
    public function columns(array $columns): self
    {
        $this->columns = $columns;

        return $this;
    }

    public function defaultSort(string $sort): self
    {
        $this->defaultSort = $sort;

        return $this;
    }

    public function perPage(int $perPage): self
    {
        $this->perPage = $perPage;

        return $this;
    }

    /**
     * @param  list<int>  $options
     */
    public function perPageOptions(array $options): self
    {
        $this->perPageOptions = $options;

        return $this;
    }

    public function name(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    /**
     * @param  list<string>  $keys
     */
    public function alwaysInclude(array $keys): self
    {
        $this->alwaysInclude = $keys;

        return $this;
    }

    /**
     * @param  Closure(Model): array<string, mixed>  $transformer
     */
    public function transform(Closure $transformer): self
    {
        $this->transformer = $transformer;

        return $this;
    }

    public function toDefinition(): TableDefinition
    {
        /** @var list<int> $defaultOptions */
        $defaultOptions = config('inertia-datatable.per_page_options', [10, 20, 30, 50]);

        return new TableDefinition(
            query: $this->query,
            columns: $this->columns,
            defaultSort: $this->defaultSort,
            perPage: $this->perPage ?? (int) config('inertia-datatable.per_page', 10),
            perPageOptions: $this->perPageOptions ?? $defaultOptions,
            name: $this->name,
            alwaysInclude: $this->alwaysInclude,
            transformer: $this->transformer,
        );
    }
}
