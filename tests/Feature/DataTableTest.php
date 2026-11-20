<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;
use InertiaDataTable\Tests\Fixtures\Tables\ProductsTable;
use InertiaDataTable\Tests\Fixtures\Tables\ProductsWithUrlTable;

use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\getJson;

/**
 * Small catalog with a different value in each filterable column.
 */
function seedCatalog(): void
{
    $home = Category::factory()->create(['name' => 'Hogar']);
    $office = Category::factory()->create(['name' => 'Oficina']);

    Product::factory()->featured()->for($home)->create(['name' => 'Lámpara', 'price' => 30, 'stock' => 2, 'released_on' => '2026-01-10']);
    Product::factory()->draft()->withoutSku()->for($home)->create(['name' => 'Mesa', 'price' => 120, 'stock' => 0, 'released_on' => '2026-02-01']);
    Product::factory()->for($office)->create(['name' => 'Silla', 'price' => 45, 'stock' => 10, 'released_on' => '2026-01-20']);
    Product::factory()->archived()->create(['name' => 'Teclado', 'price' => 60, 'stock' => 4, 'released_on' => '2026-03-05']);
}

it('returns the first page and its pagination meta when no parameters are given', function () {
    Product::factory()->count(12)->create();

    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta', ['current_page' => 1, 'per_page' => 10, 'last_page' => 2, 'total' => 12, 'from' => 1, 'to' => 10]);
});

it('clamps a page beyond the last one to the last page', function () {
    Product::factory()->count(12)->create();

    $response = getJson('/products?page=99');

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('state.pagination', ['pageIndex' => 1, 'pageSize' => 10]);
});

it('uses the requested page size only when it is an allowed option', function (string $perPage, int $expected) {
    Product::factory()->count(25)->create();

    $response = getJson("/products?per_page={$perPage}");

    $response->assertOk()->assertJsonPath('meta.per_page', $expected);
})->with([
    'allowed option' => ['20', 20],
    'value outside the options' => ['1000', 10],
    'non numeric value' => ['all', 10],
]);

it('returns null from and to when no row matches', function () {
    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('meta', ['current_page' => 1, 'per_page' => 10, 'last_page' => 1, 'total' => 0, 'from' => null, 'to' => null]);
});

it('sorts by several columns in the requested priority', function () {
    Product::factory()->create(['name' => 'Bandeja', 'price' => 20]);
    Product::factory()->create(['name' => 'Atril', 'price' => 20]);
    Product::factory()->create(['name' => 'Cojín', 'price' => 90]);

    $response = getJson('/products?sort=-price,name');

    $response->assertOk()->assertJsonPath('data.*.name', ['Cojín', 'Atril', 'Bandeja']);
});

it('reports only the requested sort columns that are sortable', function () {
    Product::factory()->count(2)->create();

    $response = getJson('/products?sort=status,-price');

    $response->assertOk()->assertJsonPath('state.sorting', [['id' => 'price', 'desc' => true]]);
});

it('applies the default sort without reporting it as requested', function () {
    Product::factory()->create(['name' => 'Zócalo']);
    Product::factory()->create(['name' => 'Alfombra']);

    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('data.*.name', ['Alfombra', 'Zócalo'])
        ->assertJsonPath('state.sorting', [])
        ->assertJsonPath('config.default_sorting', [['id' => 'name', 'desc' => false]]);
});

it('adds the primary key as the last sort column so pages are stable', function () {
    Product::factory()->count(2)->create(['price' => 50]);
    DB::enableQueryLog();

    getJson('/products?sort=price')->assertOk();

    $rowsQuery = collect(DB::getQueryLog())->pluck('query')->first(fn (string $sql) => str_contains($sql, 'limit'));
    expect($rowsQuery)->toEndWith(orderByPriceAndId('asc'));
});

