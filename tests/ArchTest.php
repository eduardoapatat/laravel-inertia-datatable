<?php

declare(strict_types=1);

arch('no deja llamadas de depuración')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'die'])
    ->not->toBeUsed();

arch('usa tipos estrictos en src')
    ->expect('InertiaDataTable')
    ->toUseStrictTypes();
