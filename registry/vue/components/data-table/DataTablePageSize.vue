<script setup lang="ts" generic="TData extends RowData">
import { computed, type HTMLAttributes, useId } from 'vue';

import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * "Rows per page" select.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /** Sizes to pick from; those of the PHP class by default. */
        pageSizeOptions?: number[];
        /** Side where the list opens. */
        side?: 'top' | 'bottom';
        /** Hides the "Rows per page" text (it stays for screen readers). */
        hideLabel?: boolean;
        class?: HTMLAttributes['class'];
    }>(),
    { side: 'top', hideLabel: false },
);

const table = useDataTable(props.table, 'DataTablePageSize');
const labelId = useId();
const options = computed(
    () =>
        props.pageSizeOptions ??
        table.options.meta?.pageSizeOptions ?? [10, 20, 30, 40, 50],
);
const pageSize = computed(() => `${table.atoms.pagination.get().pageSize}`);

function onPageSizeChange(value: unknown) {
    table.setPageSize(Number(value));
}
</script>

<template>
    <div
        data-slot="data-table-page-size"
        :class="cn('flex items-center gap-2', props.class)"
    >
        <Label
            :id="labelId"
            :for="`${labelId}-trigger`"
            :class="cn('whitespace-nowrap', hideLabel && 'sr-only')"
        >
            {{ getMessage(table, 'rows_per_page') }}
        </Label>
        <Select :model-value="pageSize" @update:model-value="onPageSizeChange">
            <SelectTrigger
                :id="`${labelId}-trigger`"
                :aria-labelledby="labelId"
                class="w-18"
            >
                <SelectValue :placeholder="pageSize" />
            </SelectTrigger>
            <SelectContent :side="side">
                <SelectGroup>
                    <SelectItem
                        v-for="option in options"
                        :key="option"
                        :value="`${option}`"
                    >
                        {{ option }}
                    </SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    </div>
</template>
