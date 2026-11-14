<script setup lang="ts">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { useVModel } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

import { Popover } from '@/components/ui/popover';

import {
    createVisibility,
    type FacetedOption,
    type FacetedValue,
    provideFaceted,
} from './context';

/**
 * A popover with a searchable list of options, single or multiple: the
 * filters of select columns and the column menu of the data table.
 */
const props = withDefaults(
    defineProps<{
        modelValue?: FacetedValue;
        /** Options, for the labels of the selected values and the search. */
        items?: FacetedOption[];
        multiple?: boolean;
        open?: boolean;
        defaultOpen?: boolean;
    }>(),
    {
        modelValue: undefined,
        items: () => [],
        multiple: false,
        open: undefined,
        defaultOpen: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: FacetedValue];
    'update:open': [open: boolean];
}>();

const value = useVModel(props, 'modelValue', emit, { passive: true });
const open = useVModel(props, 'open', emit, {
    passive: true,
    defaultValue: props.defaultOpen,
});
const search = ref('');
const items = computed(() => props.items);
const multiple = computed(() => props.multiple);

// A new search each time the list opens.
watch(open, (isOpen) => {
    if (!isOpen) search.value = '';
});

function setOpen(next: boolean) {
    open.value = next;
}

function selectItem(selected: string) {
    if (props.multiple) {
        const values = Array.isArray(value.value) ? value.value : [];

        value.value = values.includes(selected)
            ? values.filter((item) => item !== selected)
            : [...values, selected];
        return;
    }

    value.value = value.value === selected ? undefined : selected;
    setOpen(false);
}

function clear() {
    value.value = props.multiple ? [] : undefined;
}

function matches(itemValue: string, label?: string) {
    const term = search.value.trim().toLocaleLowerCase();

    if (term === '') return true;

    const text =
        props.items.find((item) => item.value === itemValue)?.label ??
        label ??
        itemValue;

    return text.toLocaleLowerCase().includes(term);
}

provideFaceted({
    value,
    items,
    multiple,
    search,
    selectItem,
    clear,
    setOpen,
    matches,
    ...createVisibility(computed),
});
</script>

<template>
    <Popover v-model:open="open">
        <slot />
    </Popover>
</template>
