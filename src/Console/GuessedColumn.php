<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

/**
 * Column proposed by `make:datatable` from the model and its schema.
 */
final readonly class GuessedColumn
{
    /**
     * @param  list<string>  $calls  Calls chained after `Column::make()`, for example `sortable()`.
     * @param  'string'|'number'|'boolean'|'date'|'option'  $kind  Type for the React page.
     */
    public function __construct(
        public string $id,
        public string $label,
        public array $calls,
        public string $kind,
        public bool $nullable,
        public ?string $enumClass = null,
        public bool $isRelation = false,
    ) {}

    public function toPhp(): string
    {
        $code = sprintf("Column::make('%s', '%s')", $this->id, addslashes($this->label));

        foreach ($this->calls as $call) {
            $code .= "->{$call}";
        }

        return $code;
    }
}
