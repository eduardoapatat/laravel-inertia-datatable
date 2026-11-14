<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { PopoverTriggerProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const props = defineProps<
    PopoverTriggerProps & { class?: HTMLAttributes['class'] }
>();

const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <PopoverTrigger
        data-slot="faceted-trigger"
        v-bind="delegatedProps"
        :class="
            cn(
                'justify-between text-left has-[>[data-slot=faceted-value]]:transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=faceted-value]>[data-slot=faceted-badge-list]]:pl-1',
                props.class,
            )
        "
    >
        <slot />
    </PopoverTrigger>
</template>
