import { QuartzTransformerPlugin } from "@quartz-community/types";
import { TransformOptions } from "@quartz-community/utils";

interface CrawlLinksOptions {
  markdownLinkResolution: TransformOptions["strategy"];
  prettyLinks: boolean;
  openLinksInNewTab: boolean;
  lazyLoad: boolean;
  externalLinkIcon: boolean;
  disableBrokenWikilinks: boolean;
}

declare const CrawlLinksPermalink: QuartzTransformerPlugin<Partial<CrawlLinksOptions>>;

export { CrawlLinksPermalink, type CrawlLinksOptions };
export default CrawlLinksPermalink;
