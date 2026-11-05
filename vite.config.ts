import { defineConfig } from 'vite-plus';

export default defineConfig({
    test: {
        include: ['registry/**/*.test.ts'],
    },
    lint: {
        ignorePatterns: ['vendor/**', 'node_modules/**', 'r/**'],
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
