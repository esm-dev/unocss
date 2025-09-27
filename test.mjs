import { generate } from "./index.mjs";
import reset from "./reset.mjs";
const css = String.raw;

const configCSS = css`
@import "@unocss/reset/eric-meyer";
@import "@unocss/preset-wind4";
@import "@unocss/preset-typography";
@import "@unocss/preset-web-fonts";
@import "@unocss/preset-tagify";
@import "@unocss/preset-icons";
@import "@unocss/preset-attributify";

:theme {
  --color-primary: #232323;
  --font-family-sans: webfont("Inter:400,500,600");
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --animation-duration-spin: 1s;
  --animation-timing-spin: ease;
  --animation-count-spin: 1;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.custom {
  --uno: text-primary text-lg;
  --uno: font-(italic bold) font-sans;
  display: flex;
}

* {
  padding: 0;
  margin: 0;
}
`;

const generatedCSS = await generate(
  [
    `<article class="prose"></article>`,
    `<div class="custom animate-spin">UNO</div>`,
    `<div class="i-twemoji-grinning-face-with-smiling-eyes hover:i-twemoji-face-with-tears-of-joy" />`,
    `<div border="2 rounded blue-200"></div>`,
    `<flex></flex>`,
  ],
  { configCSS, customCacheDir: "./node_modules/@unocss/cache" },
);

function assertStringIncludes(actual, expected) {
  if (!actual.includes(expected)) {
    throw new Error(`Expected ${actual} to include ${expected}`);
  }
}

// reset
assertStringIncludes(generatedCSS, reset["eric-meyer.css"]);

// animations
assertStringIncludes(generatedCSS, "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}");
assertStringIncludes(generatedCSS, ".animate-spin{animation:spin 1s ease 1;}");

// shortcuts
assertStringIncludes(
  generatedCSS,
  `.custom{color:color-mix(in oklab, var(--colors-primary) var(--un-text-opacity), transparent);}`,
);

// web fonts
assertStringIncludes(generatedCSS, "font-face {\n  font-family: 'Inter';\n  font-style: normal;\n  font-weight: 400;\n");
assertStringIncludes(generatedCSS, "font-face {\n  font-family: 'Inter';\n  font-style: normal;\n  font-weight: 500;\n");
assertStringIncludes(generatedCSS, "font-face {\n  font-family: 'Inter';\n  font-style: normal;\n  font-weight: 600;\n");
assertStringIncludes(generatedCSS, "src: url(https://fonts.gstatic.com/s/inter/");
assertStringIncludes(generatedCSS, ".woff2) format('woff2')");

// icons
assertStringIncludes(generatedCSS, '.i-twemoji-grinning-face-with-smiling-eyes{background:url("data:image/svg+xml;utf8,');
assertStringIncludes(generatedCSS, '.hover\\:i-twemoji-face-with-tears-of-joy:hover{background:url("data:image/svg+xml;utf8,');

// attributify
assertStringIncludes(generatedCSS, '.rounded,\n[border~="rounded"]{border-radius:var(--radius-DEFAULT);}');
assertStringIncludes(generatedCSS, '{border-color:color-mix(in srgb, var(--colors-blue-200) var(--un-border-opacity), transparent);}');
assertStringIncludes(generatedCSS, '[border~="\\32 "]{border-width:2px;}');

// tagify
assertStringIncludes(generatedCSS, "flex{display:flex;}");

// typography
assertStringIncludes(generatedCSS, "/* layer: typography */");
assertStringIncludes(generatedCSS, ":is(.prose){");

// extra css
assertStringIncludes(generatedCSS, "*{padding:0;margin:0}");
assertStringIncludes(generatedCSS, ".custom{display:flex}");

console.log("✅ All tests passed");
process.exit(0);