it('breaks ties with the primary key in the direction of the first sort column', function () {
    $first = Product::factory()->create(['price' => 50]);
    $second = Product::factory()->create(['price' => 50]);
    DB::enableQueryLog();

    $response = getJson('/products?sort=-price')->assertOk();

    $rowsQuery = collect(DB::getQueryLog())->pluck('query')->first(fn (string $sql) => str_contains($sql, 'limit'));
    expect($rowsQuery)->toEndWith(orderByPriceAndId('desc'))
        ->and(array_column($response->json('data'), 'id'))->toBe([$second->id, $first->id]);
});

it('sorts by the value of a belongs-to relation', function () {
    seedCatalog();

    // Without Teclado, which has no category: each engine places NULL its own way.
    $response = getJson('/products?sort=-category&filter[category]=not.is.empty');

    // Lámpara and Mesa tie on Hogar: the id tiebreaker follows the sort direction.
    $response->assertOk()->assertJsonPath('data.*.name', ['Silla', 'Mesa', 'Lámpara']);
});

it('filters rows with each variant and operator', function (string $query, array $expected) {
    seedCatalog();

    $response = getJson("/products?{$query}");

    $response->assertOk()->assertJsonPath('data.*.name', $expected);
})->with([
    'number greater than' => ['filter[stock]=gt.3', ['Silla', 'Teclado']],
    'number less than or equal' => ['filter[stock]=lte.2', ['Lámpara', 'Mesa']],
    'number not equal' => ['filter[stock]=neq.0', ['Lámpara', 'Silla', 'Teclado']],
    'range with both bounds' => ['filter[price]=40,100', ['Silla', 'Teclado']],
    'range with an open upper bound' => ['filter[price]=100,', ['Mesa']],
    'two filters on one column' => ['filter[price][]=gte.40&filter[price][]=lte.50', ['Silla']],
    'text contains ignoring case' => ['filter[name]=SIL', ['Silla']],
    'text does not contain' => ['filter[name]=not.ilike.e', ['Lámpara', 'Silla']],
    'text equals ignoring case' => ['filter[name]=eq.mesa', ['Mesa']],
    'text negation includes rows without value' => ['filter[sku]=not.ilike.SKU', ['Mesa']],
    'text is empty' => ['filter[sku]=is.empty', ['Mesa']],
    'text is not empty' => ['filter[sku]=not.is.empty', ['Lámpara', 'Silla', 'Teclado']],
    'boolean true' => ['filter[featured]=true', ['Lámpara']],
    'boolean false' => ['filter[featured]=false', ['Mesa', 'Silla', 'Teclado']],
    'date before' => ['filter[released_on]=lt.2026-01-20', ['Lámpara']],
    'date equals the whole day' => ['filter[released_on]=2026-02-01', ['Mesa']],
    'date between inclusive' => ['filter[released_on]=between.2026-01-10,2026-01-20', ['Lámpara', 'Silla']],
    'multi-select any of' => ['filter[status]=active,draft', ['Lámpara', 'Mesa', 'Silla']],
    'multi-select none of' => ['filter[status]=not.in.active', ['Mesa', 'Teclado']],
    'relation value' => ['filter[category]=Hogar', ['Lámpara', 'Mesa']],
    'relation none of includes rows without relation' => ['filter[category]=not.in.Hogar', ['Silla', 'Teclado']],
    'relation is empty' => ['filter[category]=is.empty', ['Teclado']],
    'relation value or empty' => ['filter[category][]=Oficina&filter[category][]=is.empty', ['Silla', 'Teclado']],
    'text value or empty' => ['filter[sku][]=ilike.zzz&filter[sku][]=is.empty', ['Mesa']],
    'range or empty keeps the range' => ['filter[price][]=40,50&filter[price][]=is.empty', ['Silla']],
    'filters of a column and empty' => ['filter[category][]=not.in.Oficina&filter[category][]=neq.Hogar&filter[category][]=is.empty', ['Teclado']],
    'boolean is not empty' => ['filter[featured]=not.is.empty', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
    'filters on several columns' => ['filter[status]=active&filter[category]=Oficina', ['Silla']],
    'value that does not fit the variant' => ['filter[stock]=abc', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
    'unknown column' => ['filter[unknown]=x', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
]);

it('combines the filters with OR when join is or', function (string $query, array $expected) {
    seedCatalog();

    $response = getJson("/products?{$query}");

    $response->assertOk()->assertJsonPath('data.*.name', $expected);
})->with([
    'two columns' => ['filter[status]=draft&filter[category]=Oficina&join=or', ['Mesa', 'Silla']],
    'two filters on one column' => ['filter[price][]=lte.30&filter[price][]=gte.100&join=or', ['Lámpara', 'Mesa']],
    'text is empty' => ['filter[sku]=is.empty&filter[stock]=gt.5&join=or', ['Mesa', 'Silla']],
    'relation negation' => ['filter[category]=not.in.Hogar&filter[featured]=true&join=or', ['Lámpara', 'Silla', 'Teclado']],
    'relation is empty' => ['filter[category]=is.empty&filter[name]=eq.mesa&join=or', ['Mesa', 'Teclado']],
    'text negation' => ['filter[name]=not.ilike.a&filter[stock]=eq.0&join=or', ['Mesa']],
    'date between' => ['filter[released_on]=between.2026-01-01,2026-01-15&filter[price]=gte.100&join=or', ['Lámpara', 'Mesa']],
    'one filter' => ['filter[stock]=gt.3&join=or', ['Silla', 'Teclado']],
    'unknown column' => ['filter[unknown]=x&filter[status]=draft&join=or', ['Mesa']],
    'search is still combined with AND' => ['filter[status]=draft&filter[category]=Oficina&join=or&search=silla', ['Silla']],
    'case-insensitive value' => ['filter[status]=draft&filter[category]=Oficina&join=OR', ['Mesa', 'Silla']],
    'any other value is and' => ['filter[status]=draft&filter[category]=Hogar&join=xor', ['Mesa']],
]);

it('reflects the join in the state', function (string $query, string $join) {
    $response = getJson("/products?{$query}");

    $response->assertOk()->assertJsonPath('state.join', $join);
})->with([
    'default' => ['', 'and'],
    'or' => ['join=or', 'or'],
    'unknown value' => ['join=nope', 'and'],
]);

it('requires every search word to match a searchable column, including relations', function () {
    seedCatalog();

    $response = getJson('/products?search=sil%20ofi');

    $response->assertOk()
        ->assertJsonPath('data.*.name', ['Silla'])
        ->assertJsonPath('state.globalFilter', 'sil ofi');
});

it('matches LIKE wildcards in the search literally', function () {
    Product::factory()->create(['name' => 'Cupón 50% off']);
    Product::factory()->create(['name' => 'Bolsa 500 g']);
    Product::factory()->create(['name' => 'Caja a_b']);
    Product::factory()->create(['name' => 'Caja axb']);

    $percent = getJson('/products?search='.rawurlencode('50%'));
    $underscore = getJson('/products?search='.rawurlencode('a_b'));

    $percent->assertOk()->assertJsonPath('data.*.name', ['Cupón 50% off']);
    $underscore->assertOk()->assertJsonPath('data.*.name', ['Caja a_b']);
});

it('ignores injection attempts in sort columns and filter keys', function () {
    Product::factory()->count(2)->create();

    $response = getJson('/products?'.http_build_query([
        'sort' => 'name; DROP TABLE products',
        'filter' => ['name) OR 1=1 --' => 'x'],
    ]));

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('state.sorting', [])
        ->assertJsonPath('state.columnFilters', []);
    assertDatabaseCount('products', 2);
});

it('counts facet options with every filter except the facet own one', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=active&filter[category]=Hogar');

    $response->assertOk()
        ->assertJsonPath('facets.status', [
            ['value' => 'active', 'label' => 'Activo', 'count' => 1],
            ['value' => 'draft', 'label' => 'Borrador', 'count' => 1],
            ['value' => 'archived', 'label' => 'Archivado', 'count' => 0],
        ])
        ->assertJsonPath('facets.category', [
            ['value' => 'Hogar', 'label' => 'Hogar', 'count' => 1],
            ['value' => 'Oficina', 'label' => 'Oficina', 'count' => 1],
        ]);
});

it('counts facet options with the search only when join is or', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=active&filter[category]=Hogar&join=or&search=a');

    // Every product has an "a" but Teclado's category is empty, so it is not a Hogar/Oficina option.
    $response->assertOk()
        ->assertJsonPath('facets.status', [
            ['value' => 'active', 'label' => 'Activo', 'count' => 2],
            ['value' => 'draft', 'label' => 'Borrador', 'count' => 1],
            ['value' => 'archived', 'label' => 'Archivado', 'count' => 1],
        ])
        ->assertJsonPath('facets.category', [
            ['value' => 'Hogar', 'label' => 'Hogar', 'count' => 2],
            ['value' => 'Oficina', 'label' => 'Oficina', 'count' => 1],
        ]);
});

it('keeps a selected option that no longer has rows with a zero count', function () {
    seedCatalog();

    $response = getJson('/products?filter[category]=Jardín');

    $response->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('facets.category.2', ['value' => 'Jardín', 'label' => 'Jardín', 'count' => 0]);
});

it('returns the bounds of range columns from the unfiltered query', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=draft');

    $response->assertOk()->assertJsonPath('facets.price', ['min' => 30, 'max' => 120]);
});

