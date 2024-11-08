import { generate as toCSS, parse, walk } from "css-tree";
import { createGenerator } from "@unocss/core";
import { theme } from "@unocss/preset-wind";
import resetCollection from "./reset.mjs";

const unoPresets = new Set([
  "preset-attributify",
  "preset-icons",
  "preset-legacy-compat",
  "preset-mini",
  "preset-rem-to-px",
  "preset-tagify",
  "preset-typography",
  "preset-uno",
  "preset-web-fonts",
  "preset-wind",
]);
const themeProperties = Object.keys(theme).map((key) => key.replace(/([A-Z])/g, "-$1").toLowerCase());

/** create a UnoCSS generator with the given config CSS.
 * @param { string | undefined } configCSS
 * @returns { Promise<{ update: (code: string, id?: string) => Promise<boolean>, generate: (options: import("@unocss/core").GenerateOptions) => Promise<string> }> }
 */
export async function init(configCSS) {
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
            const [presetName, ...reset] = (name.value.startsWith("@unocss/") ? name.value.slice(8) : name.value).split("/");
            if (presetName === "reset") {
              let resetName = "tailwind";
              if (reset.length > 0) {
                let subPath = reset.join("/");
                if (subPath.endsWith(".css")) {
                  subPath = subPath.slice(0, -4);
                }
                if (subPath in resetCollection) {
                  resetName = subPath;
                } else {
                  throw new Error("Invalid reset css: " + subPath);
                }
              }
              resetCSS = resetCollection[resetName];
            } else if (unoPresets.has(presetName) && !presets.includes(presetName)) {
              presets.push(presetName);
              if (presetName === "preset-web-fonts") {
                webFontsProvider = "google";
                if (reset.length > 0) {
                  const subPath = reset.join("/");
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
      const { default: preset } = await import("@unocss/" + presetName);
      presets[i] = preset;
      if (presetName === "preset-web-fonts") {
        if (Object.keys(webFonts).length > 0) {
          presets[i] = preset({ provider: webFontsProvider, fonts: webFonts, timeouts: { warning: 16 * 1000, failure: 15 * 1000 } });
        }
      } else if (presetName === "preset-icons") {
        if (globalThis.Deno) {
          presets[i] = preset({
            cdn: "https://esm.sh/",
            // use deno's module cache system
            customFetch: (url) => import(url, { with: { type: "json" } }),
          });
        }
      }
    }
  }
  if (presets.length === 0) {
    const { presetUno } = await import("@unocss/preset-uno");
    presets.push(presetUno);
  }
  const uno = createGenerator({ presets, theme, shortcuts, preflights });
  const tokenMap = new Map();
  return {
    update: async (code, id = ".") => {
      const tokens = tokenMap.get(id) ?? tokenMap.set(id, new Set()).get(id);
      const prevSize = tokens.size;
      await uno.applyExtractors(code, id, tokens);
      return tokens.size !== prevSize;
    },
    generate: (options) => {
      let tokens;
      if (tokenMap.size === 0) {
        return "";
      }
      if (tokenMap.size === 1) {
        tokens = tokenMap.values().next().value;
      } else {
        tokens = new Set();
        for (const [_, set] of tokenMap) {
          for (const token of set) {
            tokens.add(token);
          }
        }
      }
      return uno.generate(tokens, options).then(ret => resetCSS + ret.css);
    },
  };
}

/** generate CSS with UnoCSS engine.
 * @param { string | string[] } content
 * @param { ({ configCSS?: string } & import("@unocss/core").GenerateOptions<Boolean>) | undefined } options
 * @returns { Promise<string> }
 */
export async function generate(content, options) {
  const uno = await init(options?.configCSS);
  await uno.update(Array.isArray(content) ? content.join("\n") : content);
  return uno.generate(options);
}
