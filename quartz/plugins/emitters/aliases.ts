import {
  FullSlug,
  getFileExtension,
  isAbsoluteURL,
  isRelativeURL,
  joinSegments,
  resolveRelative,
  simplifySlug,
} from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { VFile } from "vfile"
import path from "path"
import { QuartzPluginData } from "../vfile"
import { i18n } from "../../i18n"
import { escapeHTML, unescapeHTML } from "../../util/escape"
import { CustomOgImagesEmitterName } from "./ogImage"

type ShareableFrontmatter = {
  title?: string
  socialDescription?: string
  description?: string
  socialImage?: string
}

function getAbsoluteUrl(baseUrl: string, slug: string) {
  return joinSegments(`https://${baseUrl}`, slug)
}

function getSocialImageData(
  ctx: BuildCtx,
  fileData: QuartzPluginData,
): { imagePath?: string; imageType?: string } {
  const baseUrl = ctx.cfg.configuration.baseUrl
  if (!baseUrl) return {}

  const frontmatter = fileData.frontmatter as ShareableFrontmatter | undefined
  const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
    (emitter) => emitter.name === CustomOgImagesEmitterName,
  )

  let imagePath: string | undefined
  if (usesCustomOgImage) {
    if (frontmatter?.socialImage) {
      imagePath = isAbsoluteURL(frontmatter.socialImage)
        ? frontmatter.socialImage
        : `https://${baseUrl}/static/${frontmatter.socialImage}`
    } else if (fileData.filePath) {
      imagePath = getAbsoluteUrl(baseUrl, `${fileData.slug!}-og-image.webp`)
    } else {
      imagePath = `https://${baseUrl}/static/og-image-brain-repository.png`
    }
  } else {
    imagePath = `https://${baseUrl}/static/og-image-brain-repository.png`
  }

  const imageType = `image/${(getFileExtension(imagePath) ?? ".png").replace(/^\./, "")}`
  return { imagePath, imageType }
}

function buildRedirectHtml(
  ctx: BuildCtx,
  fileData: QuartzPluginData,
  aliasSlug: FullSlug,
  redirectUrl: string,
) {
  const cfg = ctx.cfg.configuration
  const frontmatter = fileData.frontmatter as ShareableFrontmatter | undefined
  const titleSuffix = cfg.pageTitleSuffix ?? ""
  const title =
    (frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
  const description =
    frontmatter?.socialDescription ??
    frontmatter?.description ??
    unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

  const escapedTitle = escapeHTML(title)
  const escapedDescription = escapeHTML(description)
  const siteName = escapeHTML(cfg.pageTitle)

  const baseUrl = cfg.baseUrl
  const aliasAbsoluteUrl = baseUrl ? getAbsoluteUrl(baseUrl, aliasSlug) : undefined
  const redirectAbsoluteUrl = baseUrl ? getAbsoluteUrl(baseUrl, fileData.slug!) : undefined
  const { imagePath, imageType } = getSocialImageData(ctx, fileData)
  const canonicalUrl = redirectAbsoluteUrl ?? redirectUrl

  return `<!DOCTYPE html>
<html lang="en-us">
<head>
<title>${escapedTitle}</title>
<meta charset="utf-8">
<link rel="canonical" href="${escapeHTML(canonicalUrl)}">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="0; url=${escapeHTML(redirectUrl)}">
<meta property="og:site_name" content="${siteName}">
<meta property="og:title" content="${escapedTitle}">
<meta property="og:type" content="website">
<meta property="og:description" content="${escapedDescription}">
<meta property="og:image:alt" content="${escapedDescription}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapedTitle}">
<meta name="twitter:description" content="${escapedDescription}">
<meta name="description" content="${escapedDescription}">
${imagePath ? `<meta property="og:image" content="${escapeHTML(imagePath)}">` : ""}
${imagePath ? `<meta property="og:image:url" content="${escapeHTML(imagePath)}">` : ""}
${imagePath ? `<meta name="twitter:image" content="${escapeHTML(imagePath)}">` : ""}
${imageType ? `<meta property="og:image:type" content="${escapeHTML(imageType)}">` : ""}
${baseUrl ? `<meta property="twitter:domain" content="${escapeHTML(baseUrl)}">` : ""}
${aliasAbsoluteUrl ? `<meta property="og:url" content="${escapeHTML(aliasAbsoluteUrl)}">` : ""}
${aliasAbsoluteUrl ? `<meta property="twitter:url" content="${escapeHTML(aliasAbsoluteUrl)}">` : ""}
</head>
</html>
`
}

async function* processFile(ctx: BuildCtx, file: VFile) {
  const fileData = file.data as QuartzPluginData
  const ogSlug = simplifySlug(fileData.slug!)

  for (const aliasTarget of fileData.aliases ?? []) {
    const aliasTargetSlug = (
      isRelativeURL(aliasTarget)
        ? path.normalize(path.join(ogSlug, "..", aliasTarget))
        : aliasTarget
    ) as FullSlug

    const redirUrl = resolveRelative(aliasTargetSlug, ogSlug)
    yield write({
      ctx,
      content: buildRedirectHtml(ctx, fileData, aliasTargetSlug, redirUrl),
      slug: aliasTargetSlug,
      ext: ".html",
    })
  }
}

export const AliasRedirects: QuartzEmitterPlugin = () => ({
  name: "AliasRedirects",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      yield* processFile(ctx, file)
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue
      if (changeEvent.type === "add" || changeEvent.type === "change") {
        // add new ones if this file still exists
        yield* processFile(ctx, changeEvent.file)
      }
    }
  },
})
