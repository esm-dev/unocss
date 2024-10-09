import { generate as toCSS, parse, walk } from "css-tree";
import { createGenerator } from "@unocss/core";
import presetAttributify from "@unocss/preset-attributify";
import presetIcons from "@unocss/preset-icons";
import presetMini from "@unocss/preset-mini";
import presetTagify from "@unocss/preset-tagify";
import presetTypography from "@unocss/preset-typography";
import presetUno from "@unocss/preset-uno";
import presetWebFonts from "@unocss/preset-web-fonts";
import presetWind, { theme } from "@unocss/preset-wind";

const unoPresets = {
  "preset-uno": presetUno,
  "preset-wind": presetWind,
  "preset-typography": presetTypography,
  "preset-mini": presetMini,
  "preset-web-fonts": presetWebFonts,
  "preset-tagify": presetTagify,
  "preset-icons": presetIcons,
  "preset-attributify": presetAttributify,
};
const themeProperties = Object.keys(theme).map((key) => key.replace(/([A-Z])/g, "-$1").toLowerCase());

export async function generate(configcss, input, options) {
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
            if (themeScope === "font-family" && value.startsWith("webfont(") && value.endsWith(")")) {
              const family = prop.slice(14);
              const fonts = [];
              if (node.value.type === "Value" && node.value.children) {
                for (const child of node.value.children) {
                  if (child.type === "Function" && child.name === "webfont" && child.children) {
                    for (const arg of child.children) {
                      if (arg.type === "String") {
                        fonts.push(arg.value);
                      }
                    }
                  }
                }
              }
              if (fonts.length) {
                webFonts[toCamelCase(family)] = fonts;
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
  const ast = parse(configcss, { parseCustomProperty: true });
  if (ast.type !== "StyleSheet") {
    throw new Error("Invalid CSS file");
  }
  walk(ast, (node) => {
    if (node.type === "Atrule") {
      if (node.name === "import" && node.prelude && node.prelude.type === "AtrulePrelude") {
        const name = node.prelude.children.first;
        if (name && name.type === "String") {
          const preset = unoPresets[name.value];
          if (preset && !presets.includes(preset)) {
            presets.push(preset);
          }
        }
      } else if (node.name === "theme" && node.block) {
        parseTheme(node.block);
      } else if (node.name === "keyframes" && node.block && node.prelude?.type === "AtrulePrelude") {
        const id = node.prelude.children.first;
        if (id && id.type === "Identifier") {
          extendThemeAnimation("keyframes", id.name, "{" + toCSS(node.block) + "}");
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
            const css = [];
            const applyAtRule = [];
            for (const child of node.block.children) {
              if (child.type === "Atrule" && child.name === "apply" && child.prelude) {
                applyAtRule.push(toCSS(child.prelude));
              } else if (child.type === "Declaration" && child.property === "--uno") {
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
                return `${toCSS(item)}{${toCSS(node.block)}}`;
              },
            });
          }
        }
      }
      return walk.skip;
    }
  });
  if (Object.keys(webFonts).length) {
    for (let i = 0; i < presets.length; i++) {
      if (presets[i] === presetWebFonts) {
        presets[i] = presetWebFonts({ provider: "google", fonts: webFonts });
        break;
      }
    }
  }
  if (presets.length === 0) {
    presets.push(presetUno);
  }
  return createGenerator({ presets, theme, shortcuts, preflights }).generate(input, options);
}
