<?php

declare(strict_types=1);

it('registers the default configuration', function () {
    expect(config('inertia-datatable.query.page'))->toBe('page')
        ->and(config('inertia-datatable.per_page'))->toBe(10)
        ->and(config('inertia-datatable.per_page_options'))->toBe([10, 20, 30, 50]);
});
