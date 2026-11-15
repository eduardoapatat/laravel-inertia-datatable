<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { useFacetedItemSelected } from './context';

/**
 * The project's Checkbox at the start of an item, checked while the item is
 * selected (the item handles the click and the keyboard). Its border comes
 * from the text color of the item, which every theme makes readable on the
 * item background (also on hover), not from `--input`: in some themes it
 * equals `--accent`, the hover color.
 */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const selected = useFacetedItemSelected();
const checked = computed(() => selected?.value ?? false);
</script>

<template>
    <Checkbox
        data-slot="faceted-item-checkbox"
        :model-value="checked"
        :tabindex="-1"
        aria-hidden="true"
        :class="cn('pointer-events-none border-current/50', props.class)"
    />
</template>
