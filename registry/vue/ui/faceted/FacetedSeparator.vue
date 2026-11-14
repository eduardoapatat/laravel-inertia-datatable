<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import { useFaceted } from './context';

/** Line between groups; hidden while searching, as the groups may be empty. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const context = useFaceted('FacetedSeparator');
</script>

<template>
    <div
        v-if="context.search.value.trim() === ''"
        data-slot="faceted-separator"
        aria-hidden="true"
        :class="cn('my-0.5 h-px w-full bg-border', props.class)"
    />
</template>