it('leaves out a range bound that is not a finite number', function () {
    seedCatalog();
    // SQLite stores an overflowing numeric literal as Infinity, even in an integer column.
    Product::factory()->create(['name' => 'Infinito', 'price' => '1e400']);

    $response = getJson('/products?filter[price]=0,100');

    $response->assertOk()->assertJsonPath('facets.price', ['min' => 30, 'max' => null]);
})->skip(fn (): bool => DB::connection()->getDriverName() !== 'sqlite', 'Only SQLite stores an overflowing number as Infinity.');

it('sends the labels of option columns without a filter, without counting', function () {
    $facets = DataTable::for(Product::query())
        ->columns([
            Column::option('status')->options(['active' => 'Activo', 'draft' => 'Borrador']),
            Column::option('category')->from('category.name'),
        ])
        ->withRequest(Request::create('/'))
        ->toArray()['facets'];

    expect($facets)->toBe(['status' => [
        ['value' => 'active', 'label' => 'Activo'],
        ['value' => 'draft', 'label' => 'Borrador'],
    ]]);
});

it('counts the rows without a value last, named by whenEmpty() or the UI text', function () {
    seedCatalog();
    app()->setLocale('es');

    $facets = DataTable::for(Product::query())
        ->columns([
            Column::option('category')->from('category.name')->whenEmpty('Sin categoría')->filterMultiSelect(empty: true),
            Column::option('sku')->filterSelect(counts: false, empty: true),
        ])
        ->withRequest(Request::create('/?filter[category]=Oficina'))
        ->toArray()['facets'];

    expect($facets['category'])->toBe([
        ['value' => 'Hogar', 'label' => 'Hogar', 'count' => 2],
        ['value' => 'Oficina', 'label' => 'Oficina', 'count' => 1],
        ['value' => null, 'label' => 'Sin categoría', 'count' => 1],
    ])->and(end($facets['sku']))->toBe(['value' => null, 'label' => 'Sin valor']);
});

