import { generate } from "./index.mjs";
const css = String.raw;

const ret = await generate(
  css`
@import "preset-uno";
@import "preset-wind";
@import "preset-typography";
@import "preset-mini";
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
  --uno: text-primary font-bold flex;
  --uno: text-lg font-sans;
  display: flex;
}

* {
  padding: 0;
  margin: 0;
}
`,
  `
<div class="custom animate-spin">UNO</div>
<div class="i-twemoji-grinning-face-with-smiling-eyes hover:i-twemoji-face-with-tears-of-joy" />
`,
);

function assertStringIncludes(actual, expected) {
  if (!actual.includes(expected)) {
    throw new Error(`Expected ${actual} to include ${expected}`);
  }
}

// preflights
assertStringIncludes(ret.css, '*{padding:0;margin:0}');

// animations
assertStringIncludes(ret.css, '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}');
assertStringIncludes(ret.css, '.animate-spin{animation:spin 1s ease 1;}');

// shortcuts
assertStringIncludes(ret.css, `.custom{display:flex;font-size:1.125rem;line-height:1.75rem;--un-text-opacity:1;color:rgb(35 35 35 / var(--un-text-opacity));font-weight:700;font-family:"Inter",`);

// web fonts
assertStringIncludes(ret.css, 'src: url(https://fonts.gstatic.com/s/inter/');

// icons
assertStringIncludes(ret.css, '.i-twemoji-grinning-face-with-smiling-eyes{background:url("data:image/svg+xml;utf8,');
assertStringIncludes(ret.css, '.hover\\:i-twemoji-face-with-tears-of-joy:hover{background:url("data:image/svg+xml;utf8,');

// extra css
assertStringIncludes(ret.css, '.custom{display:flex}');

console.log("✅ All tests passed");
process.exit(0);
