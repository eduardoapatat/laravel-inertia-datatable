<script setup lang="ts">
import {
    Check,
    ChevronDown,
    ChevronsUpDown,
    ChevronUp,
    EyeOff,
} from '@lucide/vue';
import { computed, type HTMLAttributes } from 'vue';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getMessage } from '@/lib/data-table-messages';
import type { SortDirection } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import type { DataTableAnyColumn } from './cells';

/**
 * Header with the sort and hide menu of a column, of any row type.
 */
const props = defineProps<{
    column: DataTableAnyColumn;
    label: string;
    class?: HTMLAttributes['class'];
}>();

const sortDirection = computed<SortDirection | 'none'>(() => {
    const sort = props.column.table.atoms.sorting
        .get()
        .find((item) => item.id === props.column.id);

    if (!sort) return 'none';
    return sort.desc ? 'desc' : 'asc';
});

function onSortDirectionChange(direction: SortDirection) {
    if (sortDirection.value === direction) {
        props.column.clearSorting();
        return;
    }

    props.column.toggleSorting(direction === 'desc', true);
}

// The check of the sort options goes at the end, whatever the side the
// project's `DropdownMenuCheckboxItem` puts it on.
const sortItemClass = '[&_svg]:text-muted-foreground';
</script>

<template>
    <div
        v-if="!column.getCanSort() && !column.getCanHide()"
        :class="props.class"
    >
        {{ label }}
    </div>
    <DropdownMenu v-else>
        <DropdownMenuTrigger
            :class="
                cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 group-data-[align=end]/head:-me-2 group-data-[align=start]/head:-ms-2 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none data-[state=open]:bg-accent rtl:flex-row-reverse [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
                    props.class,
                )
            "
            :aria-label="getMessage(column.table, 'column_menu', { label })"
        >
            {{ label }}
            <template v-if="column.getCanSort()">
                <ChevronDown v-if="sortDirection === 'desc'" />
                <ChevronUp v-else-if="sortDirection === 'asc'" />
                <ChevronsUpDown v-else />
            </template>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="start"
            class="min-w-28 data-[state=closed]:fill-mode-forwards"
        >
            <template v-if="column.getCanSort()">
                <DropdownMenuItem
                    role="menuitemcheckbox"
                    :aria-checked="sortDirection === 'asc'"
                    :class="sortItemClass"
                    @select="onSortDirectionChange('asc')"
                >
                    <ChevronUp />
                    {{ getMessage(column.table, 'sort_ascending') }}
                    <Check
                        :class="
                            cn(
                                'ms-auto text-foreground!',
                                sortDirection !== 'asc' && 'invisible',
                            )
                        "
                    />
                </DropdownMenuItem>
                <DropdownMenuItem
                    role="menuitemcheckbox"
                    :aria-checked="sortDirection === 'desc'"
                    :class="sortItemClass"
                    @select="onSortDirectionChange('desc')"
                >
                    <ChevronDown />
                    {{ getMessage(column.table, 'sort_descending') }}
                    <Check
                        :class="
                            cn(
                                'ms-auto text-foreground!',
                                sortDirection !== 'desc' && 'invisible',
                            )
                        "
                    />
                </DropdownMenuItem>
            </template>
            <DropdownMenuItem
                v-if="column.getCanHide()"
                class="[&_svg]:text-muted-foreground"
                @select="column.toggleVisibility(false)"
            >
                <EyeOff />
                {{ getMessage(column.table, 'hide') }}
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
