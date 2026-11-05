<?php

declare(strict_types=1);

use App\DataTables\ProductsTable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use InertiaDataTable\Console\RegistryUrl;
use InertiaDataTable\Tests\Fixtures\Models\Account;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;
use InertiaDataTable\Tests\Fixtures\Models\Reading;

use function Pest\Laravel\artisan;

afterEach(function () {
    File::deleteDirectory(app_path('DataTables'));
    File::deleteDirectory(resource_path('js/pages/products'));
    File::deleteDirectory(resource_path('js/components/data-tables'));
    File::delete([resource_path('js/hooks/use-server-data-table.ts'), base_path('pnpm-lock.yaml')]);
});

it('creates a table class with the columns guessed from the model', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class])->assertSuccessful();

    expect(File::get(app_path('DataTables/ProductsTable.php')))
        ->toContain('namespace App\DataTables;')
        ->toContain('use InertiaDataTable\Tests\Fixtures\Enums\ProductStatus;')
        ->toContain('use InertiaDataTable\Tests\Fixtures\Models\Product;')
        ->toContain('return Product::query();')
        ->toContain("Column::text('name', 'Name')->sortable()->searchable()->filter()->hideable(false),")
        ->toContain("Column::option('category', 'Category')->from('category.name')->sortable()->searchable()->filter(multiple: true),")
        ->toContain("Column::option('status', 'Status')->options(ProductStatus::class)->filter(multiple: true),")
        ->toContain("Column::number('price', 'Price')->sortable()->filter(),")
        ->toContain("Column::boolean('featured', 'Featured')->filter(),")
        ->toContain("Column::date('released_on', 'Released On')->sortable()->range(),")
        ->toContain("return 'name';");
});

it('leaves out the primary key, hidden attributes and sensitive columns', function () {
    artisan('make:datatable', ['name' => 'AccountsTable', '--model' => Account::class])->assertSuccessful();

    $contents = File::get(app_path('DataTables/AccountsTable.php'));

    expect($contents)
        ->toContain("Column::text('email', 'Email')->sortable()->searchable()->filter()->hideable(false),")
        ->toContain("Column::text('notes', 'Notes')->searchable()->filter(),")
        ->toContain("Column::date('created_at', 'Created At')->sortable()->range(),")
        ->toContain("return '-created_at';")
        ->not->toContain("('id', 'Id')")
        ->not->toContain('password')
        ->not->toContain('remember_token')
        ->not->toContain('email_verified_at')
        ->not->toContain('updated_at');
});

it('creates a table that resolves against the database', function () {
    $home = Category::factory()->create(['name' => 'Home']);
    Product::factory()->for($home)->create(['name' => 'Lamp']);
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class])->assertSuccessful();
    require app_path('DataTables/ProductsTable.php');

    $response = ProductsTable::make()->withRequest(Request::create('/'))->toArray();

    expect($response['data'])->toHaveCount(1)
        ->and($response['data'][0]['name'])->toBe('Lamp')
        ->and($response['data'][0]['category'])->toBe('Home');
});

it('creates a reusable React component with the react option', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--react' => true])->assertSuccessful();

    expect(File::get(resource_path('js/components/data-tables/products-table.tsx')))
        ->toContain('export type Product = {')
        ->toContain('    name?: string;')
        ->toContain('    category?: string | null;')
        ->toContain('    price?: number;')
        ->toContain('const columns = columnHelper.columns([]);')
        ->toContain(" *     columnHelper.accessor('name', {")
        ->not->toContain('{{')
        ->toContain('export function ProductsTable({')
        ->toContain("prop = 'products',")
        ->and(File::exists(resource_path('js/pages/products/index.tsx')))->toBeFalse();
});

it('keeps the decimals of a decimal cast in the display', function () {
    artisan('make:datatable', ['name' => 'ReadingsTable', '--model' => Reading::class])->assertSuccessful();

    expect(File::get(app_path('DataTables/ReadingsTable.php')))
        ->toContain("Column::number('amount', 'Amount')->sortable()->range()->decimals(2),")
        ->toContain("Column::number('total', 'Total')->sortable()->range(),");
});

it('types the React row as the values arrive in the JSON', function () {
    artisan('make:datatable', ['name' => 'ReadingsTable', '--model' => Reading::class, '--react' => true])->assertSuccessful();

    expect(File::get(resource_path('js/components/data-tables/readings-table.tsx')))
        ->toContain('    amount?: string;')
        ->toContain('    total?: number | string;')
        ->toContain('    ratio?: number;')
        ->toContain('    active?: boolean | number;')
        ->toContain('    verified?: boolean;');
});

