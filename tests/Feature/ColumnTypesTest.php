<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use InertiaDataTable\Column;
use InertiaDataTable\Columns\BooleanColumn;
use InertiaDataTable\Columns\DateColumn;
use InertiaDataTable\Columns\NumberColumn;
use InertiaDataTable\Columns\OptionColumn;
use InertiaDataTable\Columns\TextColumn;
use InertiaDataTable\DataTable;
use InertiaDataTable\TableBuilder;
use InertiaDataTable\Tests\Fixtures\Enums\BlankVariant;
use InertiaDataTable\Tests\Fixtures\Enums\OrderStage;
use InertiaDataTable\Tests\Fixtures\Enums\ProductStatus;
use InertiaDataTable\Tests\Fixtures\Models\Product;

function displayOf(Column $column): mixed
{
    return $column->toConfig()['display'];
}

function filterOf(Column $column): mixed
{
    return $column->toConfig()['filter'];
}

it('builds every type of column with its factory', function () {
    expect(Column::text('name'))->toBeInstanceOf(TextColumn::class)
        ->and(Column::number('price'))->toBeInstanceOf(NumberColumn::class)
        ->and(Column::date('created_at'))->toBeInstanceOf(DateColumn::class)
        ->and(Column::boolean('featured'))->toBeInstanceOf(BooleanColumn::class)
        ->and(Column::option('status'))->toBeInstanceOf(OptionColumn::class)
        ->and(Column::number('unit_price')->label())->toBe('Unit Price');
});

it('sends the type of the column as its display', function () {
    expect(displayOf(Column::text('name')))->toBe(['type' => 'text'])
        ->and(displayOf(Column::number('price')))->toBe(['type' => 'number'])
        ->and(displayOf(Column::date('created_at')))->toBe(['type' => 'date'])
        ->and(displayOf(Column::boolean('featured')))->toBe(['type' => 'boolean'])
        ->and(displayOf(Column::option('status')))->toBe(['type' => 'option']);
});

it('sends the filter with only its own keys', function () {
    expect(filterOf(Column::text('name')))->toBeNull()
        ->and(filterOf(Column::text('name')->filterInput()))->toBe(['variant' => 'text'])
        ->and(filterOf(Column::text('name')->filterInput('Search name…')))->toBe(['variant' => 'text', 'placeholder' => 'Search name…'])
        ->and(filterOf(Column::number('stock')->filterInput()))->toBe(['variant' => 'number'])
        ->and(filterOf(Column::number('price')->filterRange(0, 100)))->toBe(['variant' => 'range'])
        ->and(filterOf(Column::date('created_at')->filterDate()))->toBe(['variant' => 'date'])
        ->and(filterOf(Column::date('created_at')->filterRange()))->toBe(['variant' => 'date-range'])
        ->and(filterOf(Column::boolean('featured')->filterSelect()))->toBe(['variant' => 'boolean'])
        ->and(filterOf(Column::option('status')->filterSelect()))->toBe(['variant' => 'select'])
        ->and(filterOf(Column::option('status')->filterMultiSelect()))->toBe(['variant' => 'multi-select']);
});

it('has one filter per column', function () {
    Column::number('price')->filterInput()->filterRange();
})->throws(LogicException::class, 'The column [price] already has a number filter.');

it('formats amounts in a currency', function () {
    expect(displayOf(Column::number('price')->money('CLP')))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP']])
        ->and(displayOf(Column::number('price')->money('USD', 2)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'USD', 'minimumFractionDigits' => 2, 'maximumFractionDigits' => 2]]);
});

