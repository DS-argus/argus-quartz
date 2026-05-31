import { h } from "preact"

const GOOGLE_SITE_VERIFICATION = "t0Al_xNiDhFjwcKR2jbAfC-sYr7IlukcBq4cC8YLDmk"

function normalizePermalink(value) {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return undefined

  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
}

function appendUnique(items, value) {
  if (!value || items.includes(value)) return
  items.push(value)
}

function permalinkKey(value) {
  return normalizePermalink(value)?.toLowerCase()
}

export default function PermalinkSlug() {
  return {
    name: "PermalinkSlug",
    markdownPlugins(ctx) {
      return [
        () => {
          return (_tree, file) => {
            const frontmatter = file.data.frontmatter
            const permalink = normalizePermalink(frontmatter?.permalink)
            if (!permalink) return

            const previousSlug = typeof file.data.slug === "string" ? file.data.slug : undefined
            const permalinkPathKey = permalinkKey(permalink)
            const aliases = Array.isArray(file.data.aliases)
              ? file.data.aliases.filter((alias) => {
                  const aliasPath = normalizePermalink(alias)
                  return aliasPath !== permalink && aliasPath?.toLowerCase() !== permalinkPathKey
                })
              : []

            if (
              previousSlug &&
              previousSlug !== permalink &&
              permalinkKey(previousSlug) !== permalinkPathKey
            ) {
              appendUnique(aliases, previousSlug)
            }

            file.data.slug = permalink
            file.data.aliases = aliases

            appendUnique(ctx.allSlugs, permalink)
          }
        },
      ]
    },
    externalResources() {
      return {
        additionalHead: [
          h("meta", {
            name: "google-site-verification",
            content: GOOGLE_SITE_VERIFICATION,
          }),
        ],
      }
    },
  }
}
