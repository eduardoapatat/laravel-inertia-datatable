<?php

declare(strict_types=1);

use App\DataTables\ProductsTable;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Account;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Category;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

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
        ->toContain('use EduardoApatat\InertiaDataTable\Tests\Fixtures\Enums\ProductStatus;')
        ->toContain('use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Product;')
        ->toContain('return Product::query();')
        ->toContain("Column::make('name', 'Name')->sortable()->searchable()->text()->hideable(false),")
        ->toContain("Column::make('category', 'Category')->from('category.name')->sortable()->searchable()->multiSelect(),")
        ->toContain("Column::make('status', 'Status')->multiSelect(ProductStatus::class),")
        ->toContain("Column::make('price', 'Price')->sortable()->number(),")
        ->toContain("Column::make('featured', 'Featured')->boolean(),")
        ->toContain("Column::make('released_on', 'Released On')->sortable()->dateRange(),")
        ->toContain("return 'name';");
});

it('leaves out the primary key, hidden attributes and sensitive columns', function () {
    artisan('make:datatable', ['name' => 'AccountsTable', '--model' => Account::class])->assertSuccessful();

    $contents = File::get(app_path('DataTables/AccountsTable.php'));

    expect($contents)
        ->toContain("Column::make('email', 'Email')->sortable()->searchable()->text()->hideable(false),")
        ->toContain("Column::make('notes', 'Notes')->searchable()->text(),")
        ->toContain("Column::make('created_at', 'Created At')->sortable()->dateRange(),")
        ->toContain("return '-created_at';")
        ->not->toContain("Column::make('id'")
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
        ->toContain("columnHelper.accessor('status', {")
        ->toContain('getOptionLabel(column.columnDef.meta, cell.getValue()),')
        ->toContain("cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),")
        ->toContain("import { formatDate } from '@/lib/data-table-format';")
        ->toContain('export function ProductsTable({')
        ->toContain("prop = 'products',")
        ->and(File::exists(resource_path('js/pages/products/index.tsx')))->toBeFalse();
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

it('creates a table without columns with the empty option', function () {
    artisan('make:datatable', ['name' => 'ProductsTable', '--model' => Product::class, '--empty' => true])->assertSuccessful();

    expect(File::get(app_path('DataTables/ProductsTable.php')))
        ->toContain("// Column::make('name')->sortable()->searchable()->text(),")
        ->not->toContain("Column::make('price'")
        ->not->toContain('defaultSort');
});

it('fails when the model does not exist', function () {
    artisan('make:datatable', ['name' => 'InvoicesTable'])
        ->expectsOutputToContain('does not exist')
        ->assertFailed();

    expect(File::exists(app_path('DataTables/InvoicesTable.php')))->toBeFalse();
});
