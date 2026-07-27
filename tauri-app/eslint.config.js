// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Build outputs only. `dist` was already ignored, but `npm run lint` still failed
// on any checkout that had been built: storybook build writes bundled JS into
// storybook-static, and the Tauri build writes the codegen'd frontend assets into
// src-tauri/target. Linting those produced ~52 errors that had nothing to do with
// the source, which made the lint script useless as a signal.
export default defineConfig([globalIgnores(['dist', 'storybook-static', 'src-tauri/target']), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
}, {
  // Design-system primitives in app/components/ intentionally co-locate their
  // cva variant maps (buttonVariants, cardVariants, …) next to the component,
  // per the shadcn/ui convention. That trips react-refresh's "only export
  // components" rule — a dev-only fast-refresh concern, not worth scattering the
  // variants into sidecar files. Scope the rule off for this directory only.
  files: ['src/app/components/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  // preview/ is a standalone component-preview harness: it declares its demo
  // components locally and mounts them with createRoot, exporting nothing. The
  // same react-refresh rule fires on any entry point shaped that way, and it is
  // unsatisfiable there without splitting the demos into files for no reason.
  files: ['preview/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, ...storybook.configs["flat/recommended"]])
