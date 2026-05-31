import test from "node:test"
import assert from "node:assert/strict"

import {
  buildGeneratedPermalink,
  resolvePermalinkSource,
  shouldSkipAutoPermalink,
  slugifyAsciiLeaf,
  upsertPermalink,
} from "./permalink-utils.mjs"

test("slugifyAsciiLeaf lowercases and normalizes punctuation", () => {
  assert.equal(
    slugifyAsciiLeaf("Python uv - An extremely fast Python package and project manager"),
    "python-uv-an-extremely-fast-python-package-and-project-manager",
  )
})

test("slugifyAsciiLeaf rejects non-ascii text", () => {
  assert.equal(slugifyAsciiLeaf("파이썬 uv 사용법"), null)
})

test("buildGeneratedPermalink lowercases content subdirectories", () => {
  assert.equal(
    buildGeneratedPermalink(
      "content/Dev/Python/Python uv - An extremely fast Python package and project manager.md",
      "Python uv - An extremely fast Python package and project manager",
    ),
    "/dev/python/python-uv-an-extremely-fast-python-package-and-project-manager",
  )
})

test("shouldSkipAutoPermalink skips only root content index", () => {
  assert.equal(shouldSkipAutoPermalink("content/index.md"), true)
  assert.equal(shouldSkipAutoPermalink("content/Dev/index.md"), false)
  assert.equal(shouldSkipAutoPermalink("content/Dev/python/example.md"), false)
})

test("resolvePermalinkSource falls back to ascii file stem when title is non-ascii", () => {
  const markdown = [
    "---",
    "title: 파이썬 uv 사용법",
    "updated: 2026-04-23",
    "---",
    "",
    "Body",
  ].join("\n")

  assert.equal(resolvePermalinkSource("content/Dev/python/python-uv-usage.md", markdown), "python-uv-usage")
})

test("upsertPermalink inserts into existing yaml frontmatter", () => {
  const markdown = ["---", "title: Example", "updated: 2026-04-23", "---", "", "Body"].join("\n")
  const result = upsertPermalink(markdown, "/Dev/Python/example")

  assert.equal(result.ok, true)
  assert.equal(result.changed, true)
  assert.match(result.content, /permalink: \/Dev\/Python\/example/)
})

test("upsertPermalink prepends yaml frontmatter when absent", () => {
  const result = upsertPermalink("Body", "/Dev/Python/example")

  assert.equal(result.ok, true)
  assert.equal(
    result.content,
    ["---", "permalink: /Dev/Python/example", "---", "", "Body"].join("\n"),
  )
})
