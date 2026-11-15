<script setup lang="ts" generic="TData extends RowData">
import { computed, type HTMLAttributes, useAttrs } from 'vue';

import { Input } from '@/components/ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { FilterAffix } from '@/lib/data-table-format';
import type { Column, RowData } from '@/lib/data-table-tanstack';

defineOptions({ inheritAttrs: false });

/**
 * Input of `DataTableTextFilter` and `DataTableNumberFilter`, with the unit
 * or currency next to the value; other attributes go to the input.
 */
const props = withDefaults(
    defineProps<{
        column: Column<DataTableFeatures, TData>;
        type?: 'text' | 'number';
        /** Unit or currency next to the value (`getFilterAffixes`). */
        affixes?: FilterAffix[];
        class?: HTMLAttributes['class'];
    }>(),
    { type: 'text', affixes: () => [] },
);

const attrs = useAttrs();

const value = computed(() => {
    const filterValue = props.column.getFilterValue();

    if (typeof filterValue === 'string' || typeof filterValue === 'number') {
        return String(filterValue);
    }

    return Array.isArray(filterValue) ? filterValue.join(',') : '';
});

function onInput(next: string | number) {
    props.column.setFilterValue(next === '' ? undefined : String(next));
}
</script>

<template>
    <Input
        v-if="affixes.length === 0"
        v-bind="attrs"
        :type="type"
        :model-value="value"
        :class="props.class"
        @update:model-value="onInput"
    />
    <InputGroup v-else :class="props.class">
        <InputGroupInput
            v-bind="attrs"
            :type="type"
            :model-value="value"
            @update:model-value="onInput"
        />
        <InputGroupAddon
            v-for="affix in affixes"
            :key="affix.align"
            :align="affix.align"
        >
            <InputGroupText>{{ affix.text }}</InputGroupText>
        </InputGroupAddon>
    </InputGroup>
</template>
