<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import { computed } from 'vue';

import { cn } from '@/lib/utils';

import {
    type FacetedOption,
    getSelectedItems,
    getSelectedValues,
    useFaceted,
} from './context';
import FacetedBadge from './FacetedBadge.vue';
import FacetedBadgeList from './FacetedBadgeList.vue';

/**
 * The selected values in the trigger; the default slot receives them
 * (`v-slot="{ selected }"`) to draw them another way.
 */
withDefaults(defineProps<{ placeholder?: string }>(), {
    placeholder: 'Select options...',
});

defineSlots<{
    default?: (props: { selected: FacetedOption[] }) => unknown;
}>();

const context = useFaceted('FacetedValue');
const values = computed(() => getSelectedValues(context.value.value));
const selected = computed(() =>
    getSelectedItems(values.value, context.items.value),
);
</script>

<template>
    <slot v-if="$slots.default" :selected="selected" />
    <span
        v-else
        data-slot="faceted-value"
        :class="
            cn(
                'flex w-full min-w-0 items-center gap-1',
                values.length === 0 && 'text-muted-foreground',
            )
        "
    >
        <FacetedBadgeList v-if="context.multiple.value && values.length > 0">
            <FacetedBadge v-if="values.length > 2"
                >{{ values.length }} selected</FacetedBadge
            >
            <template v-else>
                <FacetedBadge v-for="item in selected" :key="item.value">
                    <span class="truncate">{{ item.label }}</span>
                </FacetedBadge>
            </template>
        </FacetedBadgeList>
        <span v-else class="truncate">{{
            selected[0] ? selected[0].label : placeholder
        }}</span>
        <ChevronDown class="ml-auto size-4 shrink-0 text-muted-foreground" />
    </span>
</template>
