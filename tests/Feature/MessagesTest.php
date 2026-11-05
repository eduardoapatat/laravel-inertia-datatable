<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Product;

use function Pest\Laravel\artisan;

/**
 * @return array<string, string>
 */
function uiMessages(): array
{
    return DataTable::for(Product::query())
        ->columns([Column::make('name', 'Name')])
        ->withRequest(Request::create('/'))
        ->toArray()['config']['messages'];
}

afterEach(function () {
    File::deleteDirectory(lang_path('vendor/inertia-datatable'));
});

it('sends the UI texts in the app language', function () {
    expect(uiMessages())->toMatchArray(['reset' => 'Reset', 'page_of' => 'Page :page of :pages']);

    app()->setLocale('es');

    expect(uiMessages())->toMatchArray(['reset' => 'Restablecer', 'page_of' => 'Página :page de :pages', 'yes' => 'Sí']);
});

it('falls back to English for a language without texts', function () {
    app()->setLocale('fr');

    expect(uiMessages()['reset'])->toBe('Reset');
});

it('lets the app change some texts by publishing them', function () {
    artisan('vendor:publish', ['--tag' => 'inertia-datatable-lang'])->assertSuccessful();

    expect(File::exists(lang_path('vendor/inertia-datatable/es/ui.php')))->toBeTrue();

    File::put(lang_path('vendor/inertia-datatable/es/ui.php'), "<?php return ['reset' => 'Borrar filtros'];");
    app()->setLocale('es');

    expect(uiMessages())->toMatchArray(['reset' => 'Borrar filtros', 'view' => 'Columnas']);
});

it('has the same keys in every language', function () {
    $english = array_keys(require __DIR__.'/../../lang/en/ui.php');

    foreach (File::directories(__DIR__.'/../../lang') as $directory) {
        expect(array_keys(require $directory.'/ui.php'))->toBe($english, basename($directory));
    }
});
