const FORCE_DARK_SCRIPT = `
const forceDarkMode = () => {
  const previousTheme = document.documentElement.getAttribute("saved-theme")
  document.documentElement.setAttribute("saved-theme", "dark")
  localStorage.setItem("theme", "dark")
  document.body?.classList.remove("theme-light")
  document.body?.classList.add("theme-dark")
  if (previousTheme !== "dark") {
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: "dark" } }))
  }
}

forceDarkMode()
document.addEventListener("nav", forceDarkMode)
document.addEventListener("render", forceDarkMode)
`

export default function ForceDarkMode() {
  return {
    name: "ForceDarkMode",
    textTransform(_ctx, src) {
      return src
    },
    externalResources() {
      return {
        js: [
          {
            loadTime: "beforeDOMReady",
            contentType: "inline",
            spaPreserve: true,
            script: FORCE_DARK_SCRIPT,
          },
        ],
      }
    },
  }
}
