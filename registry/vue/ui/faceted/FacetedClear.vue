<script setup lang="ts">
import { ListboxGroup, ListboxItem } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import { getSelectedValues, useFaceted } from './context';
import FacetedSeparator from './FacetedSeparator.vue';

/** Item that clears the selection; only shown while there is one. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const emit = defineEmits<{ select: [] }>();

const context = useFaceted('FacetedClear');
const visible = computed(
    () =>
        getSelectedValues(context.value.value).length > 0 &&
        context.search.value.trim() === '',
);

function onSelect(event: Event) {
    event.preventDefault();
    emit('select');
    context.clear();
}
</script>

<template>
    <template v-if="visible">
        <FacetedSeparator />
        <ListboxGroup data-slot="faceted-group" class="p-1">
            <ListboxItem
                data-slot="faceted-clear"
                value="\u0000faceted-clear"
                :class="
                    cn(
                        'relative flex cursor-default items-center justify-center gap-1.5 rounded-md px-1.5 py-1 text-center text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                        props.class,
                    )
                "
                @select="onSelect"
                @mousedown.prevent
            >
                <slot>Clear</slot>
            </ListboxItem>
        </ListboxGroup>
    </template>
</template>
