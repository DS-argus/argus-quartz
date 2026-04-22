import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import RecentNotesForIndex from "./quartz/components/RecentNotesForsIndex"
// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    RecentNotesForIndex,

    Component.Comments({
      provider: 'giscus',
      options: {
        // data-repo
        repo: 'DS-argus/argus-quartz',
        // data-repo-id
        repoId: 'R_kgDOOrrNNg',
        // data-category
        category: 'General',
        // data-category-id
        categoryId: 'DIC_kwDOOrrNNs4CqVtc',
        mapping: 'pathname',
      }
    })
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/DS-argus/argus-quartz",
      "LinkedIn": "https://www.linkedin.com/in/soungmin-park-081580203/",
      // "Naver Blog": "https://blog.naver.com/parksoungpark"
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleHeader(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    // Component.Explorer({
    //   mapFn: (node) => {
    //     if (node.isFolder) {
    //       node.displayName = "📁 " + node.displayName
    //     } else {
    //       node.displayName = "📄 " + node.displayName
    //     }
    //   },
    // })
    Component.Explorer({
      useSavedState: false
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
