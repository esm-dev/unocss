import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generate as toCSS, parse, walk } from "css-tree";
import { createGenerator } from "@unocss/core";
import reset from "./reset.mjs";

const unoPresets = new Set([
  "preset-attributify",
  "preset-icons",
  "preset-legacy-compat",
  "preset-mini",
  "preset-rem-to-px",
  "preset-tagify",
  "preset-typography",
  "preset-web-fonts",
  "preset-wind",
  "preset-wind3",
  "preset-wind4",
]);
const themeProperties = [
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "inline-size",
  "block-size",
  "max-inline-size",
  "max-block-size",
  "min-inline-size",
  "min-block-size",
  "colors",
  "font-family",
  "font-size",
  "font-weight",
  "breakpoints",
  "vertical-breakpoints",
  "border-radius",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "box-shadow",
  "text-indent",
  "text-shadow",
  "text-stroke-width",
  "blur",
  "drop-shadow",
  "easing",
  "transition-property",
  "line-width",
  "spacing",
  "duration",
  "ring-width",
  "preflight-base",
  "containers",
  "z-index",
  "media",
  "aria",
  "animation",
  "supports",
];
const woff2UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * @typedef {{
 *  configCSS?: string,
 *  customCacheDir?: string,
 *  iconLoader?: (collectionName: string) => Promise<Record<string, unknown>>
 * }} Options
 */

/** create a UnoCSS generator.
 * @param { Options } options
 * @returns { Promise<{ update: (code: string, id?: string) => Promise<boolean>, generate: (options: import("@unocss/core").GenerateOptions) => Promise<string> }> }
 */
