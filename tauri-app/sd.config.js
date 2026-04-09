import StyleDictionary from "style-dictionary";
import { register, getTransforms } from "@tokens-studio/sd-transforms";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

// ---------------------------------------------------------------------------
// 0. Pre-flatten: merge Tokens Studio multi-set JSON into a single dictionary
//    Active sets: Primitives + Colors/Light (default theme) + Numbers
// ---------------------------------------------------------------------------
const raw = JSON.parse(readFileSync("src/tokens/tokens.json", "utf-8"));

const lightSets = ["Primitives/Mode 1", "Colors/Light", "Numbers/Mode 1"];
const darkSets = ["Primitives/Mode 1", "Colors/Dark", "Numbers/Mode 1"];

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (
      v && typeof v === "object" && !Array.isArray(v) &&
      target[k] && typeof target[k] === "object" && !Array.isArray(target[k])
    ) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function mergeSets(sets) {
  const result = {};
  for (const setName of sets) {
    if (raw[setName]) deepMerge(result, raw[setName]);
  }
  return result;
}

mkdirSync("src/tokens/.build", { recursive: true });
writeFileSync("src/tokens/.build/merged.json", JSON.stringify(mergeSets(lightSets), null, 2));
writeFileSync("src/tokens/.build/merged-dark.json", JSON.stringify(mergeSets(darkSets), null, 2));

// ---------------------------------------------------------------------------
// 1. Register Tokens Studio transforms
// ---------------------------------------------------------------------------
register(StyleDictionary, { excludeParentKeys: true });

// ---------------------------------------------------------------------------
// 2. Preprocessor – fix spaced references from Tokens Studio
//    e.g. "{Zinc . 50}" → "{Zinc.50}"
// ---------------------------------------------------------------------------
function fixSpacedRefs(obj) {
  if (typeof obj === "string") {
    return obj.replace(/\{\s*([^}]+?)\s*\}/g, (_match, inner) =>
      `{${inner.replace(/\s*\.\s*/g, ".")}}`
    );
  }
  if (Array.isArray(obj)) return obj.map(fixSpacedRefs);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = fixSpacedRefs(v);
    return out;
  }
  return obj;
}

StyleDictionary.registerPreprocessor({
  name: "fix-spaced-references",
  preprocessor: (dictionary) => fixSpacedRefs(dictionary),
});

