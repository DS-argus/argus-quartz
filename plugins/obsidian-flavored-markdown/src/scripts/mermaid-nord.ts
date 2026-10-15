// Nord theme ported from the local Obsidian nord-mermaid plugin settings.
// The site is always dark, so one fixed configuration is enough.
// Options left out here are Mermaid defaults, which match those settings.

const COLORS = {
  background: "#333945",
  nodeFill: "#3B4252",
  nodeBorder: "#81A1C1",
  nodeText: "#ECEFF4",
  text: "#D8DEE9",
  line: "#9EAFCC",
  edgeLabelBackground: "#333945",
  clusterFill: "#2E3440",
  clusterBorder: "#4C566A",
  secondaryFill: "#434C5E",
  noteFill: "#434C5E",
  noteBorder: "#EBCB8B",
  noteText: "#ECEFF4",
  paletteText: "#2E3440",
};

const PALETTE = [
  "#88C0D0",
  "#81A1C1",
  "#A3BE8C",
  "#EBCB8B",
  "#D08770",
  "#B48EAD",
  "#8FBCBB",
  "#5E81AC",
];

// Gantt states without a matching base color.
const GANTT_CRITICAL_FILL = "#4A3B45";
const GANTT_CRITICAL_BORDER = "#BF616A";

const FONT_SIZE = 13;
const SPACING = 50;

// gantt, journey, timeline, sequence and C4 size their text from their own config.
const scaled = (base: number) => Math.round((FONT_SIZE * base) / 16);

const palette = (i: number) => PALETTE[i % PALETTE.length]!;

function themeVariables(fontFamily: string) {
  const c = COLORS;
  const vars: Record<string, unknown> = {
    darkMode: true,
    background: c.background,
    fontFamily,
    fontSize: `${FONT_SIZE}px`,

    primaryColor: c.nodeFill,
    primaryBorderColor: c.nodeBorder,
    primaryTextColor: c.nodeText,
    secondaryColor: c.secondaryFill,
    tertiaryColor: c.clusterFill,
    textColor: c.text,
    titleColor: c.nodeText,
    lineColor: c.line,
    arrowheadColor: c.line,

    // flowchart, class, state, ER
    mainBkg: c.nodeFill,
    nodeBorder: c.nodeBorder,
    nodeTextColor: c.nodeText,
    classText: c.nodeText,
    defaultLinkColor: c.line,
    edgeLabelBackground: c.edgeLabelBackground,
    clusterBkg: c.clusterFill,
    clusterBorder: c.clusterBorder,
    stateBkg: c.nodeFill,
    stateLabelColor: c.nodeText,
    transitionColor: c.line,
    transitionLabelColor: c.text,
    compositeBackground: c.clusterFill,
    altBackground: c.clusterFill,
    compositeTitleBackground: c.nodeFill,
    compositeBorder: c.clusterBorder,
    rowOdd: c.nodeFill,
    rowEven: c.secondaryFill,
    attributeBackgroundColorOdd: c.nodeFill,
    attributeBackgroundColorEven: c.secondaryFill,
    relationColor: c.line,
    relationLabelBackground: c.edgeLabelBackground,
    relationLabelColor: c.text,

    // sequence
    actorBkg: c.nodeFill,
    actorBorder: c.nodeBorder,
    actorTextColor: c.nodeText,
    actorLineColor: c.clusterBorder,
    signalColor: c.text,
    signalTextColor: c.text,
    labelBoxBkgColor: c.nodeFill,
    labelBoxBorderColor: c.nodeBorder,
    labelTextColor: c.nodeText,
    loopTextColor: c.text,
    activationBkgColor: c.secondaryFill,
    activationBorderColor: c.nodeBorder,
    sequenceNumberColor: c.background,
    noteBkgColor: c.noteFill,
    noteBorderColor: c.noteBorder,
    noteTextColor: c.noteText,

    // gantt
    sectionBkgColor: c.secondaryFill,
    sectionBkgColor2: c.secondaryFill,
    altSectionBkgColor: c.background,
    gridColor: c.clusterBorder,
    taskBkgColor: c.nodeFill,
    taskBorderColor: c.nodeBorder,
    taskTextColor: c.nodeText,
    taskTextLightColor: c.nodeText,
    taskTextDarkColor: c.text,
    taskTextOutsideColor: c.text,
    taskTextClickableColor: palette(0),
    activeTaskBkgColor: c.secondaryFill,
    activeTaskBorderColor: palette(0),
    doneTaskBkgColor: c.clusterFill,
    doneTaskBorderColor: c.clusterBorder,
    critBkgColor: GANTT_CRITICAL_FILL,
    critBorderColor: GANTT_CRITICAL_BORDER,
    todayLineColor: GANTT_CRITICAL_BORDER,
    excludeBkgColor: c.clusterFill,
    vertLineColor: c.line,

    // pie
    pieTitleTextColor: c.text,
    pieSectionTextColor: c.paletteText,
    pieLegendTextColor: c.text,
    pieStrokeColor: c.background,
    pieOuterStrokeColor: c.clusterBorder,
    pieOpacity: "1",

    // git
    commitLabelColor: c.text,
    commitLabelBackground: c.secondaryFill,
    tagLabelColor: c.nodeText,
    tagLabelBackground: c.nodeFill,
    tagLabelBorder: c.nodeBorder,

    // Mermaid copies overrides back after deriving colors, so nested objects must be complete.
    xyChart: {
      backgroundColor: c.background,
      titleColor: c.text,
      xAxisTitleColor: c.text,
      xAxisLabelColor: c.text,
      xAxisTickColor: c.line,
      xAxisLineColor: c.line,
      yAxisTitleColor: c.text,
      yAxisLabelColor: c.text,
      yAxisTickColor: c.line,
      yAxisLineColor: c.line,
      plotColorPalette: PALETTE.join(","),
    },

    archEdgeColor: c.line,
    archEdgeArrowColor: c.line,
    archGroupBorderColor: c.clusterBorder,
  };

  // mindmap, timeline, kanban
  for (let i = 0; i < 12; i++) {
    vars[`cScale${i}`] = palette(i);
    vars[`cScalePeer${i}`] = palette(i);
    vars[`cScaleInv${i}`] = c.line;
    vars[`cScaleLabel${i}`] = c.paletteText;
    vars[`pie${i + 1}`] = palette(i);
  }
  // git graph, user journey
  for (let i = 0; i < 8; i++) {
    vars[`git${i}`] = palette(i);
    vars[`gitInv${i}`] = c.paletteText;
    vars[`gitBranchLabel${i}`] = c.paletteText;
    vars[`fillType${i}`] = palette(i);
    if (i < 6) vars[`actor${i}`] = palette(i);
  }
  return vars;
}

