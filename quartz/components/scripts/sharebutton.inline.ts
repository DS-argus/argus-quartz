const COPY_RESET_DELAY_MS = 1800

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)
  return copied
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_error) {
    return fallbackCopy(text)
  }
}

function getShareUrl(button: HTMLElement) {
  const absoluteUrl = button.dataset.shareUrl
  if (absoluteUrl) return absoluteUrl

  const permalinkPath = button.dataset.sharePath
  if (permalinkPath) {
    return new URL(permalinkPath, window.location.origin).toString()
  }

  return window.location.href
}

function setButtonState(button: HTMLElement, state: "idle" | "copied" | "error") {
  button.dataset.state = state

  const tooltip =
    state === "copied"
      ? button.dataset.copiedTooltip
      : state === "error"
        ? button.dataset.errorTooltip
        : button.dataset.idleTooltip

  if (tooltip) {
    button.dataset.tooltip = tooltip
    button.setAttribute("aria-label", tooltip)
    button.setAttribute("title", tooltip)
  }
}

document.addEventListener("nav", () => {
  const buttons = document.getElementsByClassName("share-button")

  for (const button of buttons) {
    let resetTimer: number | undefined

    const handleClick = async () => {
      const shareUrl = getShareUrl(button as HTMLElement)
      const copied = await copyText(shareUrl)

      setButtonState(button as HTMLElement, copied ? "copied" : "error")

      window.clearTimeout(resetTimer)
      resetTimer = window.setTimeout(() => {
        setButtonState(button as HTMLElement, "idle")
      }, COPY_RESET_DELAY_MS)
    }

    button.addEventListener("click", handleClick)
    window.addCleanup(() => {
      button.removeEventListener("click", handleClick)
      window.clearTimeout(resetTimer)
    })
  }
})
