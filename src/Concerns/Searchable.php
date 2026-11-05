<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

/**
 * Columns whose values make sense in the global search (text, numbers and options).
 */
trait Searchable
{
    /**
     * Included in the global search (every word must match some searchable column).
     */
    public function searchable(bool $searchable = true): static
    {
        return $this->withSearch($searchable);
    }
}
