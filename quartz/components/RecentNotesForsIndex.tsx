import { QuartzComponent, QuartzComponentProps } from "./types"
import RecentNotes from "./RecentNotes"

const RecentNotesForIndex: QuartzComponent = (props: QuartzComponentProps) => {
  if (props.fileData.slug === "index") {
    return RecentNotes({
      title: "Recent Notes",
      limit: 5,
      showTags: false,
      // linkToMore: "/all-posts",
    })(props)
  }
  return null
}

export default RecentNotesForIndex