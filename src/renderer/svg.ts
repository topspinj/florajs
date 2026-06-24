import type { LayoutResult, LayoutNode, LayoutEdge, FloraTheme, FloraOptions } from "../types.js";
import { defaultTheme } from "../themes/default.js";

function mergeTheme(partial?: Partial<FloraTheme>): FloraTheme {
  if (!partial) return defaultTheme;
  return {
    ...defaultTheme,
    ...partial,
    nodeColors: { ...defaultTheme.nodeColors, ...partial.nodeColors },
    edgeColors: { ...defaultTheme.edgeColors, ...partial.edgeColors },
    nodePadding: { ...defaultTheme.nodePadding, ...partial.nodePadding },
  };
}

function svgElement(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function renderDefs(svg: SVGSVGElement, theme: FloraTheme): void {
  const defs = svgElement("defs", {}) as SVGDefsElement;

  if (theme.shadow) {
    const filter = svgElement("filter", { id: "flora-shadow", x: "-10%", y: "-10%", width: "130%", height: "130%" });
    const blur = svgElement("feGaussianBlur", { in: "SourceAlpha", stdDeviation: "3" });
    const offset = svgElement("feOffset", { dx: "0", dy: "2", result: "shadow" });
    const flood = svgElement("feFlood", { "flood-color": "#000000", "flood-opacity": "0.08" });
    const composite = svgElement("feComposite", { in2: "shadow", operator: "in" });
    const merge = svgElement("feMerge", {});
    const mergeNode1 = svgElement("feMergeNode", {});
    const mergeNode2 = svgElement("feMergeNode", { in: "SourceGraphic" });
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);
    filter.append(blur, offset, flood, composite, merge);
    defs.appendChild(filter);
  }

  const marker = svgElement("marker", {
    id: "flora-arrowhead",
    markerWidth: "10",
    markerHeight: "7",
    refX: "10",
    refY: "3.5",
    orient: "auto",
  });
  const arrowPath = svgElement("polygon", { points: "0 0, 10 3.5, 0 7" });
  arrowPath.setAttribute("fill", theme.edgeColors.stroke);
  marker.appendChild(arrowPath);
  defs.appendChild(marker);

  svg.appendChild(defs);
}

function renderNode(node: LayoutNode, theme: FloraTheme, options: FloraOptions): SVGGElement {
  const group = svgElement("g", { class: "flora-node", "data-id": node.id }) as SVGGElement;
  group.style.cursor = options.onNodeClick ? "pointer" : "default";

  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;

  let shape: SVGElement;

  switch (node.shape) {
    case "diamond": {
      const points = [
        `${node.x},${y}`,
        `${node.x + node.width / 2},${node.y}`,
        `${node.x},${y + node.height}`,
        `${node.x - node.width / 2},${node.y}`,
      ].join(" ");
      shape = svgElement("polygon", {
        points,
        fill: theme.nodeColors.fill,
        stroke: theme.nodeColors.stroke,
        "stroke-width": "1.5",
      });
      break;
    }
    case "circle": {
      const r = Math.min(node.width, node.height) / 2;
      shape = svgElement("circle", {
        cx: node.x,
        cy: node.y,
        r,
        fill: theme.nodeColors.fill,
        stroke: theme.nodeColors.stroke,
        "stroke-width": "1.5",
      });
      break;
    }
    case "stadium": {
      const r = node.height / 2;
      shape = svgElement("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: r,
        ry: r,
        fill: theme.nodeColors.fill,
        stroke: theme.nodeColors.stroke,
        "stroke-width": "1.5",
      });
      break;
    }
    case "rounded":
      shape = svgElement("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius * 2,
        ry: theme.nodeRadius * 2,
        fill: theme.nodeColors.fill,
        stroke: theme.nodeColors.stroke,
        "stroke-width": "1.5",
      });
      break;
    default:
      shape = svgElement("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius,
        ry: theme.nodeRadius,
        fill: theme.nodeColors.fill,
        stroke: theme.nodeColors.stroke,
        "stroke-width": "1.5",
      });
  }

  if (theme.shadow) {
    shape.setAttribute("filter", "url(#flora-shadow)");
  }

  group.appendChild(shape);

  const text = svgElement("text", {
    x: node.x,
    y: node.y,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    fill: theme.nodeColors.text,
    "font-family": theme.fontFamily,
    "font-size": theme.fontSize,
    "font-weight": "500",
  });
  text.textContent = node.label;
  group.appendChild(text);

  if (options.interactive !== false) {
    group.addEventListener("mouseenter", () => {
      shape.setAttribute("stroke-width", "2.5");
      options.onNodeHover?.(node.id);
    });
    group.addEventListener("mouseleave", () => {
      shape.setAttribute("stroke-width", "1.5");
      options.onNodeHover?.(null);
    });
    if (options.onNodeClick) {
      group.addEventListener("click", () => options.onNodeClick!(node.id));
    }
  }

  return group;
}

function buildEdgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";

  let d = `M ${points[0]!.x} ${points[0]!.y}`;

  if (points.length === 2) {
    d += ` L ${points[1]!.x} ${points[1]!.y}`;
    return d;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const cpx1 = (prev.x + curr.x) / 2;
    const cpy1 = (prev.y + curr.y) / 2;
    const cpx2 = (curr.x + next.x) / 2;
    const cpy2 = (curr.y + next.y) / 2;

    if (i === 1) {
      d += ` Q ${curr.x} ${curr.y} ${cpx2} ${cpy2}`;
    } else {
      d += ` T ${cpx2} ${cpy2}`;
    }
  }

  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function renderEdge(edge: LayoutEdge, theme: FloraTheme): SVGGElement {
  const group = svgElement("g", { class: "flora-edge" }) as SVGGElement;

  const path = svgElement("path", {
    d: buildEdgePath(edge.points),
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": theme.edgeWidth,
    "marker-end": "url(#flora-arrowhead)",
  });

  if (edge.style === "dotted") {
    path.setAttribute("stroke-dasharray", "5,5");
  } else if (edge.style === "thick") {
    path.setAttribute("stroke-width", String(theme.edgeWidth * 2));
  }

  group.appendChild(path);

  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const mid = edge.points[midIdx]!;

    const bg = svgElement("rect", {
      x: mid.x - edge.label.length * 4,
      y: mid.y - 10,
      width: edge.label.length * 8,
      height: 20,
      rx: "4",
      fill: "white",
      opacity: "0.9",
    });
    group.appendChild(bg);

    const text = svgElement("text", {
      x: mid.x,
      y: mid.y,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      fill: theme.edgeColors.label,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 2,
    });
    text.textContent = edge.label;
    group.appendChild(text);
  }

  return group;
}

function addZoomPan(svg: SVGSVGElement, content: SVGGElement): void {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  function updateTransform(): void {
    content.setAttribute("transform", `translate(${translateX},${translateY}) scale(${scale})`);
  }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.1, Math.min(5, scale * delta));
    updateTransform();
  });

  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  svg.addEventListener("mouseup", () => {
    isPanning = false;
    svg.style.cursor = "grab";
  });

  svg.addEventListener("mouseleave", () => {
    isPanning = false;
    svg.style.cursor = "grab";
  });

  svg.style.cursor = "grab";
}

export function renderSVG(layout: LayoutResult, options: FloraOptions = {}): SVGSVGElement {
  const theme = mergeTheme(options.theme);
  const padding = 40;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  svg.style.background = theme.background;

  renderDefs(svg, theme);

  const content = svgElement("g", { transform: `translate(${padding},${padding})` }) as SVGGElement;

  for (const edge of layout.edges) {
    content.appendChild(renderEdge(edge, theme));
  }

  for (const node of layout.nodes) {
    content.appendChild(renderNode(node, theme, options));
  }

  svg.appendChild(content);

  if (options.interactive !== false) {
    addZoomPan(svg, content);
  }

  return svg;
}
