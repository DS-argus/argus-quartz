import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import { h } from "preact"

const GoogleSiteVerification = {
  name: "GoogleSiteVerification",
  additionalHead: () =>
    h("meta", {
      name: "google-site-verification",
      content: "t0Al_xNiDhFjwcKR2jbAfC-sYr7IlukcBq4cC8YLDmk",
    }),
}

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "🧠 Brain Repository",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "google",
      tagId: "G-SX0ZVK7B4H",
    },
    locale: "en-US",
    baseUrl: "study-addiction.pages.dev",
    // For my local notes
    ignorePatterns: ["private", "templates", ".obsidian", "/^\d{3}\..*/"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Gowun Batang",
        body: "Gowun Batang",
        code: "JetBrains Mono",
      },
      // Use theme
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false , enableCheckbox: true}),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents({maxDepth: 6}),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest"}),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      GoogleSiteVerification,
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
