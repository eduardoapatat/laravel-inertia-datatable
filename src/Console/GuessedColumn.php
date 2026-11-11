<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

/**
 * Column proposed by `make:datatable` from the model and its schema.
 */
final readonly class GuessedColumn
{
    /**
     * @param  'text'|'number'|'date'|'boolean'|'option'  $type  Factory of `Column` (`Column::number()`).
     * @param  list<string>  $calls  Calls chained after the factory, for example `searchable()`.
     * @param  'string'|'number'|'decimal'|'number-or-string'|'boolean'|'boolean-or-number'|'date'|'option'  $kind  Type of the value in the JSON, for the React component.
     */
    public function __construct(
        public string $id,
        public string $label,
        public string $type,
        public array $calls,
        public string $kind,
        public bool $nullable,
        public ?string $enumClass = null,
    ) {}

    public function toPhp(): string
    {
        $code = sprintf('Column::%s(%s, %s)', $this->type, var_export($this->id, true), var_export($this->label, true));

        foreach ($this->calls as $call) {
            $code .= "->{$call}";
        }

        return $code;
    }
}
