import { generate } from "./index.mjs";
import reset from "./reset.mjs";
const css = String.raw;

const configCSS = css`
@import "reset/eric-meyer";
@import "preset-uno";
@import "preset-typography";
@import "preset-web-fonts";
@import "preset-tagify";
@import "preset-icons";
@import "preset-attributify";

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
  --uno: text-primary text-lg font-bold;
  --uno: font-sans;
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
  { configCSS },
);

function assertStringIncludes(actual, expected) {
  if (!actual.includes(expected)) {
    throw new Error(`Expected ${actual} to include ${expected}`);
  }
}

// reset
assertStringIncludes(generatedCSS, reset["eric-meyer"]);

// animations
assertStringIncludes(generatedCSS, "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}");
assertStringIncludes(generatedCSS, ".animate-spin{animation:spin 1s ease 1;}");

// shortcuts
assertStringIncludes(
  generatedCSS,
  `.custom{font-size:1.125rem;line-height:1.75rem;--un-text-opacity:1;color:rgb(35 35 35 / var(--un-text-opacity));font-weight:700;font-family:"Inter",`,
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
assertStringIncludes(generatedCSS, '.rounded,\n[border~="rounded"]{border-radius:0.25rem;}');
assertStringIncludes(generatedCSS, '[border~="blue-200"]{--un-border-opacity:1;border-color:rgb(191 219 254 / var(--un-border-opacity));}');
assertStringIncludes(generatedCSS, '[border~="\\32 "]{border-width:2px;}');

// tagify
assertStringIncludes(generatedCSS, "flex{display:flex;}");

// typography
assertStringIncludes(generatedCSS, ".prose :where(");

// extra css
assertStringIncludes(generatedCSS, "*{padding:0;margin:0}");
assertStringIncludes(generatedCSS, ".custom{display:flex}");

console.log("✅ All tests passed");
process.exit(0);