export async function init({ configCSS, customCacheDir, iconLoader } = {}) {
  const presets = [];
  const theme = {};
  const shortcuts = {};
  const preflights = [];
  const webFonts = {};
  const toCamelCase = (str) => str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const extendTheme = (scope, key, value) => {
    (theme[scope] || (theme[scope] = {}))[toCamelCase(key)] = value;
  };
  const extendThemeAnimation = (type, key, value) => {
    const animation = theme.animation || (theme.animation = {});
    (animation[type] || (animation[type] = {}))[toCamelCase(key)] = value;
  };
  const defaultCacheDir = () =>
    process.platform === "win32"
      ? join(process.env.LOCALAPPDATA ?? join(homedir, "AppData", "Local"), "unocss", "Cache")
      : join(homedir(), ".cache", "unocss");
  const parseTheme = (block) => {
    walk(block, (node) => {
      if (node.type === "Declaration") {
        const prop = node.property;
        const value = toCSS(node.value).trim();
        if (prop.startsWith("--color-")) {
          extendTheme("colors", prop.slice(8), value);
        } else if (prop.startsWith("--breakpoint-")) {
          extendTheme("breakpoints", prop.slice(13), value);
        } else if (prop.startsWith("--vertical-breakpoint-")) {
          extendTheme("verticalBreakpoints", prop.slice(22), value);
        } else if (prop.startsWith("--animation-duration-")) {
          extendThemeAnimation("durations", prop.slice(21), value);
        } else if (prop.startsWith("--animation-timing-")) {
          extendThemeAnimation("timingFns", prop.slice(19), value);
        } else if (prop.startsWith("--animation-count-")) {
          extendThemeAnimation("counts", prop.slice(18), value);
        } else {
          const themeScope = themeProperties.find((p) => prop.startsWith("--" + p + "-"));
          if (themeScope) {
            if (themeScope === "font-family") {
              const familyName = toCamelCase(prop.slice(14));
              const anyFonts = [];
              if (node.value.type === "Value" && node.value.children) {
                for (const child of node.value.children) {
                  if (child.type === "Function" && child.name === "webfont" && child.children) {
                    for (const arg of child.children) {
                      if (arg.type === "String") {
                        webFonts[familyName] ?? (webFonts[familyName] = []).push(arg.value);
                      }
                    }
                  } else if (child.type === "String") {
                    anyFonts.push(child.value);
                  }
                }
              }
              if (anyFonts.length > 0) {
                extendTheme("fontFamily", familyName, anyFonts.join(","));
              }
            } else {
              extendTheme(toCamelCase(themeScope), prop.slice(themeScope.length + 3), value);
            }
          }
        }
        return walk.skip;
      }
    });
  };
  let resetCSS = "";
  if (configCSS) {
    const ast = parse(configCSS, { parseCustomProperty: true });
    if (ast.type !== "StyleSheet") {
      throw new Error("Invalid CSS file");
    }
    let webFontsProvider = "none";
    walk(ast, (node) => {
      if (node.type === "Atrule") {
        if (node.name === "import" && node.prelude && node.prelude.type === "AtrulePrelude") {
          const name = node.prelude.children.first;
          if (name && name.type === "String") {
            const [presetName, ...a] = (name.value.startsWith("@unocss/") ? name.value.slice(8) : name.value).split("/");
            if (presetName === "reset") {
              let resetName = "tailwind.css";
              if (a.length > 0) {
                let subPath = a.join("/");
                if (!subPath.endsWith(".css")) {
                  subPath = subPath + ".css";
                }
                if (subPath in reset) {
                  resetName = subPath;
                } else {
                  throw new Error("Invalid reset css: " + subPath);
                }
              }
              resetCSS = reset[resetName];
            } else if (unoPresets.has(presetName) && !presets.includes(presetName)) {
              presets.push(presetName);
              if (presetName === "preset-web-fonts") {
                webFontsProvider = "google";
                if (a.length > 0) {
                  const subPath = a.join("/");
                  if (["google", "bunny", "fontshare"].includes(subPath)) {
                    webFontsProvider = subPath;
                  } else {
                    throw new Error("Invalid webfonts provider: " + subPath + ". Available providers are: google, bunny, fontshare");
                  }
                }
              }
            }
          }
        } else if (node.name === "theme" && node.block) {
          parseTheme(node.block);
        } else if (node.name === "keyframes" && node.block && node.prelude?.type === "AtrulePrelude") {
          const id = node.prelude.children.first;
          if (id && id.type === "Identifier") {
            extendThemeAnimation("keyframes", id.name, toCSS(node.block));
          }
        }
        return walk.skip;
      }
      if (node.type === "Rule" && node.prelude.type === "SelectorList" && node.block) {
        const isSlingleSelector = node.prelude.children.size === 1;
        const firstSelector = node.prelude.children.first.children.first;
        if (isSlingleSelector && firstSelector.type === "PseudoClassSelector" && firstSelector.name === "theme") {
          parseTheme(node.block);
        } else {
          for (const item of node.prelude.children) {
            const selector = item.children.first;
            if (selector.type === "ClassSelector") {
              const className = selector.name;
              const applyAtRule = [];
              const css = [];
              for (const child of node.block.children) {
                if (child.type === "Atrule" && child.name === "apply" && child.prelude) {
                  applyAtRule.push(toCSS(child.prelude));
                } else if (
                  child.type === "Declaration"
                  && (child.property === "--uno" || child.property === "--at-apply" || child.property === "--uno-apply")
                ) {
                  applyAtRule.push(toCSS(child.value).trim());
                } else {
                  css.push(toCSS(child));
                }
              }
              if (applyAtRule.length) {
                shortcuts[className] = applyAtRule.join(" ");
              }
              if (css.length) {
                preflights.push({
                  layer: "utilities",
                  getCSS: (theme) => {
                    return `.${className}{${css.join(";")}}`;
                  },
                });
              }
            } else {
              preflights.push({
                layer: "preflights",
                getCSS: (theme) => {
                  return `${toCSS(item)}${toCSS(node.block)}`;
                },
              });
            }
          }
        }
        return walk.skip;
      }
    });
    for (let i = 0; i < presets.length; i++) {
      const presetName = presets[i];
      const { default: preset } = await importPreset(presetName);
      presets[i] = preset;
      if (presetName === "preset-web-fonts") {
        if (Object.keys(webFonts).length > 0) {
          const cacheDir = (customCacheDir ?? defaultCacheDir()) + "/webfonts";
          presets[i] = preset({
            provider: webFontsProvider,
            fonts: webFonts,
            // disable the default timeout settings
            timeouts: false,
            customFetch: async (url) => {
              if (!existsSync(cacheDir)) {
                await mkdir(cacheDir, { recursive: true });
              }
              const cachePath = cacheDir + "/" + (await shasum(url));
              if (existsSync(cachePath)) {
                return readFile(cachePath, "utf8");
              }
              return new Promise((resolve, reject) => {
                fetch(url, { headers: { "User-Agent": woff2UA } }).then(res => {
                  if (!res.ok) {
                    reject(new Error(`Failed to fetch ${url}: ${res.statusText}`));
                    return;
                  }
                  res.text().then(css => {
                    writeFile(cachePath, css, "utf8").finally(() => {
                      resolve(css);
                    });
                  }, reject);
                }, reject);
                setTimeout(() => reject(new Error("Timeout")), 10 * 1000);
              });
            },
          });
        }
      } else if (presetName === "preset-icons") {
        const cacheDir = (customCacheDir ?? defaultCacheDir()) + "/icons";
        presets[i] = preset({
          cdn: "https://esm.sh/",
          customFetch: async (url) => {
            const { pathname } = new URL(url);
            const [scopeName, collectionName, path, shouldBeVoid] = pathname.slice(1).split("/");
            if (scopeName !== "@iconify-json" || path !== "icons.json" || shouldBeVoid !== undefined) {
              throw new Error("Invalid icon URL: " + url);
            }
            if (!existsSync(cacheDir)) {
              await mkdir(cacheDir, { recursive: true });
            }
            const cachePath = cacheDir + "/" + collectionName + ".json";
            if (existsSync(cachePath)) {
              try {
                return readFile(cachePath, "utf8").then(text => JSON.parse(text));
              } catch {
                // continue to fetch
              }
            }
            return new Promise((resolve, reject) => {
              const p = iconLoader ? iconLoader(collectionName) : fetch(url).then(res => {
                if (!res.ok) {
                  throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
                }
                return res.json();
              });
              p.then(json => {
                writeFile(cachePath, JSON.stringify(json), "utf8").finally(() => {
                  resolve(json);
                });
              }, reject);
              setTimeout(() => reject(new Error("Timeout")), 10 * 1000);
            });
          },
        });
      }
    }
  }

  // add default preset if no preset is provided
  if (presets.length === 0) {
    const { default: presetUno } = await importPreset("preset-wind4");
    presets.push(presetUno);
  }

  const uno = await createGenerator({ presets, theme, shortcuts, preflights });
  const tokens = new Set();

  return {
    update: async (code, id = ".") => {
      const prevSize = tokens.size;
      await uno.applyExtractors(code, id, tokens);
      return tokens.size !== prevSize;
    },
    generate: (options) => {
      if (tokens.size === 0) {
        return resetCSS;
      }
      return uno.generate(tokens, options).then(ret => resetCSS + ret.css);
    },
  };
}

