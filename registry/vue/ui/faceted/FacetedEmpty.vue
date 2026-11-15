<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import { useFaceted } from './context';

/** Shown when the search leaves no item in the list. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const context = useFaceted('FacetedEmpty');
</script>

<template>
    <div
        v-if="!context.hasVisible.value"
        data-slot="faceted-empty"
        :class="cn('py-6 text-center text-sm', props.class)"
    >
        <slot />
    </div>
</template>
