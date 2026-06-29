import { useRef, useEffect, useState, type CSSProperties } from "react";
import { render, type RenderResult } from "./index.js";
import type { FloraOptions, ParseWarning, ThemePreset, FloraTheme } from "./types.js";

export interface FloraProps {
  /** Mermaid-compatible diagram source string */
  source: string;
  /** Theme preset name or partial theme object */
  theme?: ThemePreset | Partial<FloraTheme>;
  /** Enable interactive features (zoom, pan, hover, click) */
  interactive?: boolean;
  /** Called when a node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Called when a node is hovered (null when unhovered) */
  onNodeHover?: (nodeId: string | null) => void;
  /** Called when a node is highlighted with its upstream/downstream neighbors */
  onHighlight?: (nodeId: string, upstream: string[], downstream: string[]) => void;
  /** Called after each render with any parse warnings */
  onWarnings?: (warnings: ParseWarning[]) => void;
  /** CSS class name for the container div */
  className?: string;
  /** Inline styles for the container div */
  style?: CSSProperties;
}

export function Flora({
  source,
  theme,
  interactive,
  onNodeClick,
  onNodeHover,
  onHighlight,
  onWarnings,
  className,
  style,
}: FloraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const options: FloraOptions = {
      theme,
      interactive,
      onNodeClick,
      onNodeHover,
      onHighlight,
    };

    const result: RenderResult = render(source, el, options);
    setWarnings(result.warnings);

    return () => {
      el.innerHTML = "";
    };
  }, [source, theme, interactive, onNodeClick, onNodeHover, onHighlight]);

  useEffect(() => {
    if (onWarnings && warnings.length > 0) {
      onWarnings(warnings);
    }
  }, [warnings, onWarnings]);

  return <div ref={containerRef} className={className} style={style} />;
}
