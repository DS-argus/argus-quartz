import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"

type ExplorerSortNode = {
  isFolder: boolean
  children?: ExplorerSortNode[]
  data?: {
    date?: unknown
  } | null
  displayName?: string
}

componentRegistry.setOptionOverrides("explorer", {
  sortFn: (a: ExplorerSortNode, b: ExplorerSortNode) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1
    }

    if (a.isFolder && b.isFolder) {
      return (a.displayName || "").localeCompare(b.displayName || "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }

    const aTime = Date.parse(String(a.data?.date ?? ""))
    const bTime = Date.parse(String(b.data?.date ?? ""))

    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime
    }

    if (!Number.isNaN(aTime) && Number.isNaN(bTime)) return -1
    if (Number.isNaN(aTime) && !Number.isNaN(bTime)) return 1

    return (a.displayName || "").localeCompare(b.displayName || "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  },
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
