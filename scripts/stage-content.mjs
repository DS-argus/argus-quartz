#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { ensurePermalinks } from "./content/permalink-utils.mjs"

function runGit(args, allowFailure = false) {
  const result = spawnSync("git", args, { encoding: "utf8" })
  if (result.status !== 0 && !allowFailure) {
    const message = result.stderr?.trim() || `git ${args.join(" ")} failed`
    throw new Error(message)
  }
  return (result.stdout || "").trim()
}

function uniq(items) {
  return [...new Set(items)]
}

function sanitizeTarget(rawTarget) {
  let target = rawTarget.trim()
  if (!target) return ""

  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim()
  }

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return ""

  target = target.split("#")[0].split("?")[0].trim()
  if (!target) return ""

  try {
    target = decodeURIComponent(target)
  } catch {
    // ignore malformed URI parts
  }

  target = target.replace(/\\ /g, " ").replace(/\\\(/g, "(").replace(/\\\)/g, ")").trim()

  return target
}

function extractTargets(markdown) {
  const targets = []

  const wikiLinkPattern = /!?\[\[([^\]]+)\]\]/g
  for (const match of markdown.matchAll(wikiLinkPattern)) {
    const raw = (match[1] || "").split("|")[0].trim()
    const target = sanitizeTarget(raw)
    if (target) targets.push(target)
  }

  const mdLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g
  for (const match of markdown.matchAll(mdLinkPattern)) {
    const target = sanitizeTarget(match[1] || "")
    if (target) targets.push(target)
  }

  return uniq(targets)
}

function resolveCandidates(mdFile, linkTarget) {
  const candidates = []
  const mdDir = path.dirname(mdFile)

  if (linkTarget.startsWith("/")) {
    candidates.push(path.normalize(linkTarget.slice(1)))
  } else {
    candidates.push(path.normalize(path.join(mdDir, linkTarget)))
  }

  if (linkTarget.startsWith("content/")) {
    candidates.push(path.normalize(linkTarget))
  }

  if (linkTarget.startsWith("Files/")) {
    candidates.push(path.normalize(path.join("content", linkTarget)))
  }

  if (linkTarget.startsWith("./Files/")) {
    candidates.push(path.normalize(path.join("content", linkTarget.slice(2))))
  }

  if (!linkTarget.includes("/")) {
    candidates.push(path.normalize(path.join("content/Files", linkTarget)))
  }

  return uniq(candidates)
}

function getStagedMarkdownFiles() {
  const changedInContent = runGit([
    "diff",
    "--name-only",
    "--cached",
    "--diff-filter=ACMR",
    "--",
    "content",
  ])
  return changedInContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".md"))
}

function getChangedMarkdownFiles() {
  const staged = runGit(["diff", "--name-only", "--cached", "--diff-filter=ACMR", "--", "content"])

  const unstaged = runGit(["diff", "--name-only", "--diff-filter=ACMR", "--", "content"])

  const untracked = runGit(["ls-files", "--others", "--exclude-standard", "--", "content"])

  return uniq(
    [staged, unstaged, untracked]
      .join("\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith(".md")),
  )
}

function stagePaths(paths) {
  if (paths.length === 0) return
  runGit(["add", "--", ...paths])
}

function main() {
  const args = process.argv.slice(2)
  const showHelp = args.includes("-h") || args.includes("--help")
  const stagedOnly = args.includes("--staged-only")
  const requestedPaths = args.filter((arg) => !arg.startsWith("-"))

  if (showHelp) {
    console.log("Usage:")
    console.log("  npm run stage:content -- <content markdown paths...>")
    console.log("  npm run stage:content -- --staged-only")
    console.log("  npm run stage:content")
    console.log("")
    console.log(
      "When no paths are provided, changed markdown files under content/ are auto-detected.",
    )
    process.exit(0)
  }

  if (requestedPaths.length > 0) {
    stagePaths(requestedPaths)
  } else if (!stagedOnly) {
    const changedMarkdownFiles = getChangedMarkdownFiles()
    if (changedMarkdownFiles.length > 0) {
      stagePaths(changedMarkdownFiles)
      console.log(`Auto-staged changed markdown files: ${changedMarkdownFiles.length}`)
    }
  }

  const markdownFiles = getStagedMarkdownFiles()
  if (markdownFiles.length === 0) {
    console.log("No staged markdown files under content/.")
    console.log("Try: npm run stage:content")
    console.log("Or:  npm run stage:content -- content/path/to/post.md")
    process.exit(0)
  }

  const { updatedFiles, errors } = ensurePermalinks(markdownFiles)
  if (updatedFiles.length > 0) {
    stagePaths(updatedFiles)
    console.log(`Permalinks added: ${updatedFiles.length}`)
    for (const filePath of updatedFiles) {
      console.log(`- ${filePath}`)
    }
  }

  if (errors.length > 0) {
    console.error("Permalink generation failed:")
    for (const error of errors) {
      console.error(`- ${error.filePath}: ${error.reason}`)
    }
    console.error("Add a permalink manually in frontmatter and retry the commit.")
    process.exit(1)
  }

  const linkedAssets = new Set()
  const missingAssets = new Set()

  for (const mdFile of markdownFiles) {
    if (!existsSync(mdFile)) continue

    const markdown = readFileSync(mdFile, "utf8")
    const targets = extractTargets(markdown)

    for (const target of targets) {
      const candidates = resolveCandidates(mdFile, target)
      let matched = false

      for (const candidate of candidates) {
        const normalized = candidate.replace(/\\/g, "/")
        if (!normalized.startsWith("content/Files/")) continue
        if (!existsSync(candidate)) continue
        linkedAssets.add(normalized)
        matched = true
      }

      if (!matched && (target.startsWith("Files/") || !target.includes("/"))) {
        const fallback = path.normalize(path.join("content/Files", path.basename(target)))
        if (existsSync(fallback)) {
          linkedAssets.add(fallback.replace(/\\/g, "/"))
          matched = true
        }
      }

      if (
        !matched &&
        (target.includes("Files/") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(target))
      ) {
        missingAssets.add(target)
      }
    }
  }

  const filesToStage = [...linkedAssets]
  if (filesToStage.length > 0) {
    runGit(["add", "-f", "--", ...filesToStage])
  }

  console.log(`Staged markdown files: ${markdownFiles.length}`)
  console.log(`Linked assets staged: ${filesToStage.length}`)

  if (missingAssets.size > 0) {
    console.log("Referenced assets not found (check path):")
    for (const missing of [...missingAssets].slice(0, 20)) {
      console.log(`- ${missing}`)
    }
    if (missingAssets.size > 20) {
      console.log(`... and ${missingAssets.size - 20} more`)
    }
  }
}

main()
