import { defineConfig } from 'vite-plus';

const fromRoot = (path: string) =>
    decodeURIComponent(new URL(path, import.meta.url).pathname);

type Framework = 'react' | 'vue';

/**
 * The `@/...` imports of the registry, as shadcn installs them in an app: the
 * bridge to TanStack Table and the components of the framework, and the
 * shared libs. The shared libs are tested with the React bridge.
 */
const registryAliases = (framework: Framework) => [
    {
        find: /^@\/lib\/data-table-tanstack$/,
        replacement: fromRoot(
            `./registry/${framework}/lib/data-table-tanstack.ts`,
        ),
    },
    {
        find: /^@\/lib\/(.*)$/,
        replacement: `${fromRoot('./registry/shared/lib/')}$1`,
    },
    {
        find: /^@\/components\/(.*)$/,
        replacement: `${fromRoot(`./registry/${framework}/components/`)}$1`,
    },
];

// The hooks of each framework run in a DOM, with Inertia mocked; their cases
// are the same (`registry/shared/test/use-server-data-table.cases.ts`).
const hookProject = (framework: Framework) => ({
    resolve: { alias: registryAliases(framework) },
    test: {
        name: framework,
        include: [`registry/${framework}/**/*.test.ts`],
        environment: 'happy-dom',
        environmentOptions: {
            happyDOM: { url: 'http://localhost/products' },
        },
    },
});

export default defineConfig({
    test: {
        projects: [
            {
                resolve: { alias: registryAliases('react') },
                test: {
                    name: 'shared',
                    include: ['registry/shared/**/*.test.ts'],
                },
            },
            hookProject('react'),
            hookProject('vue'),
        ],
    },
    lint: {
        // The React and Vue code is type-checked by the starter kit CI jobs,
        // where its dependencies (shadcn, TanStack, Inertia) are installed.
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'r/**',
            'registry/react/**',
            'registry/vue/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: ['vendor/**', 'r/**', 'composer.json', '*.md'],
    },
});
