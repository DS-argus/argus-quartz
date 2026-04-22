import { concatenateResources } from "../util/resources"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import ArticleTitleConstructor from "./ArticleTitle"
import ShareButtonConstructor from "./ShareButton"
import styles from "./styles/articleHeader.scss"
import { classNames } from "../util/lang"

const Title = ArticleTitleConstructor()
const ShareButton = ShareButtonConstructor()

const ArticleHeader: QuartzComponent = (props: QuartzComponentProps) => {
  if (!props.fileData.frontmatter?.title) {
    return null
  }

  return (
    <div class={classNames(props.displayClass, "article-header")}>
      <Title {...props} />
      <ShareButton {...props} />
    </div>
  )
}

ArticleHeader.beforeDOMLoaded = concatenateResources(
  Title.beforeDOMLoaded,
  ShareButton.beforeDOMLoaded,
)
ArticleHeader.afterDOMLoaded = concatenateResources(
  Title.afterDOMLoaded,
  ShareButton.afterDOMLoaded,
)
ArticleHeader.css = concatenateResources(Title.css, ShareButton.css, styles)

export default (() => ArticleHeader) satisfies QuartzComponentConstructor
