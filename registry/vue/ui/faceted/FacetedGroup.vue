<script setup lang="ts">
import { ListboxGroup } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import { createVisibility, provideFacetedGroup } from './context';

/** Group of items, hidden when the search leaves none of them. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const group = createVisibility(computed);

provideFacetedGroup(group);
</script>

<template>
    <ListboxGroup
        v-show="group.hasVisible.value"
        data-slot="faceted-group"
        :class="cn('overflow-hidden p-1 text-foreground', props.class)"
    >
        <slot />
    </ListboxGroup>
</template>
