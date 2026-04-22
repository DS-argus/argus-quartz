// @ts-ignore
import shareButtonScript from "./scripts/sharebutton.inline"
import styles from "./styles/sharebutton.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

type ShareableFrontmatter = {
  permalink?: string
  title?: string
}

function getPermalinkPath(fileData: QuartzComponentProps["fileData"]) {
  const frontmatter = fileData.frontmatter as ShareableFrontmatter | undefined
  const permalink = frontmatter?.permalink?.trim()
  if (!permalink) return undefined

  if (/^https?:\/\//.test(permalink)) {
    return permalink
  }

  return permalink.startsWith("/") ? permalink : `/${permalink}`
}

function getShareUrl(cfg: QuartzComponentProps["cfg"], fileData: QuartzComponentProps["fileData"]) {
  const permalink = getPermalinkPath(fileData)
  if (!permalink) return undefined
  if (/^https?:\/\//.test(permalink)) return permalink

  if (!cfg.baseUrl) return undefined

  const base = new URL(`https://${cfg.baseUrl}`.replace(/\/?$/, "/"))
  return new URL(permalink.slice(1), base).toString()
}

const ShareButton: QuartzComponent = ({ cfg, fileData, displayClass }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as ShareableFrontmatter | undefined
  const shareTitle = frontmatter?.title ?? "Share page"
  const shareUrl = getShareUrl(cfg, fileData)
  const permalinkPath = getPermalinkPath(fileData)

  return (
    <button
      class={classNames(displayClass, "share-button")}
      type="button"
      aria-label="Copy link"
      data-tooltip="Copy link"
      data-idle-tooltip="Copy link"
      data-copied-tooltip="Copied"
      data-error-tooltip="Copy failed"
      data-share-title={shareTitle}
      data-share-url={shareUrl}
      data-share-path={shareUrl ? undefined : permalinkPath}
      data-state="idle"
    >
      <span class="share-button__icon share-button__icon--share" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" focusable="false">
          <path
            d="M15 5.25a2.75 2.75 0 1 1 1.12 2.22l-6.2 3.48c.05.23.08.47.08.72 0 .19-.02.37-.05.55l6.3 3.44A2.75 2.75 0 1 1 15 18.75c0-.21.02-.42.07-.61l-6.3-3.44A2.75 2.75 0 1 1 8.84 9.4l6.13-3.44c-.04-.23-.07-.46-.07-.71Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span class="share-button__icon share-button__icon--success" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" focusable="false">
          <path
            d="M20.03 6.97a.75.75 0 0 1 0 1.06l-9 9a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l3.47 3.47 8.47-8.47a.75.75 0 0 1 1.06 0Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </button>
  )
}

ShareButton.afterDOMLoaded = shareButtonScript
ShareButton.css = styles

export default (() => ShareButton) satisfies QuartzComponentConstructor
