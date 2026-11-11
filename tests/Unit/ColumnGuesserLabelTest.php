<?php

declare(strict_types=1);

use InertiaDataTable\Console\ColumnGuesser;

it('writes the label of a column from its name', function (string $name, bool $boolean, string $label) {
    expect(ColumnGuesser::label($name, $boolean))->toBe($label);
})->with([
    ['name', false, 'Name'],
    ['released_on', false, 'Released On'],
    ['sku', false, 'SKU'],
    ['site_url', false, 'Site URL'],
    ['external_id', false, 'External ID'],
    ['is_featured', true, 'Featured'],
    ['featured', true, 'Featured'],
    ['is', true, 'Is'],
    ['is_public', false, 'Is Public'],
    ['island', true, 'Island'],
]);
