import matter from "gray-matter"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { globbySync } from "globby"

const YAML_DELIMITER = "---"
const TOML_DELIMITER = "+++"
const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7E]+$/

function toPosixPath(filePath) {
  return filePath.replaceAll(path.sep, "/")
}

function stripContentPrefix(filePath) {
  return toPosixPath(filePath).replace(/^content\//, "")
}

function stripMarkdownExtension(filePath) {
  return filePath.replace(/\.md$/i, "")
}

function quartzSluggify(input) {
  return input
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/$/, "")
}

function getQuartzDefaultSlug(filePath) {
  return quartzSluggify(stripMarkdownExtension(stripContentPrefix(filePath)))
}

function normalizeAsciiSource(source) {
  return source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .trim()
}

export function slugifyAsciiLeaf(source) {
  const normalized = normalizeAsciiSource(source)
  if (!normalized || !ASCII_PRINTABLE_PATTERN.test(normalized)) {
    return null
  }

  const slug = normalized
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/@/g, " at ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

  return slug || null
}

export function buildGeneratedPermalink(filePath, source) {
  const leaf = slugifyAsciiLeaf(source)
  if (!leaf) return null

  const relativePath = stripContentPrefix(filePath)
  const relativeDir = path.posix.dirname(relativePath)
  if (relativeDir === ".") {
    return `/${leaf}`
  }

  return `/${relativeDir}/${leaf}`
}

function normalizePermalink(permalink) {
  if (typeof permalink !== "string") return null
  const trimmed = permalink.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
}

function findYamlFrontmatterEnd(lines) {
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === YAML_DELIMITER) {
      return index
    }
  }

  return -1
}

export function upsertPermalink(markdown, permalink) {
  const linebreak = markdown.includes("\r\n") ? "\r\n" : "\n"

  if (markdown.startsWith(`${TOML_DELIMITER}${linebreak}`) || markdown.startsWith(`${TOML_DELIMITER}\n`)) {
    return {
      ok: false,
      reason: "TOML frontmatter is not supported for automatic permalink insertion",
    }
  }

  if (
    markdown.startsWith(`${YAML_DELIMITER}${linebreak}`) ||
    markdown.startsWith(`${YAML_DELIMITER}\n`)
  ) {
    const lines = markdown.split(/\r?\n/)
    const frontmatterEnd = findYamlFrontmatterEnd(lines)
    if (frontmatterEnd === -1) {
      return {
        ok: false,
        reason: "YAML frontmatter is not closed",
      }
    }

    if (lines.slice(1, frontmatterEnd).some((line) => /^\s*permalink\s*:/.test(line))) {
      return {
        ok: true,
        changed: false,
        content: markdown,
      }
    }

    lines.splice(frontmatterEnd, 0, `permalink: ${permalink}`)
    return {
      ok: true,
      changed: true,
      content: lines.join(linebreak),
    }
  }

  return {
    ok: true,
    changed: true,
    content: `${YAML_DELIMITER}${linebreak}permalink: ${permalink}${linebreak}${YAML_DELIMITER}${linebreak}${linebreak}${markdown}`,
  }
}

export function resolvePermalinkSource(filePath, markdown) {
  const parsed = matter(markdown)
  const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : ""
  if (title && slugifyAsciiLeaf(title)) {
    return title
  }

  const fileStem = path.posix.basename(stripMarkdownExtension(toPosixPath(filePath)))
  if (slugifyAsciiLeaf(fileStem)) {
    return fileStem
  }

  return null
}

function hasPermalink(markdown) {
  const parsed = matter(markdown)
  return normalizePermalink(parsed.data.permalink) !== null
}

function buildReservedRouteMap(allMarkdownFiles) {
  const routeOwners = new Map()

  for (const filePath of allMarkdownFiles) {
    if (!existsSync(filePath)) continue

    const markdown = readFileSync(filePath, "utf8")
    const defaultSlug = getQuartzDefaultSlug(filePath)
    const existingPermalink = normalizePermalink(matter(markdown).data.permalink)

    if (!routeOwners.has(defaultSlug)) {
      routeOwners.set(defaultSlug, new Set())
    }
    routeOwners.get(defaultSlug).add(filePath)

    if (existingPermalink) {
      if (!routeOwners.has(existingPermalink)) {
        routeOwners.set(existingPermalink, new Set())
      }
      routeOwners.get(existingPermalink).add(filePath)
    }
  }

  return routeOwners
}

export function ensurePermalinks(markdownFiles) {
  const allMarkdownFiles = globbySync(["content/**/*.md"], { dot: false }).map(toPosixPath)
  const routeOwners = buildReservedRouteMap(allMarkdownFiles)
  const updatedFiles = []
  const errors = []

  for (const filePath of markdownFiles.map(toPosixPath)) {
    if (!existsSync(filePath)) continue

    const markdown = readFileSync(filePath, "utf8")
    if (hasPermalink(markdown)) continue

    const resolvedSource = resolvePermalinkSource(filePath, markdown)
    const permalink = resolvedSource ? buildGeneratedPermalink(filePath, resolvedSource) : null

    if (!permalink) {
      errors.push({
        filePath,
        reason: "Cannot auto-generate permalink from title or filename because both are non-ASCII or unsuitable",
      })
      continue
    }

    const normalizedPermalink = normalizePermalink(permalink)
    const defaultSlug = getQuartzDefaultSlug(filePath)
    const owners = routeOwners.get(normalizedPermalink) ?? new Set()
    const conflictingOwners = [...owners].filter(
      (owner) => !(owner === filePath && normalizedPermalink === defaultSlug),
    )

    if (conflictingOwners.length > 0) {
      errors.push({
        filePath,
        reason: `Generated permalink collides with existing route /${normalizedPermalink}`,
      })
      continue
    }

    const result = upsertPermalink(markdown, permalink)
    if (!result.ok) {
      errors.push({
        filePath,
        reason: result.reason,
      })
      continue
    }

    if (!result.changed) continue

    writeFileSync(filePath, result.content, "utf8")
    updatedFiles.push(filePath)

    if (!routeOwners.has(normalizedPermalink)) {
      routeOwners.set(normalizedPermalink, new Set())
    }
    routeOwners.get(normalizedPermalink).add(filePath)
  }

  return { updatedFiles, errors }
}