// Mermaid scopes themeCSS to each diagram's SVG id.
const THEME_CSS = [
  `.node :is(rect, path, polygon, circle, ellipse) { stroke-width: 1px; }`,
  `.edge-thickness-normal { stroke-width: 1px; }`,
  `.edge-thickness-thick { stroke-width: 3.5px; }`,
  // classDef/style colors are inline !important and cannot be recolored, so they are dimmed.
  `.node :is(rect, path, polygon, circle, ellipse)[style*="fill"] { fill-opacity: 0.25; stroke-width: 2px; }`,
  // Korean labels wrap between words instead of inside them.
  `foreignObject div { word-break: keep-all; overflow-wrap: anywhere; }`,
  // Mermaid hard-codes these colors for a light background.
  `:is(.mindmap-node, .journey-section, .task) :is(span, div, p) { color: ${COLORS.paletteText}; }`,
  `.lineWrapper line { stroke: ${COLORS.line}; }`,
  `marker circle[fill="white"] { fill: ${COLORS.background}; }`,
  // C4 draws relations and boundaries in fixed dark gray and element text in white.
  `:is(line, path)[stroke="#444444"] { stroke: ${COLORS.line}; }`,
  `text[fill="#444444"] { fill: ${COLORS.text}; }`,
  // Boundaries are drawn after their elements, so they keep a transparent fill.
  `rect[stroke="#444444"] { stroke: ${COLORS.clusterBorder}; }`,
  `g:has(> rect[stroke="#444444"]) > text { fill: ${COLORS.nodeText}; }`,
  `.person-man > text[fill="#FFFFFF"] { fill: ${COLORS.nodeText}; }`,
  // The person icon is an opaque PNG on a fixed blue square. Darkening the square below
  // the node fill and blending with lighten leaves only the figure.
  `.person-man > image { filter: grayscale(1) contrast(3); mix-blend-mode: lighten; }`,
].join("\n");

const C4_ELEMENTS = [
  "person",
  ...["system", "container", "component"].flatMap((type) => [type, `${type}_db`, `${type}_queue`]),
];

// C4 ignores theme variables and reads element colors and fonts from its own config.
function c4Config(fontFamily: string) {
  const c = COLORS;
  const config: Record<string, unknown> = {
    boundaryFontFamily: fontFamily,
    boundaryFontSize: scaled(14),
    messageFontFamily: fontFamily,
    messageFontSize: scaled(12),
  };
  for (const element of C4_ELEMENTS) {
    for (const [key, bg, border] of [
      [element, c.nodeFill, c.nodeBorder],
      [`external_${element}`, c.secondaryFill, c.clusterBorder],
    ]) {
      config[`${key}_bg_color`] = bg;
      config[`${key}_border_color`] = border;
      config[`${key}FontFamily`] = fontFamily;
      config[`${key}FontSize`] = scaled(14);
    }
  }
  return config;
}

export function nordMermaidConfig(fontFamily: string) {
  return {
    theme: "base",
    fontSize: FONT_SIZE,
    // Sequence diagrams measure and draw all text with these two values.
    fontFamily,
    themeCSS: THEME_CSS,
    themeVariables: themeVariables(fontFamily),
    // state and class diagrams are laid out with these spacing values.
    state: { nodeSpacing: SPACING, rankSpacing: SPACING },
    class: { nodeSpacing: SPACING, rankSpacing: SPACING },
    gantt: { fontSize: scaled(11), sectionFontSize: scaled(11) },
    // Arrays in initialize() are appended to Mermaid's defaults, so journey colors use theme variables.
    journey: { taskFontSize: scaled(14), taskFontFamily: fontFamily, titleFontFamily: fontFamily },
    timeline: { taskFontSize: scaled(14), taskFontFamily: fontFamily },
    c4: c4Config(fontFamily),
  };
}