it('includes only visible columns, the primary key and non hideable columns in each row', function () {
    seedCatalog();

    $response = getJson('/products?columns=price,category&per_page=10');

    $response->assertOk()
        ->assertJsonPath('data.0', ['id' => productId('Lámpara'), 'name' => 'Lámpara', 'price' => 30, 'category' => 'Hogar'])
        ->assertJsonPath('state.columnVisibility', [
            'name' => true, 'sku' => false, 'price' => true, 'stock' => false,
            'status' => false, 'category' => true, 'featured' => false, 'released_on' => false,
        ]);
});

it('shows the default visible columns when no columns are requested', function () {
    seedCatalog();

    $response = getJson('/products');

    $response->assertOk()->assertJsonPath('data.0', [
        'id' => productId('Lámpara'), 'name' => 'Lámpara', 'price' => 30, 'stock' => 2,
        'status' => 'active', 'category' => 'Hogar', 'featured' => true,
    ]);
});

it('filters dates relative to today', function (string $query, array $expected) {
    seedCatalog();
    $this->travelTo(CarbonImmutable::parse('2026-01-21 12:00', 'UTC'));

    getJson("/products?{$query}")->assertOk()->assertJsonPath('data.*.name', $expected);
})->with([
    'yesterday' => ['filter[released_on]=rel.yesterday', ['Silla']],
    'last 12 days, today included' => ['filter[released_on]=rel.-12d', ['Lámpara', 'Silla']],
    'last 11 days' => ['filter[released_on]=rel.-11d', ['Silla']],
    'this month' => ['filter[released_on]=rel.this-month', ['Lámpara', 'Silla']],
    'next month' => ['filter[released_on]=rel.next-month', ['Mesa']],
    'this quarter' => ['filter[released_on]=rel.this-quarter', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
    'with join or' => ['filter[released_on]=rel.yesterday&filter[price]=gte.100&join=or', ['Mesa', 'Silla']],
    'with other filters of the column' => ['filter[released_on][]=rel.this-month&filter[released_on][]=gt.2026-01-15', ['Silla']],
    'invalid token drops the filter' => ['filter[released_on]=rel.soon', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
    'without a token' => ['filter[released_on]=rel', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
]);

it('echoes a relative date filter with the days it resolved to', function () {
    seedCatalog();
    $this->travelTo(CarbonImmutable::parse('2026-01-21 12:00', 'UTC'));

    getJson('/products?filter[released_on]=rel.-07D')->assertOk()->assertJsonPath('state.columnFilters', [
        ['id' => 'released_on', 'filterId' => 'released_on-0', 'variant' => 'date', 'operator' => 'isRelativeToToday', 'value' => '-7d', 'range' => ['2026-01-15', '2026-01-21']],
    ]);
});

it('takes today in the configured time zone', function (?string $timezone, array $expected) {
    seedCatalog();
    config(['inertia-datatable.timezone' => $timezone]);
    // 23:00 of January 20 in Santiago (UTC-3).
    $this->travelTo(CarbonImmutable::parse('2026-01-21 02:00', 'UTC'));

    getJson('/products?filter[released_on]=rel.today')->assertOk()->assertJsonPath('data.*.name', $expected);
})->with([
    'app time zone (UTC)' => [null, []],
    'America/Santiago' => ['America/Santiago', ['Silla']],
]);

it('echoes the applied filters in the ColumnFilterItem shape', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=active&filter[price][]=gte.10&filter[price][]=lte.50');

    $response->assertOk()->assertJsonPath('state.columnFilters', [
        ['id' => 'status', 'filterId' => 'status-0', 'variant' => 'multi-select', 'operator' => 'inArray', 'value' => ['active']],
        ['id' => 'price', 'filterId' => 'price-0', 'variant' => 'range', 'operator' => 'gte', 'value' => '10'],
        ['id' => 'price', 'filterId' => 'price-1', 'variant' => 'range', 'operator' => 'lte', 'value' => '50'],
    ]);
});

it('gives the config of the response without running any query', function () {
    seedCatalog();
    config()->set('inertia-datatable.validate_columns', true);
    $table = ProductsTable::make()->withRequest(Request::create('/', 'GET', ['filter' => ['status' => 'draft']]));
    $expected = $table->toArray()['config'];

    DB::flushQueryLog();
    DB::enableQueryLog();
    $config = $table->config();
    $queries = DB::getQueryLog();
    DB::disableQueryLog();

    expect($config)->toBe($expected)
        ->and($queries)->toBe([]);
});

it('gives the config of a quick table with its prefixed query keys', function () {
    $table = DataTable::for(Product::query())
        ->name('products')
        ->columns([Column::text('name')->searchable()])
        ->perPage(25);

    expect($table->config())
        ->toMatchArray(['searchable' => true, 'per_page' => 25])
        ->and($table->config()['query'])->toMatchArray(['page' => 'products_page', 'search' => 'products_search'])
        ->and($table->config())->toBe($table->withRequest(Request::create('/'))->toArray()['config']);
});

it('describes columns, options and query parameters in config', function () {
    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('config.columns.0', [
            'id' => 'name', 'label' => 'Nombre', 'sortable' => true, 'hideable' => false, 'visible' => true,
            'display' => ['type' => 'text'], 'filter' => ['variant' => 'text', 'placeholder' => 'Buscar nombre…'],
        ])
        ->assertJsonPath('config.columns.2.display', ['type' => 'number', 'unit' => '$'])
        ->assertJsonPath('config.columns.2.filter', ['variant' => 'range'])
        ->assertJsonPath('config.locale', 'en')
        ->assertJsonPath('config.date_format', 'long')
        ->assertJsonPath('config.searchable', true)
        ->assertJsonPath('config.per_page', 10)
        ->assertJsonPath('config.per_page_options', [10, 20, 30, 50])
        ->assertJsonPath('config.query', [
            'page' => 'page', 'per_page' => 'per_page', 'sort' => 'sort',
            'filter' => 'filter', 'search' => 'search', 'columns' => 'columns', 'join' => 'join',
        ])
        ->assertJsonPath('config.max_sorts', 3)
        ->assertJsonPath('config.max_filters', 20);
});

it('limits the rows to the parent model passed to make', function () {
    $home = Category::factory()->create();
    Product::factory()->for($home)->create(['name' => 'Lámpara']);
    Product::factory()->for(Category::factory())->create(['name' => 'Silla']);

    $response = getJson("/categories/{$home->id}/products");

    $response->assertOk()->assertJsonPath('data.*.name', ['Lámpara']);
});

it('shapes each row with the transform method and removes hidden column keys', function () {
    Route::get('/products-with-url', fn () => ProductsWithUrlTable::make());
    $product = Product::factory()->create(['name' => 'Lámpara']);

    $response = getJson('/products-with-url');

    // The relation column the transformer leaves out is resolved as without transform().
    $response->assertOk()->assertJsonPath('data.0', ['id' => $product->id, 'name' => 'Lámpara', 'url' => "/products/{$product->id}", 'category' => null]);
});

/**
 * End of the rows query with the quoting of the current connection (SQLite, MySQL or Postgres).
 */
function orderByPriceAndId(string $direction): string
{
    $grammar = DB::connection()->getQueryGrammar();
    // Postgres is told where the rows without a value go, to sort like the rest.
    $nulls = DB::connection()->getDriverName() === 'pgsql' ? ($direction === 'desc' ? ' nulls last' : ' nulls first') : '';

    return "order by {$grammar->wrap('products.price')} {$direction}{$nulls}, {$grammar->wrap('products.id')} {$direction} limit 10 offset 0";
}

/**
 * Real id of the product: Postgres sequences do not go back between tests.
 */
function productId(string $name): int
{
    return (int) Product::query()->where('name', $name)->value('id');
}

it('resolves the relation columns of a transformed row', function () {
    seedCatalog();

    $rows = DataTable::for(Product::query()->orderBy('name'))
        ->columns([
            Column::text('name'),
            Column::option('category')->from('category.name'),
        ])
        ->transform(fn (Product $product): array => [...$product->toArray(), 'url' => "/products/{$product->id}"])
        ->withRequest(Request::create('/'))
        ->toArray()['data'];

    expect(array_map(fn (array $row): array => [$row['name'], $row['category'], $row['url']], $rows))->toBe([
        ['Lámpara', 'Hogar', '/products/'.productId('Lámpara')],
        ['Mesa', 'Hogar', '/products/'.productId('Mesa')],
        ['Silla', 'Oficina', '/products/'.productId('Silla')],
        ['Teclado', null, '/products/'.productId('Teclado')],
    ]);
});

it('keeps the value a transformer gives to a relation column', function () {
    seedCatalog();

    $rows = DataTable::for(Product::query()->orderBy('name'))
        ->columns([Column::option('category')->from('category.name')])
        ->transform(fn (Product $product): array => ['category' => strtoupper((string) $product->category?->name)])
        ->withRequest(Request::create('/'))
        ->toArray()['data'];

    expect(array_column($rows, 'category'))->toBe(['HOGAR', 'HOGAR', 'OFICINA', '']);
});
