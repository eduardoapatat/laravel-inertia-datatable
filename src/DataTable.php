<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use InertiaDataTable\Concerns\ResolvesDataTable;
use JsonSerializable;
use ReflectionMethod;

/**
 * Table defined as a class (one per model or screen):
 *
 *     class ProductsTable extends DataTable
 *     {
 *         public function query(): Builder { return Product::query(); }
 *         public function columns(): array { return [Column::text('name')->sortable()]; }
 *     }
 *
 *     Inertia::render('products/index', ['products' => fn () => ProductsTable::make()]);
 *
 * @implements Arrayable<string, mixed>
 */
abstract class DataTable implements Arrayable, JsonSerializable, Responsable
{
    use ResolvesDataTable;

    /**
     * Creates the table from the container: the constructor supports dependency injection
     * and named arguments, for example `UserProductsTable::make(user: $user)`.
     */
    public static function make(mixed ...$parameters): static
    {
        return app(static::class, $parameters);
    }

    /**
     * Quick form, without a class: `DataTable::for(User::query())->columns([...])`.
     *
     * @param  Builder<covariant Model>|Relation<covariant Model, covariant Model, mixed>  $query
     */
    public static function for(Builder|Relation $query): TableBuilder
    {
        return new TableBuilder($query);
    }

    /**
     * @return Builder<covariant Model>|Relation<covariant Model, covariant Model, mixed>
     */
    abstract public function query(): Builder|Relation;

    /**
     * @return list<Column>
     */
    abstract public function columns(): array;

    /**
     * Default sort with the contract syntax: `-created_at,name`.
     */
    public function defaultSort(): ?string
    {
        return null;
    }

    public function perPage(): int
    {
        return (int) config('inertia-datatable.per_page', 10);
    }

    /**
     * @return list<int>
     */
    public function perPageOptions(): array
    {
        /** @var list<int> */
        return config('inertia-datatable.per_page_options', [10, 20, 30, 50]);
    }

    /**
     * Name of the table; prefixes its parameters when a page has several tables.
     */
    public function name(): ?string
    {
        return null;
    }

    /**
     * Locale to format numbers and dates of this table (`'en-US'`, `'browser'`);
     * null uses `inertia-datatable.locale` or the app locale.
     */
    public function locale(): ?string
    {
        return null;
    }

    /**
     * Keys included in every row even when they are not visible columns.
     *
     * @return list<string>|null
     */
    public function alwaysInclude(): ?array
    {
        return null;
    }

    /**
     * Override it to shape each row; the keys of hidden columns are removed afterwards.
     *
     * @return array<string, mixed>
     */
    public function transform(Model $model): array
    {
        return $model->toArray();
    }

    public function toDefinition(): TableDefinition
    {
        $overridesTransform = (new ReflectionMethod($this, 'transform'))->getDeclaringClass()->getName() !== self::class;

        return new TableDefinition(
            query: $this->query(),
            columns: $this->columns(),
            defaultSort: $this->defaultSort(),
            perPage: $this->perPage(),
            perPageOptions: $this->perPageOptions(),
            name: $this->name(),
            alwaysInclude: $this->alwaysInclude(),
            transformer: $overridesTransform ? $this->transform(...) : null,
            locale: $this->locale(),
        );
    }
}
