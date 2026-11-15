<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import { ListboxRoot, type PopoverContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useFaceted } from './context';

const props = withDefaults(
    defineProps<
        PopoverContentProps & {
            class?: HTMLAttributes['class'];
            dir?: 'ltr' | 'rtl';
        }
    >(),
    { align: 'start' },
);

const delegatedProps = reactiveOmit(props, 'class', 'dir');
const context = useFaceted('FacetedContent');
</script>

<template>
    <PopoverContent
        data-slot="faceted-content"
        v-bind="delegatedProps"
        :dir="dir"
        :class="cn('w-50 p-0', props.class)"
    >
        <ListboxRoot
            data-slot="faceted-command"
            :model-value="context.value.value"
            :multiple="context.multiple.value"
            :dir="dir"
            highlight-on-hover
            class="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover p-0.5 text-popover-foreground"
        >
            <slot />
        </ListboxRoot>
    </PopoverContent>
</template>
