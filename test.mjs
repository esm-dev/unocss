import { generate } from "./index.mjs";

const ret = await generate(
  `
@import "preset-uno";
@import "preset-wind";
@import "preset-typography";
@import "preset-mini";
@import "preset-web-fonts";
@import "preset-tagify";
@import "preset-icons";
@import "preset-attributify";

@theme {
  --color-primary: #232323;
  --font-family-sans: "Inter", sans-serif;
  --font-family-serif: "Merriweather", serif;
  --font-family-mono: "JetBrains Mono", monospace;
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
  @apply text-primary font-bold;
  --uno: text-lg font-serif;
  font-family: var(--font-family-serif);
}
`,
  `<div class="custom">Hello</div>`,
);

console.log(ret.css);
