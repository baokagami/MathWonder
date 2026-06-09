import React, { useMemo, useState } from "react";
import { Copy, Code, Check, HelpCircle, RefreshCw } from "lucide-react";

interface TikzRendererProps {
  code: string;
  onCodeChange?: (newCode: string) => void;
  readOnly?: boolean;
}

export const TikzRenderer: React.FC<TikzRendererProps> = ({
  code,
  onCodeChange,
  readOnly = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [localCode, setLocalCode] = useState(code);

  // Sync internal state when prop changes
  React.useEffect(() => {
    setLocalCode(code);
  }, [code]);

  // Main Parser converting TikZ script lines to React SVG entities
  const svgElements = useMemo(() => {
    if (!localCode) return null;

    // Clean comments and normalize lines
    const rawLines = localCode.split(/[;\n]/);
    const lines = rawLines
      .map((l) => l.split("%")[0].trim()) // remove comments
      .filter((l) => l.length > 0 && !l.startsWith("\\begin{tikzpicture}") && !l.startsWith("\\end{tikzpicture}"));

    // Step 1: Discover all coordinates to determine bounding box (Autoboxing)
    const coordRegex = /\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g;
    const coords: [number, number][] = [];
    let match;

    // Standard string search for coordinates
    const contentToSearch = lines.join(" ");
    while ((match = coordRegex.exec(contentToSearch)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      if (!isNaN(x) && !isNaN(y)) {
        coords.push([x, y]);
      }
    }

    // Default coordinate bounds
    let xMin = -3;
    let xMax = 4;
    let yMin = -3;
    let yMax = 4;

    if (coords.length > 0) {
      const xs = coords.map(([cx]) => cx);
      const ys = coords.map(([, cy]) => cy);
      xMin = Math.min(...xs) - 0.5;
      xMax = Math.max(...xs) + 0.5;
      yMin = Math.min(...ys) - 0.5;
      yMax = Math.max(...ys) + 0.5;

      // Ensure some minimum range to prevent division-by-zero or flat charts
      if (xMax - xMin < 1) {
        xMin -= 1;
        xMax += 1;
      }
      if (yMax - yMin < 1) {
        yMin -= 1;
        yMax += 1;
      }
    }

    // Canvas size parameters
    const canvasWidth = 320;
    const canvasHeight = 220;
    const padding = 20;

    // Coordinates mapper to Canvas coordinates
    const mapX = (x: number) => {
      const ratio = (x - xMin) / (xMax - xMin);
      return padding + ratio * (canvasWidth - 2 * padding);
    };

    const mapY = (y: number) => {
      const ratio = (y - yMin) / (yMax - yMin);
      // In Vertices Cartesian, y goes UP, in SVG y goes DOWN
      return canvasHeight - (padding + ratio * (canvasHeight - 2 * padding));
    };

    // Helper to evaluate safe client-side plotting formulas like x^3 - 3x^2 + 2
    const safeEval = (expr: string, x: number): number => {
      try {
        // Safe tokenized evaluation for standard school curves
        let clean = expr
          .toLowerCase()
          .replace(/\\x/g, "x")
          .replace(/{\s*x\s*}/g, "x")
          .replace(/\^/g, "**")
          // handle coefficients e.g. 3*x
          .replace(/(\d+)x/g, "$1*x")
          // Replace common operations
          .replace(/sin/g, "Math.sin")
          .replace(/cos/g, "Math.cos")
          .replace(/tan/g, "Math.tan")
          .replace(/pi/g, "Math.PI");

        // Simple math safe sandbox
        // We evaluate strictly based on basic maths symbols
        const fn = new Function("x", `return ${clean};`);
        const res = fn(x);
        return isNaN(res) || !isFinite(res) ? 0 : res;
      } catch (err) {
        console.warn("Lỗi biên dịch đồ thị hàm số:", err);
        return 0;
      }
    };

    const renderedEntities: React.ReactNode[] = [];

    // Global Unique Key counter
    let keyIdx = 0;

    // Step 2: Parse and render lines
    lines.forEach((line) => {
      try {
        const isDraw = line.startsWith("\\draw") || line.startsWith("draw") || line.startsWith("\\filldraw") || line.startsWith("filldraw");
        const isFill = line.startsWith("\\fill") || line.startsWith("fill");
        const isNode = line.startsWith("\\node") || line.startsWith("node");

        // Parse list of styles from brackets [...] if present
        const styleMatch = line.match(/\[([^\]]+)\]/);
        const styles = styleMatch ? styleMatch[1].split(",").map((s) => s.trim()) : [];

        // Colors lookup
        let strokeColor = "#334155"; // default slate-700
        let fillColor = "none";
        let strokeDash = undefined;
        let strokeW = 1.5;
        let hasMarkerStart = false;
        let hasMarkerEnd = false;

        styles.forEach((style) => {
          if (style.includes("blue")) strokeColor = "#2563eb";
          else if (style.includes("red")) strokeColor = "#dc2626";
          else if (style.includes("green")) strokeColor = "#16a34a";
          else if (style.includes("orange")) strokeColor = "#ea580c";
          else if (style.includes("gray")) strokeColor = "#64748b";
          else if (style.includes("emerald")) strokeColor = "#059669";
          else if (style.includes("amber")) strokeColor = "#d97706";
          else if (style.includes("indigo")) strokeColor = "#4f46e5";

          if (style === "dashed") strokeDash = "4,4";
          else if (style === "dotted") strokeDash = "1.5,3";

          if (style.includes("ultra thin")) strokeW = 0.5;
          else if (style.includes("thin")) strokeW = 1.0;
          else if (style.includes("thick")) strokeW = 2.0;
          else if (style.includes("ultra thick") || style.includes("very thick")) strokeW = 3.0;

          if (style === "->" || style === "latex" || style.includes("->")) hasMarkerEnd = true;
          if (style === "<-" || style.includes("<-")) hasMarkerStart = true;
          if (style === "<->" || style.includes("<->")) {
            hasMarkerStart = true;
            hasMarkerEnd = true;
          }

          // Handle fills inside bracket style styles-sheet
          if (isFill || line.startsWith("\\filldraw")) {
            if (style.includes("fill=blue") || style === "blue") fillColor = "rgba(147, 197, 253, 0.4)";
            else if (style.includes("fill=red") || style === "red") fillColor = "rgba(252, 165, 165, 0.4)";
            else if (style.includes("fill=green") || style === "green") fillColor = "rgba(167, 243, 208, 0.4)";
            else if (style.includes("fill=gray") || style === "gray") fillColor = "rgba(226, 232, 240, 0.5)";
            else if (style.includes("fill=amber") || style === "amber") fillColor = "rgba(253, 230, 138, 0.4)";
            else if (style.includes("fill=indigo") || style === "indigo") fillColor = "rgba(199, 210, 254, 0.4)";
          }
        });

        if (isFill && fillColor === "none") {
          // If pure fill and no style parsed, use lightweight slate fallback fill
          fillColor = "rgba(100, 116, 139, 0.15)";
        }

        // --- SUB-PARSING 1: PLOTTING CURVES ---
        if (isDraw && line.includes("plot")) {
          // Regex for: plot[domain=min:max] (\x, {expression_or_similar})
          // Or: plot (\x, {expression})
          const domainMatch = line.match(/domain\s*=\s*(-?\d*\.?\d+)\s*:\s*(-?\d*\.?\d+)/);
          let plotMin = xMin;
          let plotMax = xMax;
          if (domainMatch) {
            plotMin = parseFloat(domainMatch[1]);
            plotMax = parseFloat(domainMatch[2]);
          }

          // Extract formula inside braces or standard bracket bounds e.g. plot (\x, {expression}) or plot (\x, expression)
          const formulaMatch = line.match(/plot\s*(?:\[[^\]]*\])?\s*\(\s*\\x\s*,\s*\{?([^\}]+)\}?\s*\)/) || 
                               line.match(/plot\s*(?:\[[^\]]*\])?\s*\(\s*\\?x\s*,\s*\{?([^\}]+)\}?\s*\)/);
          
          if (formulaMatch) {
            const expression = formulaMatch[1].trim();
            const steps = 60;
            const points: string[] = [];
            
            for (let i = 0; i <= steps; i++) {
              const xCoord = plotMin + (i / steps) * (plotMax - plotMin);
              const yCoord = safeEval(expression, xCoord);
              
              if (!isNaN(yCoord) && isFinite(yCoord)) {
                points.push(`${mapX(xCoord).toFixed(1)},${mapY(yCoord).toFixed(1)}`);
              }
            }

            if (points.length > 0) {
              renderedEntities.push(
                <polyline
                  key={`plot-${keyIdx++}`}
                  points={points.join(" ")}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={strokeDash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
          }
          return;
        }

        // --- SUB-PARSING 2: DRAWING CIRCLES/ELLIPSES ---
        if ((isDraw || isFill) && (line.includes("circle") || line.includes("ellipse"))) {
          // Extract center coordinate
          const centerMatch = line.match(/\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/);
          if (centerMatch) {
            const cx = mapX(parseFloat(centerMatch[1]));
            const cy = mapY(parseFloat(centerMatch[2]));

            if (line.includes("circle")) {
              // Extract circle radius: circle (1.5) or circle [radius=1.5]
              const rMatch = line.match(/circle\s*\(\s*(-?\d*\.?\d+)\s*\)/) || line.match(/circle\s*\[\s*radius\s*=\s*(-?\d*\.?\d+)\s*\]/);
              if (rMatch) {
                const rVal = parseFloat(rMatch[1]);
                // Map coordinate width to canvas pixel width
                const rx = ((mapX(xMin + rVal) - mapX(xMin)));
                renderedEntities.push(
                  <circle
                    key={`circle-${keyIdx++}`}
                    cx={cx}
                    cy={cy}
                    r={Math.abs(rx)}
                    stroke={(isFill && !line.includes("draw")) ? "none" : strokeColor}
                    strokeWidth={strokeW}
                    strokeDasharray={strokeDash}
                    fill={fillColor}
                  />
                );
              }
            } else if (line.includes("ellipse")) {
              // Extract ellipse dimensions: ellipse (rx and ry)
              const ellipseMatch = line.match(/ellipse\s*\(\s*(-?\d*\.?\d+)\s+and\s+(-?\d*\.?\d+)\s*\)/);
              if (ellipseMatch) {
                const rValX = parseFloat(ellipseMatch[1]);
                const rValY = parseFloat(ellipseMatch[2]);
                const rx = Math.abs(mapX(xMin + rValX) - mapX(xMin));
                const ry = Math.abs(mapY(yMin + rValY) - mapY(yMin));
                
                renderedEntities.push(
                  <ellipse
                    key={`ellipse-${keyIdx++}`}
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    stroke={(isFill && !line.includes("draw")) ? "none" : strokeColor}
                    strokeWidth={strokeW}
                    strokeDasharray={strokeDash}
                    fill={fillColor}
                  />
                );
              }
            }
          }
          return;
        }

        // --- SUB-PARSING 3: RECTANGLES ---
        if ((isDraw || isFill) && line.includes("rectangle")) {
          // Find two coordinates: (x1,y1) rectangle (x2,y2)
          const rectCoords: [number, number][] = [];
          let coordMatch;
          const rectRegex = /\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g;
          while ((coordMatch = rectRegex.exec(line)) !== null) {
            rectCoords.push([parseFloat(coordMatch[1]), parseFloat(coordMatch[2])]);
          }

          if (rectCoords.length >= 2) {
            const x1 = mapX(rectCoords[0][0]);
            const y1 = mapY(rectCoords[0][1]);
            const x2 = mapX(rectCoords[1][0]);
            const y2 = mapY(rectCoords[1][1]);
            
            const rx = Math.min(x1, x2);
            const ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1);
            const rh = Math.abs(y2 - y1);

            renderedEntities.push(
              <rect
                key={`rect-${keyIdx++}`}
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                stroke={(isFill && !line.includes("draw")) ? "none" : strokeColor}
                strokeWidth={strokeW}
                strokeDasharray={strokeDash}
                fill={fillColor}
              />
            );
          }
          return;
        }

        // --- SUB-PARSING 4: NODES ---
        if (isNode) {
          // Match \node [options] at (x,y) {label};
          const atMatch = line.match(/\s*at\s*\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/);
          const labelMatch = line.match(/\{\s*([^}]+)\s*\}/);

          if (atMatch && labelMatch) {
            const cx = mapX(parseFloat(atMatch[1]));
            const cy = mapY(parseFloat(atMatch[2]));
            // Clean up LaTeX formulas wrapping $...$
            let label = labelMatch[1].trim();
            if (label.startsWith("$") && label.endsWith("$")) {
              label = label.substring(1, label.length - 1);
            }

            // Simple text offsets based on above, below, right, left options
            let dy = 4;
            let textAnchor = "middle";

            styles.forEach((style) => {
              if (style.includes("above") || style === "above") dy = -10;
              else if (style.includes("below") || style === "below") dy = 16;
              
              if (style.includes("left") || style === "left") {
                textAnchor = "end";
                if (!style.includes("above") && !style.includes("below")) dy = 4;
              } else if (style.includes("right") || style === "right") {
                textAnchor = "start";
                if (!style.includes("above") && !style.includes("below")) dy = 4;
              }
            });

            // Re-render LaTeX symbols into modern, simple fonts
            // Convert Greek/Math symbols gracefully
            label = label
              .replace(/\\x/g, "x")
              .replace(/\\y/g, "y")
              .replace(/\\phi/g, "φ")
              .replace(/\\pi/g, "π")
              .replace(/\\infty/g, "∞")
              .replace(/\\theta/g, "θ")
              .replace(/-\s*\\vô cùng/gi, "-∞");

            renderedEntities.push(
              <text
                key={`node-${keyIdx++}`}
                x={cx}
                y={cy}
                dy={dy}
                textAnchor={textAnchor}
                className="text-[11px] font-semibold fill-slate-800 font-sans tracking-tight"
              >
                {label}
              </text>
            );
          }
          return;
        }

        // --- SUB-PARSING 5: DRAW LINES / VECTORS (Default '--' fallback loop) ---
        if (isDraw || isFill) {
          // Extract multiple coordinate sequence along the command line
          const lineCoords: [number, number][] = [];
          let coordMatch;
          const lineRegex = /\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g;
          while ((coordMatch = lineRegex.exec(line)) !== null) {
            lineCoords.push([parseFloat(coordMatch[1]), parseFloat(coordMatch[2])]);
          }

          // Render circle point marker if it's a circle fill or coordinate list of circles
          const isDrawCircleDirect = line.includes("circle") || line.includes("fill");

          if (lineCoords.length === 1 && line.includes("circle")) {
            // Drawn already in SUB-PARSING 2
            return;
          }

          if (lineCoords.length === 1 && isFill) {
            // Draw a dot point highlight \fill (x,y) circle (1.5pt);
            const cx = mapX(lineCoords[0][0]);
            const cy = mapY(lineCoords[0][1]);
            
            renderedEntities.push(
              <circle
                key={`point-${keyIdx++}`}
                cx={cx}
                cy={cy}
                r={2.5}
                className="fill-red-600 stroke-white stroke-1 shadow-sm"
              />
            );
            return;
          }

          if (lineCoords.length >= 2) {
            // Format polygon if fill is chosen, else multi-segment line
            if (isFill && !line.includes("draw")) {
              const pointsString = lineCoords.map(([x, y]) => `${mapX(x).toFixed(1)},${mapY(y).toFixed(1)}`).join(" ");
              renderedEntities.push(
                <polygon
                  key={`poly-${keyIdx++}`}
                  points={pointsString}
                  fill={fillColor}
                  stroke="none"
                />
              );
            } else {
              // Map all points along the segment chain
              for (let idx = 0; idx < lineCoords.length - 1; idx++) {
                const x1 = mapX(lineCoords[idx][0]);
                const y1 = mapY(lineCoords[idx][1]);
                const x2 = mapX(lineCoords[idx + 1][0]);
                const y2 = mapY(lineCoords[idx + 1][1]);

                renderedEntities.push(
                  <line
                    key={`line-${keyIdx++}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeDasharray={strokeDash}
                    strokeLinecap="round"
                    markerEnd={hasMarkerEnd && idx === lineCoords.length - 2 ? "url(#arrow-end)" : undefined}
                    markerStart={hasMarkerStart && idx === 0 ? "url(#arrow-start)" : undefined}
                  />
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn("Lỗi phân tích cú pháp Tikz line:", line, err);
      }
    });

    return {
      elements: renderedEntities,
      bounds: { xMin, xMax, yMin, yMax },
      canvas: { width: canvasWidth, height: canvasHeight },
    };
  }, [localCode]);

  const copyTikzCode = () => {
    navigator.clipboard.writeText(localCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition duration-200">
      <div className="bg-slate-50/80 px-4 py-2 flex items-center justify-between border-b border-slate-100 shrink-0 text-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-mono">
            MATHWONDER TIKZ GRAPHIC
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition`}
            title="Đổi giữa Trực quan và Mã nguồn"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={copyTikzCode}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
            title="Sao chép đoạn mã TikZ này"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col md:flex-row items-center gap-4 bg-slate-50/30">
        {/* Dynamic Canvas Container */}
        <div className="relative bg-white border border-slate-150 rounded-xl p-2.5 flex justify-center items-center shadow-3xs aspect-square md:aspect-auto w-full max-w-[340px] md:w-[340px] h-[240px] select-none mx-auto overflow-hidden">
          {/* Paper Draft Grid Background Pattern */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          {svgElements ? (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgElements.canvas.width} ${svgElements.canvas.height}`}
              className="relative z-10 w-full h-full"
            >
              {/* Arrow Definitions for coordinate vector mappings */}
              <defs>
                <marker
                  id="arrow-end"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                </marker>
                <marker
                  id="arrow-start"
                  viewBox="0 0 10 10"
                  refX="2"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 10 1 L 0 5 L 10 9 z" fill="#475569" />
                </marker>
              </defs>
              <g id="tikz-elements">
                {svgElements.elements}
              </g>
            </svg>
          ) : (
            <div className="text-center text-slate-400 text-xs py-8 space-y-2">
              <HelpCircle className="w-6 h-6 mx-auto text-slate-300" />
              <span>Không trích xuất được hình vẽ...</span>
            </div>
          )}
        </div>

        {/* Source Code Panel and Editor if requested */}
        {showSource && (
          <div className="w-full flex-grow space-y-1.5 animate-fadeIn md:max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 font-mono">
                Mã LaTeX TikZ Nguồn:
              </span>
              {!readOnly && onCodeChange && (
                <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                  ⚡ Chế độ chỉnh sửa trực tiếp
                </span>
              )}
            </div>
            <textarea
              value={localCode}
              onChange={(e) => {
                setLocalCode(e.target.value);
                if (onCodeChange) onCodeChange(e.target.value);
              }}
              readOnly={readOnly}
              rows={6}
              className="w-full text-[10px] font-mono leading-relaxed bg-slate-900 text-slate-200 rounded-xl p-3 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner resize-none select-text"
              placeholder="% Hãy khai báo câu lệnh TikZ..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
