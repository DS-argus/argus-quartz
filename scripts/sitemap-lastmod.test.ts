import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { ContentIndex } from "../plugins/content-index-with-date/dist/index.js"

type FakeFile = { data: Record<string, unknown> }

const created = new Date("2025-06-04T03:00:00.000Z")
// Frontmatter local datetimes are parsed in the build machine's timezone.
const modified = new Date("2026-02-01T00:30:00")

function article(slug: string): [unknown, FakeFile] {
  return [
    { type: "root", children: [] },
    {
      data: {
        slug,
        relativePath: `${slug}.md`,
        frontmatter: { title: "Article", tags: ["docker"] },
        text: "body",
        dates: { created, modified, published: created },
        defaultDateType: "created",
      },
    },
  ]
}

function virtualPage(slug: string): [unknown, FakeFile] {
  return [
    { type: "root", children: [] },
    {
      data: {
        slug,
        relativePath: `${slug}.md`,
        frontmatter: { title: slug, tags: [] },
      },
    },
  ]
}

test("sitemap lastmod uses modified date while RSS and index keep created date", async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "argus-sitemap-lastmod-"))
  try {
    const ctx = {
      argv: { output: outputDirectory },
      cfg: { configuration: { baseUrl: "study-addiction.pages.dev", pageTitle: "README.md" } },
    }
    const plugin = ContentIndex({ enableSiteMap: true, enableRSS: true })
    await plugin.emit(
      ctx as never,
      [
        article("Dev/docker/docker-registry"),
        virtualPage("tags/docker"),
        virtualPage("Dev/"),
      ] as never,
      {} as never,
    )

    const sitemap = await readFile(path.join(outputDirectory, "sitemap.xml"), "utf8")
    const entries = [
      ...sitemap.matchAll(
        /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?\s*<\/url>/g,
      ),
    ]
    assert.deepEqual(
      entries.map(([, loc, lastmod]) => [loc, lastmod]),
      [
        ["https://study-addiction.pages.dev/Dev/docker/docker-registry", "2026-02-01"],
        ["https://study-addiction.pages.dev/tags/docker", undefined],
        ["https://study-addiction.pages.dev/Dev/", undefined],
      ],
    )
    assert.doesNotMatch(sitemap, /undefined|false/)

    const rss = await readFile(path.join(outputDirectory, "index.xml"), "utf8")
    assert.match(
      rss,
      new RegExp(
        `<link>https://study-addiction\\.pages\\.dev/Dev/docker/docker-registry</link>[\\s\\S]*?<pubDate>${created.toUTCString()}</pubDate>`,
      ),
    )

    const index = JSON.parse(
      await readFile(path.join(outputDirectory, "static", "contentIndex.json"), "utf8"),
    )
    assert.equal(index["Dev/docker/docker-registry"].date, created.toISOString())
    assert.equal("lastmod" in index["Dev/docker/docker-registry"], false)
  } finally {
    await rm(outputDirectory, { recursive: true, force: true })
  }
})
