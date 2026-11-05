<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

/**
 * Columna propuesta por `make:datatable` a partir del modelo y su esquema.
 */
final readonly class GuessedColumn
{
    /**
     * @param  list<string>  $calls  Llamadas encadenadas tras `Column::make()`, por ejemplo `sortable()`.
     * @param  'string'|'number'|'boolean'|'date'|'option'  $kind  Tipo para la página React.
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