it('adds up the number methods', function () {
    expect(displayOf(Column::number('price')->money('CLP')->decimals(0)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP', 'minimumFractionDigits' => 0, 'maximumFractionDigits' => 0]])
        ->and(displayOf(Column::number('ratio')->percent(1)))
        ->toBe(['type' => 'number', 'format' => ['style' => 'percent', 'minimumFractionDigits' => 1, 'maximumFractionDigits' => 1]])
        ->and(displayOf(Column::number('views')->format(['notation' => 'compact'])))
        ->toBe(['type' => 'number', 'format' => ['notation' => 'compact']])
        ->and(displayOf(Column::number('views')->format([])))
        ->toBe(['type' => 'number']);
});

it('shows the unit of plain numbers', function () {
    expect(displayOf(Column::number('weight')->unit('kg')->decimals(1)))
        ->toBe(['type' => 'number', 'format' => ['minimumFractionDigits' => 1, 'maximumFractionDigits' => 1], 'unit' => 'kg']);
});

it('rejects a unit next to a currency or a percentage', function (Closure $build) {
    expect($build)->toThrow(InvalidArgumentException::class, 'The column [price] has a unit and a currency or percent format: use one of them.');
})->with([
    'unit, then money' => [fn () => Column::number('price')->unit('CLP')->money('CLP')],
    'money, then unit' => [fn () => Column::number('price')->money('CLP')->unit('CLP')],
    'percent' => [fn () => Column::number('price')->percent()->unit('%')],
]);

it('formats dates with a preset or Intl options', function () {
    expect(displayOf(Column::date('created_at')->format('relative')))->toBe(['type' => 'date', 'format' => 'relative'])
        ->and(displayOf(Column::date('created_at')->format(['month' => 'short', 'year' => 'numeric'])))
        ->toBe(['type' => 'date', 'format' => ['month' => 'short', 'year' => 'numeric']])
        ->and(displayOf(Column::date('created_at')->format([])))->toBe(['type' => 'date']);
});

it('cuts texts and shows links', function () {
    expect(displayOf(Column::text('notes')->limit(60)))->toBe(['type' => 'text', 'limit' => 60])
        ->and(displayOf(Column::text('website')->url()->limit(30)))->toBe(['type' => 'text', 'limit' => 30, 'link' => 'url'])
        ->and(displayOf(Column::text('email')->email()))->toBe(['type' => 'text', 'link' => 'email']);
});

it('labels booleans and shows them as badges, in any order', function () {
    $expected = ['type' => 'boolean', 'labels' => ['true' => 'Yes', 'false' => 'No'], 'badge' => true, 'variant' => 'secondary', 'variants' => ['true' => 'default', 'false' => 'destructive']];

    expect(displayOf(Column::boolean('featured')->labels('Yes', 'No')->badge('secondary', ['true' => 'default', 'false' => 'destructive'])))
        ->toBe($expected)
        ->and(displayOf(Column::boolean('featured')->badge('secondary', [1 => 'default', 0 => 'destructive'])->labels('Yes', 'No')))
        ->toBe($expected);
});

it('picks the badge variant of the column and of some options', function () {
    expect(displayOf(Column::option('status')->badge()))
        ->toBe(['type' => 'option', 'badge' => true, 'variant' => 'outline'])
        ->and(displayOf(Column::option('status')->badge('secondary', ['archived' => 'destructive', 1 => 'success'])))
        ->toBe(['type' => 'option', 'badge' => true, 'variant' => 'secondary', 'variants' => ['archived' => 'destructive', '1' => 'success']])
        ->and(displayOf(Column::option('status')->badge(false)))
        ->toBe(['type' => 'option', 'badge' => false]);
});

it('takes the options from a list, a map or a backed enum', function () {
    expect(Column::option('size')->options(['S', 'M'])->optionLabels())->toBe(['S' => 'S', 'M' => 'M'])
        ->and(Column::option('size')->options(['s' => 'Small', 1 => 'One'])->optionLabels())->toBe(['s' => 'Small', '1' => 'One'])
        ->and(Column::option('status')->options(ProductStatus::class)->optionLabels())->toHaveKeys(array_map(fn (ProductStatus $case): string => $case->value, ProductStatus::cases()));
});

it('rejects invalid definitions', function (Closure $build, string $message) {
    expect($build)->toThrow(InvalidArgumentException::class, $message);
})->with([
    'column id' => [fn () => Column::text('first-name'), 'The column id [first-name] may only contain letters, numbers and underscores.'],
    'currency' => [fn () => Column::number('price')->money('pesos'), 'The currency [pesos] must be an ISO 4217 code'],
    'decimals' => [fn () => Column::number('price')->decimals(-1), 'The number of decimals cannot be negative.'],
    'unit' => [fn () => Column::number('weight')->unit(' '), 'The unit cannot be empty.'],
    'range' => [fn () => Column::number('price')->filterRange(10, 1), 'The range of the column [price] starts after it ends.'],
    'date preset' => [fn () => Column::date('created_at')->format('full'), 'The date format [full] is not one of: short, medium, long, datetime, relative.'],
    'limit' => [fn () => Column::text('notes')->limit(0), 'The text limit must be at least 1 character.'],
    'badge variant' => [fn () => Column::option('status')->badge(' '), 'A badge variant must be a non-empty string'],
    'badge value variant' => [fn () => Column::option('status')->badge('outline', ['archived' => '']), 'A badge variant must be a non-empty string'],
    'enum' => [fn () => Column::option('status')->options(Product::class), 'is not a backed enum.'],
]);

it('uses the configured currency as default', function () {
    config()->set('inertia-datatable.currency', 'MXN');

    expect(displayOf(Column::number('price')->money()))->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'MXN']])
        ->and(displayOf(Column::number('price')->money('EUR')))->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'EUR']]);
});

it('asks for a currency when there is no default', function () {
    Column::number('price')->money();
})->throws(InvalidArgumentException::class, 'Pass a currency to money() or set inertia-datatable.currency.');

it('resolves the locale from the table, the config or the app', function () {
    $resolve = fn (?TableBuilder $table = null): mixed => ($table ?? DataTable::for(Product::query())->columns([Column::text('name', 'Name')]))
        ->withRequest(Request::create('/'))
        ->toArray()['config']['locale'];

    app()->setLocale('es_MX');
    expect($resolve())->toBe('es-MX');

    config()->set('inertia-datatable.locale', 'en-GB');
    expect($resolve())->toBe('en-GB')
        ->and($resolve(DataTable::for(Product::query())->columns([Column::text('name', 'Name')])->locale('pt-BR')))->toBe('pt-BR')
        ->and($resolve(DataTable::for(Product::query())->columns([Column::text('name', 'Name')])->locale('browser')))->toBeNull();

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
            return [Column::text('name', 'Name')];
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

    DataTable::for(Product::query())->columns([Column::text('name', 'Name')])->withRequest(Request::create('/'))->toArray();
})->throws(InvalidArgumentException::class, 'The inertia-datatable.date_format [full] is not one of: short, medium, long, datetime, relative.');

