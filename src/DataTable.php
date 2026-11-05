<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable;

use EduardoApatat\InertiaDataTable\Concerns\ResolvesDataTable;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use JsonSerializable;
use ReflectionMethod;

/**
 * Tabla definida como clase (una por modelo o pantalla):
 *
 *     class ProductsTable extends DataTable
 *     {
 *         public function query(): Builder { return Product::query(); }
 *         public function columns(): array { return [Column::make('name')->sortable()]; }
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
     * Crea la tabla desde el contenedor: el constructor admite inyección de dependencias
     * y argumentos por nombre, por ejemplo `UserProductsTable::make(user: $user)`.
     */
    public static function make(mixed ...$parameters): static
    {
        return app(static::class, $parameters);
    }

    /**
     * Forma rápida, sin clase: `DataTable::for(User::query())->columns([...])`.
     *
     * @param  Builder<Model>|Relation<Model, Model, mixed>  $query
     */
    public static function for(Builder|Relation $query): TableBuilder
    {
        return new TableBuilder($query);
    }

    /**
     * @return Builder<Model>|Relation<Model, Model, mixed>
     */
    abstract public function query(): Builder|Relation;

    /**
     * @return list<Column>
     */
    abstract public function columns(): array;

    /**
     * Orden por defecto con la sintaxis del contrato: `-created_at,name`.
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
     * Nombre de la tabla; prefija sus parámetros cuando hay varias en una página.
     */
    public function name(): ?string
    {
        return null;
    }

    /**
     * Claves que se incluyen en cada fila aunque no sean columnas visibles.
     *
     * @return list<string>|null
     */
    public function alwaysInclude(): ?array
    {
        return null;
    }

    /**
     * Sobrescríbelo para dar forma a cada fila; las claves de columnas ocultas se quitan después.
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
        );
    }
}
