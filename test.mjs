import { generate } from "./index.mjs";
const css = String.raw;

const configCSS = css`
@import "preset-uno";
@import "preset-typography";
@import "preset-web-fonts";
@import "preset-tagify";
@import "preset-icons";
@import "preset-attributify";

:theme {
  --color-primary: #232323;
  --font-family-sans: webfont("Inter");
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

const ret = await generate(
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

// animations
assertStringIncludes(ret.css, "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}");
assertStringIncludes(ret.css, ".animate-spin{animation:spin 1s ease 1;}");

// shortcuts
assertStringIncludes(
  ret.css,
  `.custom{font-size:1.125rem;line-height:1.75rem;--un-text-opacity:1;color:rgb(35 35 35 / var(--un-text-opacity));font-weight:700;font-family:"Inter",`,
);

// web fonts
assertStringIncludes(ret.css, "src: url(https://fonts.gstatic.com/s/inter/");

// icons
assertStringIncludes(ret.css, '.i-twemoji-grinning-face-with-smiling-eyes{background:url("data:image/svg+xml;utf8,');
assertStringIncludes(ret.css, '.hover\\:i-twemoji-face-with-tears-of-joy:hover{background:url("data:image/svg+xml;utf8,');

// attributify
assertStringIncludes(ret.css, '.rounded,\n[border~="rounded"]{border-radius:0.25rem;}');
assertStringIncludes(ret.css, '[border~="blue-200"]{--un-border-opacity:1;border-color:rgb(191 219 254 / var(--un-border-opacity));}');
assertStringIncludes(ret.css, '[border~="\\32 "]{border-width:2px;}');

// tagify
assertStringIncludes(ret.css, "flex{display:flex;}");

// typography
assertStringIncludes(ret.css, ".prose :where(");

// extra css
assertStringIncludes(ret.css, "*{padding:0;margin:0}");
assertStringIncludes(ret.css, ".custom{display:flex}");

console.log("✅ All tests passed");
process.exit(0);
