import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { visit } from "unist-util-visit"
import {
  endsWith,
  resolveRelative,
  simplifySlug,
  slugifyFilePath,
  splitAnchor,
  stripSlashes,
  transformLink,
} from "@quartz-community/utils"

const defaultOptions = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
  disableBrokenWikilinks: false,
}

function isAbsoluteUrlWithOptions(url, options = {}) {
  if (options.httpOnly) return /^https?:\/\//i.test(url)
  return /^[a-z][a-z0-9+.-]*:/i.test(url)
}

function normalizePermalink(value) {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return undefined

  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
}

function safeDecodeURI(value) {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

function appendPermalinkLookup(lookup, alias, permalink) {
  const aliasPath = normalizePermalink(alias)
  const permalinkPath = normalizePermalink(permalink)
  if (!aliasPath || !permalinkPath) return

  lookup.set(aliasPath, permalinkPath)
  lookup.set(aliasPath.toLowerCase(), permalinkPath)
}

function appendBasenameCandidate(candidates, alias, permalink) {
  const aliasPath = normalizePermalink(alias)
  const permalinkPath = normalizePermalink(permalink)
  if (!aliasPath || !permalinkPath) return

  const basename = path.posix.basename(aliasPath)
  if (!basename) return

  const canonicals = candidates.get(basename) ?? new Set()
  canonicals.add(permalinkPath)
  candidates.set(basename, canonicals)
}

function registerPermalinkAlias(lookup, candidates, alias, permalink) {
  appendPermalinkLookup(lookup, alias, permalink)
  appendBasenameCandidate(candidates, alias, permalink)
}

function aliasesFromFrontmatter(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") return [value]
  return []
}

function contentDirectoryPrefix(ctx) {
  const directory = String(ctx.argv?.directory ?? "").replaceAll("\\", "/").replace(/\/+$/, "")
  const basename = path.posix.basename(directory)

  return basename && basename !== "." ? basename : undefined
}

function buildPermalinkLookup(ctx) {
  const lookup = new Map()
  const basenameCandidates = new Map()
  const directoryPrefix = contentDirectoryPrefix(ctx)

  for (const filePath of ctx.allFiles ?? []) {
    if (!String(filePath).endsWith(".md")) continue

    try {
      const absolutePath = path.join(ctx.argv.directory, filePath)
      const parsed = matter(fs.readFileSync(absolutePath, "utf8"))
      const permalink = normalizePermalink(parsed.data?.permalink)
      if (!permalink) continue

      registerPermalinkAlias(lookup, basenameCandidates, slugifyFilePath(filePath), permalink)
      registerPermalinkAlias(lookup, basenameCandidates, permalink, permalink)

      if (directoryPrefix && !String(filePath).startsWith(`${directoryPrefix}/`)) {
        registerPermalinkAlias(
          lookup,
          basenameCandidates,
          slugifyFilePath(path.posix.join(directoryPrefix, filePath)),
          permalink,
        )
      }

      for (const alias of aliasesFromFrontmatter(parsed.data?.alias ?? parsed.data?.aliases)) {
        registerPermalinkAlias(lookup, basenameCandidates, slugifyFilePath(`${alias}.md`), permalink)
      }
    } catch {
      // Link processing should continue even if one note has invalid frontmatter.
    }
  }

  for (const [basename, canonicals] of basenameCandidates) {
    if (canonicals.size === 1) {
      appendPermalinkLookup(lookup, basename, [...canonicals][0])
    }
  }

  return lookup
}

function getEffectiveSrc(src, allSlugs) {
  return !endsWith(src, "index") && allSlugs.includes(`${src}/index`) ? `${src}/index` : src
}

function canonicalFromLookup(lookup, slug) {
  return lookup.get(slug) ?? lookup.get(slug.toLowerCase())
}

function linkToCanonical(src, canonical, anchor, allSlugs) {
  return resolveRelative(getEffectiveSrc(src, allSlugs), canonical) + anchor
}

function exactCanonicalTarget(dest, lookup) {
  const [target, anchor] = splitAnchor(safeDecodeURI(dest))
  const normalized = normalizePermalink(target)
  if (!normalized) return undefined

  const canonical = canonicalFromLookup(lookup, normalized)
  if (!canonical) return undefined

  return { canonical, anchor }
}

function fullSlugFromResolvedLink(src, href) {
  const curSlug = simplifySlug(src)
  const url = new URL(href, "https://base.com/" + stripSlashes(curSlug, true))
  const [canonicalRaw, anchor] = splitAnchor(url.pathname)
  let canonical = canonicalRaw
  if (canonical.endsWith("/")) {
    canonical += "index"
  }

  return [decodeURIComponent(stripSlashes(canonical, true)), anchor]
}

function transformPermalinkAwareLink(src, target, opts, permalinkLookup) {
  const exact = exactCanonicalTarget(target, permalinkLookup)
  if (exact) {
    return linkToCanonical(src, exact.canonical, exact.anchor, opts.allSlugs)
  }

  const transformed = transformLink(src, target, opts)
  const [full, anchor] = fullSlugFromResolvedLink(src, transformed)
  const canonical = canonicalFromLookup(permalinkLookup, full)

  if (canonical && canonical !== full) {
    return linkToCanonical(src, canonical, anchor, opts.allSlugs)
  }

  return transformed
}

export const CrawlLinksPermalink = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      const permalinkLookup = buildPermalinkLookup(ctx)

      return [
        () => {
          return (tree, file) => {
            const fileSlug = file.data.slug
            const curSlug = simplifySlug(fileSlug)
            const outgoing = new Set()

            const transformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            visit(tree, "element", (node) => {
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href
                const classes = node.properties.className ?? []
                const isExternal = isAbsoluteUrlWithOptions(dest, { httpOnly: false })
                if (isExternal) {
                  classes.push("external", "external-link")
                } else {
                  classes.push("internal", "internal-link")
                }

                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      "aria-hidden": "true",
                      class: "external-icon",
                      style: "max-width:0.8em;max-height:0.8em",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  })
                }

                const firstChild = node.children[0]
                if (
                  node.children.length === 1 &&
                  firstChild?.type === "text" &&
                  firstChild.value !== dest
                ) {
                  classes.push("alias")
                }
                node.properties.className = classes

                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank"
                }

                const isInternal = !(
                  isAbsoluteUrlWithOptions(dest, { httpOnly: false }) || dest.startsWith("#")
                )
                if (isInternal) {
                  dest = node.properties.href = transformPermalinkAwareLink(
                    fileSlug,
                    dest,
                    transformOptions,
                    permalinkLookup,
                  )

                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true))
                  const canonicalDest = url.pathname
                  const [destCanonicalRaw] = splitAnchor(canonicalDest)
                  let destCanonical = destCanonicalRaw
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index"
                  }

                  const full = decodeURIComponent(stripSlashes(destCanonical, true))
                  const simple = simplifySlug(full)
                  outgoing.add(simple)
                  node.properties["data-slug"] = full

                  if (opts.disableBrokenWikilinks && !ctx.allSlugs.includes(full)) {
                    classes.push("broken")
                    node.properties.className = classes
                  }
                }

                if (opts.prettyLinks && isInternal && node.children.length === 1) {
                  const textChild = node.children[0]
                  if (textChild?.type === "text" && !textChild.value.startsWith("#")) {
                    textChild.value = path.basename(textChild.value)
                  }
                }
              }

              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy"
                }

                if (!isAbsoluteUrlWithOptions(node.properties.src, { httpOnly: false })) {
                  let dest = node.properties.src
                  dest = node.properties.src = transformPermalinkAwareLink(
                    fileSlug,
                    dest,
                    transformOptions,
                    permalinkLookup,
                  )
                  node.properties.src = dest
                }
              }
            })

            const frontmatterLinks = file.data.frontmatterLinks ?? []
            for (const fmLink of frontmatterLinks) {
              const [targetRaw] = splitAnchor(fmLink)
              if (!targetRaw) continue
              const dest = transformPermalinkAwareLink(
                fileSlug,
                targetRaw,
                transformOptions,
                permalinkLookup,
              )
              const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true))
              const [canonicalRaw] = splitAnchor(url.pathname)
              let canonical = canonicalRaw
              if (canonical.endsWith("/")) canonical += "index"
              const full = decodeURIComponent(stripSlashes(canonical, true))
              outgoing.add(simplifySlug(full))
            }

            file.data.links = [...outgoing]
          }
        },
      ]
    },
  }
}

export default CrawlLinksPermalink
