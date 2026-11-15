<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';

import { Badge } from '@/components/ui/badge';
import { getMessage, type TableWithMeta } from '@/lib/data-table-messages';
import { cn } from '@/lib/utils';

/**
 * `+N` mark of a toolbar filter whose column has filters it can not show,
 * made in the filter list (`Name is mesa`). Nothing renders with 0.
 */
const props = defineProps<{
    /** For the texts. */
    table?: TableWithMeta;
    /** Label of the column. */
    label: string;
    /** `getHiddenFilterCount(column)`. */
    count: number;
    class?: HTMLAttributes['class'];
}>();

const text = computed(() =>
    getMessage(props.table, 'hidden_filters_label', {
        count: props.count,
        label: props.label,
    }),
);
</script>

<template>
    <Badge
        v-if="count > 0"
        data-slot="data-table-hidden-filters"
        variant="secondary"
        :title="text"
        :class="cn('rounded-sm px-1 font-normal', props.class)"
    >
        <span aria-hidden="true">{{
            getMessage(table, 'hidden_filters', { count })
        }}</span>
        <span class="sr-only">{{ text }}</span>
    </Badge>
</template>