// ---------------------------------------------------------------------------
// 3. Custom name transform – camelCase with category
//    ["Bg", "Success Hover"] → "bgSuccessHover"
//    Special-case fontWeight tokens for value-based naming
// ---------------------------------------------------------------------------
function toCamel(segments) {
  return segments
    .map((s, i) => {
      const words = s.split(/[\s-]+/);
      return words
        .map((w, wi) => {
          const lower = w.toLowerCase();
          if (i === 0 && wi === 0) return lower;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join("");
    })
    .join("");
}

StyleDictionary.registerTransform({
  name: "name/camelWithCategory",
  type: "name",
  transform: (token) => {
    if (token.path.some((p) => p.toLowerCase() === "fontweights")) {
      const rawVal = token.$value ?? token.original?.$value;
      const weight = typeof rawVal === "string" ? rawVal : token.path[token.path.length - 1];
      return `textFontWeight${weight.replace(/[\s-]+/g, "")}`;
    }
    return toCamel(token.path);
  },
});

// ---------------------------------------------------------------------------
// 4. size/pxUnit – append "px" to numeric spacing & corner-radius tokens
// ---------------------------------------------------------------------------
StyleDictionary.registerTransform({
  name: "size/pxUnit",
  type: "value",
  filter: (token) => {
    const pathLower = token.path.map((p) => p.toLowerCase()).join(".");
    const isSpacingOrCorner =
      pathLower.startsWith("spacing") || pathLower.startsWith("corner");
    // Check original $value is numeric (token.value may be undefined at filter time in SD v5)
    const rawVal = token.$value ?? token.original?.$value ?? token.value;
    return isSpacingOrCorner && typeof rawVal === "number";
  },
  transform: (token) => {
    const val = token.$value ?? token.original?.$value ?? token.value;
    return `${val}px`;
  },
});

// ---------------------------------------------------------------------------
// 5. Custom format – tailwind/typography-utilities
//    Groups expanded typography sub-tokens into CSS utility classes
//    References CSS vars from tokens.css (no fallback values needed)
// ---------------------------------------------------------------------------
StyleDictionary.registerFormat({
  name: "tailwind/typography-utilities",
  format: ({ dictionary }) => {
    // After expansion + toCamel, sub-tokens like ["Caption","XS","fontFamily"]
    // become "captionXsFontfamily"
    const typoSuffixes = [
      "Fontfamily", "Fontweight", "Fontsize", "Lineheight",
      "Letterspacing", "Textcase", "Textdecoration",
      "Paragraphspacing", "Paragraphindent",
    ];

    const groups = new Map();

    for (const token of dictionary.allTokens) {
      const name = token.name;
      for (const suffix of typoSuffixes) {
        if (name.endsWith(suffix)) {
          const base = name.slice(0, name.length - suffix.length);
          if (!groups.has(base)) groups.set(base, {});
          groups.get(base)[suffix] = name;
          break;
        }
      }
    }

    if (groups.size === 0) return "/* No typography tokens found */\n";

    const lines = [];
    for (const [base, props] of groups) {
      // Convert camelCase base to kebab-case class: captionXs → .text-caption-xs
      const kebab = base.replace(/([a-z])([A-Z])/g, "$1-$2")
                        .replace(/([0-9])([A-Z])/g, "$1-$2")
                        .toLowerCase();
      const className = `.text-${kebab}`;

      const cssProps = [];
      if (props.Fontfamily) cssProps.push(`  font-family: var(--${props.Fontfamily});`);
      if (props.Fontweight) cssProps.push(`  font-weight: var(--${props.Fontweight});`);
      if (props.Fontsize) cssProps.push(`  font-size: var(--${props.Fontsize});`);
      // Typography line-height tokens are exported as unitless numbers from Figma,
      // but CSS interprets unitless line-height as a multiplier, not pixels.
      if (props.Lineheight) cssProps.push(`  line-height: calc(var(--${props.Lineheight}) * 1px);`);
      if (props.Letterspacing) cssProps.push(`  letter-spacing: var(--${props.Letterspacing});`);
      // textCase and textDecoration: only include if the var exists
      // The actual value filtering (none vs uppercase) happens at runtime via CSS vars
      if (props.Textcase) cssProps.push(`  text-transform: var(--${props.Textcase});`);
      if (props.Textdecoration) cssProps.push(`  text-decoration: var(--${props.Textdecoration});`);

      if (cssProps.length > 0) {
        lines.push(`${className} {\n${cssProps.join("\n")}\n}`);
      }
    }

    return lines.join("\n\n") + "\n";
  },
});

// ---------------------------------------------------------------------------
// 6. Custom transform group – tokens-studio-extended
// ---------------------------------------------------------------------------
const tsTransforms = getTransforms();
const extendedTransforms = [
  ...tsTransforms,
  "name/camelWithCategory",
  "size/pxUnit",
];

StyleDictionary.registerTransformGroup({
  name: "tokens-studio-extended",
  transforms: extendedTransforms,
});

// ---------------------------------------------------------------------------
// 7. Custom format – css/variables scoped to a selector
// ---------------------------------------------------------------------------
StyleDictionary.registerFormat({
  name: "css/variables-themed",
  format: ({ dictionary, options }) => {
    const selector = options?.selector ?? ":root";
    const vars = dictionary.allTokens
      .map((token) => `  --${token.name}: ${token.$value ?? token.value};`)
      .join("\n");
    return `${selector} {\n${vars}\n}\n`;
  },
});

// ---------------------------------------------------------------------------
// 8. Shared token filter
// ---------------------------------------------------------------------------
function tokenFilter(token) {
  const name = token.name;
  const pathFirst = token.path[0]?.toLowerCase() ?? "";
  // Exclude paragraph sub-tokens
  if (name.endsWith("Paragraphspacing") || name.endsWith("Paragraphindent"))
    return false;
  // Exclude standalone utility tokens (textCase, textDecoration, fontWeights,
  // lineHeights, paragraphSpacing, paragraphIndent, fontSize primitives)
  const excludePrefixes = [
    "textcase", "textdecoration", "fontweights", "lineheights",
    "paragraphspacing", "paragraphindent",
  ];
  if (excludePrefixes.includes(pathFirst)) return false;
  // Exclude font size/line-height primitives (from Primitives set)
  if (pathFirst === "font") return false;
  // Exclude raw fontSize/letterSpacing number tokens
  if (pathFirst === "fontsize" || pathFirst === "letterspacing") return false;
  return true;
}

// ---------------------------------------------------------------------------
// 9. Build configuration — light (default) + tailwind
// ---------------------------------------------------------------------------
const sd = new StyleDictionary({
  source: ["src/tokens/.build/merged.json"],
  preprocessors: ["tokens-studio/excludeParentKeys", "fix-spaced-references"],
  expand: { typesMap: true },
  platforms: {
    css: {
      transformGroup: "tokens-studio-extended",
      buildPath: "src/app/",
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
          filter: tokenFilter,
        },
      ],
    },
    tailwind: {
      transformGroup: "tokens-studio-extended",
      buildPath: "src/app/",
      files: [
        {
          destination: "tokens-typography.css",
          format: "tailwind/typography-utilities",
        },
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 10. Build configuration — dark theme
// ---------------------------------------------------------------------------
// Only output semantic color tokens in the dark override — skip primitives,
// spacing, corner, typography, and shadows which are identical in both themes
function darkTokenFilter(token) {
  if (!tokenFilter(token)) return false;
  const pathFirst = token.path[0]?.toLowerCase() ?? "";
  // Include only semantic color categories that differ between themes
  const semanticGroups = [
    "text", "bg", "icon", "border", "gradient", "plain",
  ];
  return semanticGroups.some((g) => pathFirst.startsWith(g));
}

const sdDark = new StyleDictionary({
  source: ["src/tokens/.build/merged-dark.json"],
  preprocessors: ["tokens-studio/excludeParentKeys", "fix-spaced-references"],
  expand: { typesMap: true },
  platforms: {
    css: {
      transformGroup: "tokens-studio-extended",
      buildPath: "src/app/",
      files: [
        {
          destination: "tokens-dark.css",
          format: "css/variables-themed",
          filter: darkTokenFilter,
          options: {
            selector: '[data-theme="dark"]',
          },
        },
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 11. Build
// ---------------------------------------------------------------------------
await sd.buildAllPlatforms();
await sdDark.buildAllPlatforms();
console.log("\n✓ Tokens built successfully (light + dark)");