/** Use UnoCSS to generate CSS from the given content.
 * @param { string | string[] } content
 * @param { Options & import("@unocss/core").GenerateOptions<Boolean> } options
 * @returns { Promise<string> }
 */
export async function generate(content, options = {}) {
  const uno = await init(options);
  await uno.update(Array.isArray(content) ? content.join("\n") : content);
  return uno.generate(options);
}

/** Import a UnoCSS preset.
 * @param { string } name
 * @returns { Promise<{default: import("@unocss/core").PresetFactory}> }
 */
function importPreset(name) {
  switch (name) {
    case "preset-attributify":
      return import("@unocss/preset-attributify");
    case "preset-icons":
      return import("@unocss/preset-icons/browser");
    case "preset-legacy-compat":
      return import("@unocss/preset-legacy-compat");
    case "preset-mini":
      return import("@unocss/preset-mini");
    case "preset-rem-to-px":
      return import("@unocss/preset-rem-to-px");
    case "preset-tagify":
      return import("@unocss/preset-tagify");
    case "preset-typography":
      return import("@unocss/preset-typography");
    case "preset-web-fonts":
      return import("@unocss/preset-web-fonts");
    case "preset-wind3":
      return import("@unocss/preset-wind3");
    case "preset-wind":
    case "preset-wind4":
      return import("@unocss/preset-wind4");
    default:
      throw new Error("module not found: " + name);
  }
}

/** Calculate SHA-256 hash of the given string.
 * @param { string } str
 * @returns { Promise<string> }
 */
async function shasum(str) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