it('sends the display, the filter and the locale in the response config', function () {
    config()->set('inertia-datatable.locale', 'es-CL');

    $config = DataTable::for(Product::query())
        ->columns([Column::text('name', 'Name'), Column::number('price', 'Price')->money('CLP')->filterRange()])
        ->withRequest(Request::create('/'))
        ->toArray()['config'];

    expect($config['locale'])->toBe('es-CL')
        ->and($config['columns'][0])->toBe(['id' => 'name', 'label' => 'Name', 'sortable' => false, 'hideable' => true, 'visible' => true, 'display' => ['type' => 'text'], 'filter' => null])
        ->and($config['columns'][1]['display'])->toBe(['type' => 'number', 'format' => ['style' => 'currency', 'currency' => 'CLP']])
        ->and($config['columns'][1]['filter'])->toBe(['variant' => 'range']);
});

it('shows a text as one kind of link', function () {
    Column::text('contact')->url()->email();
})->throws(InvalidArgumentException::class, 'The column [contact] is already shown as a url link.');

it('rejects a hidden column the user could never show', function (Closure $build) {
    expect($build)->toThrow(LogicException::class, 'The column [sku] is hidden but not hideable, so the user could never show it.');
})->with([
    'hidden, then not hideable' => [fn () => Column::text('sku')->hidden()->hideable(false)],
    'not hideable, then hidden' => [fn () => Column::text('sku')->hideable(false)->hidden()],
]);

it('counts the options of a filter unless it is told not to', function () {
    expect(Column::option('status')->filterSelect()->hasCounts())->toBeTrue()
        ->and(Column::option('status')->filterMultiSelect(counts: false)->hasCounts())->toBeFalse();
});

it('only searches the types whose values can be compared as text', function () {
    expect(method_exists(TextColumn::class, 'searchable'))->toBeTrue()
        ->and(method_exists(NumberColumn::class, 'searchable'))->toBeTrue()
        ->and(method_exists(OptionColumn::class, 'searchable'))->toBeTrue()
        ->and(method_exists(DateColumn::class, 'searchable'))->toBeFalse()
        ->and(method_exists(BooleanColumn::class, 'searchable'))->toBeFalse();
});

it('takes the labels and the badge variants of an enum', function () {
    expect(Column::option('stage')->options(OrderStage::class)->optionLabels())
        ->toBe(['open' => 'Abierta', 'won' => 'Ganada', 'lost' => 'Perdida'])
        ->and(displayOf(Column::option('stage')->badge()->options(OrderStage::class)))
        ->toBe(['type' => 'option', 'badge' => true, 'variant' => 'outline', 'variants' => ['open' => 'secondary', 'won' => 'secondary', 'lost' => 'destructive']])
        ->and(displayOf(Column::option('stage')->options(OrderStage::class)->badge('outline', ['won' => 'default'])))
        ->toBe(['type' => 'option', 'badge' => true, 'variant' => 'outline', 'variants' => ['open' => 'secondary', 'won' => 'default', 'lost' => 'destructive']]);
});

it('uses the variants of the enum only with a badge', function () {
    expect(displayOf(Column::option('stage')->options(OrderStage::class)))->toBe(['type' => 'option'])
        ->and(displayOf(Column::option('stage')->options(OrderStage::class)->badge(false)))->toBe(['type' => 'option', 'badge' => false])
        ->and(displayOf(Column::option('status')->options(ProductStatus::class)->badge()))->toBe(['type' => 'option', 'badge' => true, 'variant' => 'outline']);
});

it('rejects an empty badge variant from an enum', function () {
    Column::option('only')->options(BlankVariant::class);
})->throws(InvalidArgumentException::class, 'BlankVariant::badgeVariant() must return a badge variant');

it('shows the currency as a symbol by default, or as chosen in the cells and in the filter', function () {
    $format = ['style' => 'currency', 'currency' => 'CLP'];

    expect(displayOf(Column::number('price')->money('CLP')))->toBe(['type' => 'number', 'format' => $format])
        ->and(displayOf(Column::number('price')->money('CLP', cell: 'code', filter: 'none')))
        ->toBe(['type' => 'number', 'format' => $format, 'currency' => ['cell' => 'code', 'filter' => 'none']])
        ->and(displayOf(Column::number('price')->money('CLP', filter: 'code')))
        ->toBe(['type' => 'number', 'format' => $format, 'currency' => ['filter' => 'code']]);
});

it('rejects an unknown currency display', function () {
    Column::number('price')->money('CLP', cell: 'name');
})->throws(InvalidArgumentException::class, 'The cell currency display [name] is not one of: symbol, code, none.');
