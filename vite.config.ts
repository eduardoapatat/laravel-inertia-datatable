import { defineConfig } from 'vite-plus';

export default defineConfig({
    test: {
        include: ['registry/**/*.test.ts'],
    },
    lint: {
        // El código React se revisa con tipos en el playground, donde están
        // instaladas sus dependencias (shadcn, TanStack, Inertia).
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'r/**',
            'registry/react/**',
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
        ignorePatterns: ['vendor/**', 'r/**', 'composer.json', '*.md'],
    },
});