it('creates a page that renders the component with the page option', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--page' => true])->assertSuccessful();

    expect(File::exists(resource_path('js/components/data-tables/products-table.tsx')))->toBeTrue()
        ->and(File::get(resource_path('js/pages/products/index.tsx')))
        ->toContain("import { ProductsTable } from '@/components/data-tables/products-table';")
        ->toContain('export default function ProductsIndex({ products }: Props) {')
        ->toContain('<ProductsTable products={products} />')
        ->toContain("href: '/products',");
});

it('shows the install command when the data table UI is missing', function () {
    Process::fake();

    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--react' => true])
        ->expectsOutputToContain('npx shadcn@latest add '.RegistryUrl::forInstalledVersion().'/data-table-react.json -y')
        ->assertSuccessful();

    Process::assertNothingRan();
});

it('installs the data table UI with the package runner of the lockfile', function () {
    File::put(base_path('pnpm-lock.yaml'), '');
    Process::fake(function () {
        File::ensureDirectoryExists(resource_path('js/hooks'));
        File::put(resource_path('js/hooks/use-server-data-table.ts'), '');

        return Process::result();
    });

    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--install-ui' => true])->assertSuccessful();

    Process::assertRan(fn ($process) => $process->command === [
        'pnpm', 'dlx', 'shadcn@latest', 'add',
        RegistryUrl::forInstalledVersion().'/data-table-react.json', '-y',
    ]);
});

it('fails when the data table UI is still missing after installing it', function () {
    Process::fake();

    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--install-ui' => true])
        ->expectsOutputToContain('could not be installed')
        ->assertFailed();
});

it('does not install the data table UI when the project already has it', function () {
    File::ensureDirectoryExists(resource_path('js/hooks'));
    File::put(resource_path('js/hooks/use-server-data-table.ts'), '');
    Process::fake();

    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--install-ui' => true])->assertSuccessful();

    Process::assertNothingRan();
});

it('creates a table without columns with the empty option', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--empty' => true])->assertSuccessful();

    expect(File::get(app_path('DataTables/ProductsTable.php')))
        ->toContain("// Column::text('name')->sortable()->searchable()->filter(),")
        ->not->toContain("Column::number('price'")
        ->not->toContain('defaultSort');
});

it('fails when the model does not exist', function () {
    artisan('make:datatable', ['name' => 'InvoicesTable'])
        ->expectsOutputToContain('does not exist')
        ->assertFailed();

    expect(File::exists(app_path('DataTables/InvoicesTable.php')))->toBeFalse();
});

it('lists the available models when the model does not exist', function () {
    // The Testbench skeleton does not autoload App\: the model is written and loaded by hand.
    File::ensureDirectoryExists(app_path('Models'));
    File::put(app_path('Models/Customer.php'), "<?php\n\nnamespace App\\Models;\n\nclass Customer extends \\Illuminate\\Database\\Eloquent\\Model {}\n");
    File::put(app_path('Models/NotAModel.php'), "<?php\n\nnamespace App\\Models;\n\nclass NotAModel {}\n");
    require_once app_path('Models/Customer.php');
    require_once app_path('Models/NotAModel.php');

    try {
        artisan('make:datatable', ['name' => 'InvoicesTable'])
            ->expectsOutputToContain('Available models: Customer')
            ->doesntExpectOutputToContain('NotAModel')
            ->assertFailed();
    } finally {
        File::delete([app_path('Models/Customer.php'), app_path('Models/NotAModel.php')]);
    }
});

it('installs the data table UI even when the model does not exist', function () {
    File::put(base_path('pnpm-lock.yaml'), '');
    Process::fake(function () {
        File::ensureDirectoryExists(resource_path('js/hooks'));
        File::put(resource_path('js/hooks/use-server-data-table.ts'), '');

        return Process::result();
    });

    artisan('make:datatable', ['name' => 'InvoicesTable', '--install-ui' => true])
        ->expectsOutputToContain('does not exist')
        ->assertFailed();

    Process::assertRanTimes(fn ($process) => $process->command[0] === 'pnpm', 1);
    expect(File::exists(app_path('DataTables/InvoicesTable.php')))->toBeFalse();
});

it('installs the data table UI even when the table already exists', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class])->assertSuccessful();
    Process::fake(function () {
        File::ensureDirectoryExists(resource_path('js/hooks'));
        File::put(resource_path('js/hooks/use-server-data-table.ts'), '');

        return Process::result();
    });

    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--install-ui' => true])
        ->expectsOutputToContain('already exists');

    Process::assertRanTimes(fn ($process) => in_array('add', $process->command, true), 1);
});
