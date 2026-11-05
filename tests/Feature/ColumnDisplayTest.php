<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\TableBuilder;
use InertiaDataTable\Tests\Fixtures\Models\Product;

function displayOf(Column $column): mixed
{
    return $column->toConfig()['display'];
}

it('has no display by default, so the filter variant decides', function () {
    expect(displayOf(Column::make('price')->range()))->toBeNull();
});

it('formats amounts in a currency', function () {
    expect(displayOf(Column::make('price')->money('CLP')))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP']])
        ->and(displayOf(Column::make('price')->money('USD', 2)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'USD', 'minimumFractionDigits' => 2, 'maximumFractionDigits' => 2]]);
});

it('adds up the number methods', function () {
    expect(displayOf(Column::make('price')->money('CLP')->decimals(0)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP', 'minimumFractionDigits' => 0, 'maximumFractionDigits' => 0]])
        ->and(displayOf(Column::make('ratio')->percent(1)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'percent', 'minimumFractionDigits' => 1, 'maximumFractionDigits' => 1]])
        ->and(displayOf(Column::make('views')->numberFormat(['notation' => 'compact'])))
        ->toBe(['type' => 'number', 'format' => ['notation' => 'compact']])
        ->and(displayOf(Column::make('views')->numberFormat([])))
        ->toBe(['type' => 'number']);
});

it('formats dates with a preset or Intl options', function () {
    expect(displayOf(Column::make('released_on')->dateFormat()))->toBe(['type' => 'date', 'format' => 'long'])
        ->and(displayOf(Column::make('created_at')->dateFormat('relative')))->toBe(['type' => 'date', 'format' => 'relative'])
        ->and(displayOf(Column::make('created_at')->dateFormat(['month' => 'short', 'year' => 'numeric'])))
        ->toBe(['type' => 'date', 'format' => ['month' => 'short', 'year' => 'numeric']]);
});

it('cuts texts and shows links', function () {
    expect(displayOf(Column::make('notes')->limit(60)))->toBe(['type' => 'text', 'limit' => 60])
        ->and(displayOf(Column::make('website')->url()->limit(30)))->toBe(['type' => 'text', 'link' => 'url', 'limit' => 30])
        ->and(displayOf(Column::make('email')->email()))->toBe(['type' => 'text', 'link' => 'email']);
});

it('labels booleans and shows options as badges', function () {
    expect(displayOf(Column::make('featured')->boolean()->booleanLabels('Sí', 'No')))
        ->toBe(['type' => 'boolean', 'labels' => ['true' => 'Sí', 'false' => 'No']])
        ->and(displayOf(Column::make('status')->multiSelect(['active' => 'Active'])->badge()))
        ->toBe(['type' => 'option', 'badge' => true]);
});

it('keeps the last display type and leaves the filter alone', function () {
    $column = Column::make('price')->range()->money('CLP')->limit(10);

    expect(displayOf($column))->toBe(['type' => 'text', 'limit' => 10])
        ->and($column->toConfig()['variant'])->toBe('range');
});

it('rejects invalid formats', function (Closure $build, string $message) {
    expect($build)->toThrow(InvalidArgumentException::class, $message);
})->with([
    'currency' => [fn () => Column::make('price')->money('pesos'), 'The currency [pesos] must be an ISO 4217 code'],
    'decimals' => [fn () => Column::make('price')->decimals(-1), 'The number of decimals cannot be negative.'],
    'date preset' => [fn () => Column::make('created_at')->dateFormat('full'), 'The date format [full] is not one of: short, medium, long, datetime, relative.'],
    'limit' => [fn () => Column::make('notes')->limit(0), 'The text limit must be at least 1 character.'],
]);

it('uses the configured currency and date format as defaults', function () {
    config()->set('inertia-datatable.currency', 'MXN');
    config()->set('inertia-datatable.date_format', 'short');

    expect(displayOf(Column::make('price')->money()))->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'MXN']])
        ->and(displayOf(Column::make('price')->money('EUR')))->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'EUR']])
        ->and(displayOf(Column::make('released_on')->dateFormat()))->toBe(['type' => 'date', 'format' => 'short']);
});

it('asks for a currency when there is no default', function () {
    Column::make('price')->money();
})->throws(InvalidArgumentException::class, 'Pass a currency to money() or set inertia-datatable.currency.');

it('resolves the locale from the table, the config or the app', function () {
    $resolve = fn (?TableBuilder $table = null): mixed => ($table ?? DataTable::for(Product::query())->columns([Column::make('name', 'Name')]))
        ->withRequest(Request::create('/'))
        ->toArray()['config']['locale'];

    app()->setLocale('es_MX');
    expect($resolve())->toBe('es-MX');

    config()->set('inertia-datatable.locale', 'en-GB');
    expect($resolve())->toBe('en-GB')
        ->and($resolve(DataTable::for(Product::query())->columns([Column::make('name', 'Name')])->locale('pt-BR')))->toBe('pt-BR')
        ->and($resolve(DataTable::for(Product::query())->columns([Column::make('name', 'Name')])->locale('browser')))->toBeNull();

    config()->set('inertia-datatable.locale', 'browser');
    expect($resolve())->toBeNull();
});

it('takes the locale of a table class', function () {
    $table = new class extends DataTable
    {
        public function query(): Builder
        {
            return Product::query();
        }

        public function columns(): array
        {
            return [Column::make('name', 'Name')];
        }

        public function locale(): ?string
        {
            return 'fr-CA';
        }
    };

    expect($table->withRequest(Request::create('/'))->toArray()['config']['locale'])->toBe('fr-CA');
});

it('rejects an unknown default date format', function () {
    config()->set('inertia-datatable.date_format', 'full');

    DataTable::for(Product::query())->columns([Column::make('name', 'Name')])->withRequest(Request::create('/'))->toArray();
})->throws(InvalidArgumentException::class, 'The inertia-datatable.date_format [full] is not one of: short, medium, long, datetime, relative.');

it('sends the display and the locale in the response config', function () {
    config()->set('inertia-datatable.locale', 'es-CL');

    $config = DataTable::for(Product::query())
        ->columns([Column::make('name', 'Name'), Column::make('price', 'Price')->money('CLP')])
        ->withRequest(Request::create('/'))
        ->toArray()['config'];

    expect($config['locale'])->toBe('es-CL')
        ->and($config['columns'][0]['display'])->toBeNull()
        ->and($config['columns'][1]['display'])->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP']]);
});
