<script setup lang="ts">
import { ListboxItem } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import {
    getIsValueSelected,
    provideFacetedItemSelected,
    registerFacetedItem,
    useFaceted,
    useFacetedGroup,
} from './context';

/**
 * An option of the list: picking it selects it, or calls `@select` instead
 * when given. Hidden while it does not match the search.
 */
const props = defineProps<{
    value: string;
    /** Text the search matches; the label of the item in `items` by default. */
    label?: string;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
    onSelect?: (value: string) => void;
}>();

const context = useFaceted('FacetedItem');
const visible = computed(() => context.matches(props.value, props.label));
const selected = computed(() =>
    getIsValueSelected(
        context.value.value,
        context.multiple.value,
        props.value,
    ),
);

registerFacetedItem(visible, context, useFacetedGroup());
provideFacetedItemSelected(selected);

function onSelect(event: Event) {
    // The list does not change its own value: the Faceted (or `@select`) does.
    event.preventDefault();

    if (props.onSelect) {
        props.onSelect(props.value);
        return;
    }

    context.selectItem(props.value);
}

function onPointerDown(event: PointerEvent) {
    // A focusable item would steal the focus of the search box.
    event.preventDefault();
    if (event.pointerType === 'touch') return;
    (event.currentTarget as HTMLElement)
        .closest('[data-slot=faceted-command]')
        ?.querySelector<HTMLInputElement>('[data-slot=faceted-input]')
        ?.focus();
}
</script>

<template>
    <ListboxItem
        v-if="visible"
        data-slot="faceted-item"
        :value="value"
        :disabled="disabled"
        :data-checked="selected || undefined"
        :class="
            cn(
                'group/command-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4 data-[highlighted]:*:[svg]:text-accent-foreground',
                props.class,
            )
        "
        @select="onSelect"
        @pointerdown="onPointerDown"
        @mousedown.prevent
    >
        <slot :selected="selected" />
    </ListboxItem>
</template>
