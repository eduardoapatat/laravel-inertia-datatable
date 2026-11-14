<script setup lang="ts">
import { Search } from '@lucide/vue';
import { ListboxFilter } from 'reka-ui';
import { computed, type HTMLAttributes, useAttrs } from 'vue';

import { cn } from '@/lib/utils';

import { useFaceted } from './context';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
    placeholder?: string;
    class?: HTMLAttributes['class'];
}>();

const attrs = useAttrs();
const { search } = useFaceted('FacetedInput');

// A placeholder is no accessible name: it names the combobox by default.
const ariaLabel = computed(
    () => (attrs['aria-label'] as string | undefined) ?? props.placeholder,
);
</script>

<template>
    <div
        data-slot="faceted-input-wrapper"
        class="flex h-9 items-center gap-2 border-b px-3"
    >
        <Search class="size-4 shrink-0 opacity-50" />
        <ListboxFilter
            v-bind="attrs"
            v-model="search"
            data-slot="faceted-input"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            :aria-label="ariaLabel"
            :placeholder="placeholder"
            auto-focus
            :class="
                cn(
                    'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
                    props.class,
                )
            "
        />
    </div>
</template>
