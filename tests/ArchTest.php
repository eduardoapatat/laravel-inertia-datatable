<?php

declare(strict_types=1);

arch('does not leave debugging calls')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'die'])
    ->not->toBeUsed();

arch('uses strict types in src')
    ->expect('InertiaDataTable')
    ->toUseStrictTypes();
