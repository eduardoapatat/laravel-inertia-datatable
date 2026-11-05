// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

export function formatDate(
    date: Date | string | number | undefined,
    opts: Intl.DateTimeFormatOptions = {},
) {
    if (!date) return '';

    try {
        return new Intl.DateTimeFormat(undefined, {
            month: opts.month ?? 'long',
            day: opts.day ?? 'numeric',
            year: opts.year ?? 'numeric',
            ...opts,
        }).format(new Date(date));
    } catch {
        return '';
    }
}
