# CleanMeter — Design System Conventions

## Token Naming Patterns

- **Colors**: `--bg{Semantic}`, `--text{Semantic}`, `--border{Semantic}`, `--icon{Semantic}`
  - Each has intensity variants: base, Hover, Active, Subtlest, Subtler, Subtle
- **Primitives**: `--{color}{shade}` → `--gray50`..`--gray950`, `--purple50`..`--purple950`
- **Spacing**: `--spacingXxxxs` (2px) through `--spacingXxxl` (40px) — includes `px` units
- **Radius**: `--cornerS` (4px) through `--cornerRound` (100px) — includes `px` units
- **Typography classes**: `.text-{category}-{size}-{weight}` (e.g. `.text-body-sm-medium`, `.text-heading-h1`)
- **Shadows**: `--shadow-card`, `--shadow-large` (composed in globals.css from expanded sub-tokens)
- **Font weights**: value-based naming `--textFontWeightMedium` (500), `--textFontWeightRegular` (400), `--textFontWeightSemibold` (600)

## Color Utility Format

Always use **raw CSS var format**:
```
text-[var(--textHeading)]
bg-[var(--bgSurfaceRaised)]
border-[var(--borderSubtle)]
p-[var(--spacingXs)]
rounded-[var(--cornerL)]
```

Do **NOT** use Tailwind semantic shorthands like `text-text-heading`, `bg-surface-raised`.
Ignore linter `suggestCanonicalClasses` warnings.

## Component Rules

- `React.ComponentProps<"element">` for props (NOT `React.HTMLAttributes`)
- `cn()` from `@/lib/utils` for class merging
- `cva` from `class-variance-authority` for variants
- `@radix-ui/react-slot` with `asChild` for polymorphic components
- Always include focus states using `shadow-focus-default` / `shadow-focus-destructive`
- Place new DS components in `src/app/components/`

## Figma-to-Code Workflow

1. Inspect Figma component for visual design, variants, tokens
2. Do **NOT** copy Figma's internal layer/node structure
3. Build with proper web patterns: semantic HTML + shadcn/Radix patterns + project tokens
4. Map Figma properties → React props / CVA variants
5. Map Figma token references → project CSS vars / Tailwind utilities

## Token Pipeline

- Source: `src/tokens/tokens.json` (Tokens Studio export from Figma)
- Config: `sd.config.js` (Style Dictionary build)
- Output: `src/app/tokens.css`, `src/app/tokens-typography.css` (auto-generated, do not edit)
- Theme mapping: `src/app/globals.css` (hand-authored `@theme inline` block)
- Rebuild after Figma export: `npm run build:tokens`
