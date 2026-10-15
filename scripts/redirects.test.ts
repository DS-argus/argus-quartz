import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { Assets } from "../quartz/plugins/emitters/assets"
import type { BuildCtx } from "../quartz/util/ctx"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const redirectsPath = path.join(repositoryRoot, "content", "_redirects")
const auditPath = path.join(repositoryRoot, ".seo-audit", "url-mapping-2026-10-15.csv")

type AuditRow = {
  old_url: string
  new_url: string
  classification: string
  evidence: string
}

type RedirectRule = {
  source: string
  destination: string
  status: string
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      row.push(field)
      if (row.length !== 1 || row[0] !== "") rows.push(row)
      row = []
      field = ""
      if (char === "\r" && input[i + 1] === "\n") i++
    } else if (char === '"') {
      throw new Error("Unexpected quote in an unquoted CSV field")
    } else {
      field += char
    }
  }

  if (inQuotes) throw new Error("Unterminated quoted CSV field")
  if (row.length > 0 || field.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function parseAuditRows(input: string): AuditRow[] {
  const [header, ...rows] = parseCsv(input)
  assert.deepEqual(header, ["old_url", "new_url", "classification", "evidence"])

  return rows.map((fields) => {
    assert.equal(fields.length, header.length, "CSV rows must match the header width")
    return Object.fromEntries(header.map((name, index) => [name, fields[index]])) as AuditRow
  })
}

function routePath(url: string): string {
  const origin = "https://study-addiction.pages.dev"
  const parsed = new URL(url)
  assert.equal(parsed.origin, origin)
  assert.equal(parsed.search, "")
  assert.equal(parsed.hash, "")
  assert.ok(url.startsWith(origin))
  return url.slice(origin.length) || "/"
}

function parseRedirectRules(input: string): RedirectRule[] {
  return input
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"))
    .map((line) => {
      const fields = line.trim().split(/\s+/)
      assert.equal(fields.length, 3, `Redirect rule must have three fields: ${line}`)
      const [source, destination, status] = fields
      return { source, destination, status }
    })
}

test("redirect rules exactly match confirmed audit mappings", async () => {
  const auditRows = parseAuditRows(await readFile(auditPath, "utf8"))
  const confirmed = auditRows.filter((row) => row.classification === "confirmed")
  const unmatched = auditRows.filter((row) => row.classification === "no_match")
  const rules = parseRedirectRules(await readFile(redirectsPath, "utf8"))

  assert.equal(auditRows.length, 68)
  assert.equal(confirmed.length, 66)
  assert.equal(unmatched.length, 2)
  assert.ok(confirmed.some((row) => row.old_url.includes("Task,-Operator,-Sensor")))
  assert.equal(rules.length, 66)
  assert.equal(new Set(rules.map((rule) => rule.source)).size, 66, "Sources must be unique")
  assert.equal(
    new Set(rules.map((rule) => rule.destination)).size,
    63,
    "Destinations must match the audit",
  )

  const sourceSet = new Set(rules.map((rule) => rule.source))
  for (const { source, destination, status } of rules) {
    assert.equal(status, "301", `Redirect from ${source} must be permanent`)
    assert.ok(
      source.startsWith("/") && !source.startsWith("//"),
      `Source must be a relative route: ${source}`,
    )
    assert.ok(
      destination.startsWith("/") && !destination.startsWith("//"),
      `Destination must be a relative route: ${destination}`,
    )
    assert.notEqual(source, destination, `Self redirect: ${source}`)
    assert.equal(
      sourceSet.has(destination),
      false,
      `Redirect chains and cycles are not allowed: ${source} -> ${destination}`,
    )
  }

  assert.deepEqual(
    rules,
    confirmed.map(({ old_url, new_url }) => ({
      source: routePath(old_url),
      destination: routePath(new_url),
      status: "301",
    })),
  )
  for (const row of unmatched) {
    assert.equal(row.new_url, "", `No-match row must not have a destination: ${row.old_url}`)
    assert.equal(
      sourceSet.has(routePath(row.old_url)),
      false,
      `No-match URL must not be redirected: ${row.old_url}`,
    )
  }
})

test("Assets copies extensionless _redirects to the output root byte-for-byte", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "quartz-redirects-test-"))
  const inputDirectory = path.join(temporaryDirectory, "content")
  const outputDirectory = path.join(temporaryDirectory, "public")

  try {
    await mkdir(inputDirectory)
    const sourceBytes = await readFile(redirectsPath)
    await writeFile(path.join(inputDirectory, "_redirects"), sourceBytes)

    const ctx = {
      buildId: "redirects-test",
      argv: {
        directory: inputDirectory,
        output: outputDirectory,
        verbose: false,
        serve: false,
        watch: false,
        port: 0,
        wsPort: 0,
      },
      cfg: {
        configuration: { ignorePatterns: [] },
        plugins: { pageTypes: [] },
      },
      allSlugs: [],
      allFiles: [],
      incremental: false,
      virtualPages: [],
    } as unknown as BuildCtx

    const emitResult = Assets().emit(ctx, [], { css: [], js: [], additionalHead: [] })
    const emittedFiles: string[] = []
    if (emitResult instanceof Promise) {
      emittedFiles.push(...(await emitResult))
    } else {
      for await (const emittedFile of emitResult) emittedFiles.push(emittedFile)
    }

    const outputPath = path.join(outputDirectory, "_redirects")
    assert.deepEqual(emittedFiles, [outputPath])
    assert.deepEqual(await readdir(outputDirectory), ["_redirects"])
    assert.deepEqual(await readFile(outputPath), sourceBytes)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})
