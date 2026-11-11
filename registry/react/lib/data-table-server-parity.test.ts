import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    FILTER_OPERATOR_URL_NAMES,
    IMPLICIT_OPERATORS,
} from '@/lib/data-table-server';

describe('parity with the PHP enums', () => {
    const readEnum = (name: string) =>
        readFileSync(
            new URL(`../../../src/Enums/${name}.php`, import.meta.url),
            'utf8',
        );
    const cases = (php: string) =>
        new Map(
            [...php.matchAll(/^\s+case (\w+) = '([\w-]+)';$/gm)].map(
                ([, name, value]) => [name, value] as [string, string],
            ),
        );
    const method = (php: string, name: string) =>
        php.slice(php.indexOf(`function ${name}(`)).split(/\n {4}\}/)[0] ?? '';

    const operatorPhp = readEnum('FilterOperator');
    const operators = cases(operatorPhp);
    const variantPhp = readEnum('FilterVariant');
    const variants = cases(variantPhp);

    it('has the same operators and URL names', () => {
        const urlNames = Object.fromEntries(
            [
                ...method(operatorPhp, 'urlName').matchAll(
                    /self::(\w+) => '([^']+)'/g,
                ),
            ].map(([, name, urlName]) => [operators.get(name ?? ''), urlName]),
        );

        expect(operators.size).toBe(13);
        expect(urlNames).toEqual(FILTER_OPERATOR_URL_NAMES);
    });

    it('has the same variants and implicit operators', () => {
        const body = method(variantPhp, 'implicitOperator');
        const fallback = /default => FilterOperator::(\w+)/.exec(body)?.[1];
        const implicit = Object.fromEntries(
            [...variants].map(([name, value]) => {
                const arm = [
                    ...body.matchAll(
                        /(self::[\w, :]+) => FilterOperator::(\w+)/g,
                    ),
                ].find(([, list]) =>
                    list?.split(/,\s*/).includes(`self::${name}`),
                );

                return [value, operators.get(arm?.[2] ?? fallback ?? '')];
            }),
        );

        expect(variants.size).toBe(8);
        expect(implicit).toEqual(IMPLICIT_OPERATORS);
    });
});
