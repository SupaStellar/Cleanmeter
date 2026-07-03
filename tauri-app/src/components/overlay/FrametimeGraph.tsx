import { useRef, useEffect, useState } from "react";

// Figma 2202:3533 (horizontal) / 2218:3721 (vertical): the wave is a 7px-tall
// band in both layouts — the line rests on the bottom of the band and rises in
// smooth spikes, it never fills the row height.
const BAND_HEIGHT = 7;
const STROKE_WIDTH = 1;
// Deviations below the range floor render near-flat. Without a floor,
// normalizing against the buffer's own min/max stretches sensor jitter across
// the whole band and the line reads as random noise. The floor scales with
// the baseline (RATIO × the rolling minimum, but at least FLOOR_MS) because
// frame-to-frame jitter is proportional to the frametime itself: ±2ms is a
// visible stutter at 7ms (144fps) but ordinary variance at 30ms (33fps).
// Real stutters exceed the floor and still spike to the top of the band.
const RANGE_FLOOR_MS = 2;
const RANGE_FLOOR_RATIO = 0.3;

interface FrametimeGraphProps {
  history: number[];
  /** CSS pixel width, or "fill" to track the parent's width (vertical layout). */
  width: number | "fill";
}

export function FrametimeGraph({ history, width }: FrametimeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (width !== "fill") return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      setMeasuredWidth(entries[0].contentRect.width);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [width]);

  const drawWidth = width === "fill" ? measuredWidth : width;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2 || drawWidth < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = drawWidth * dpr;
    const targetH = BAND_HEIGHT * dpr;

    if (sizeRef.current.w !== targetW || sizeRef.current.h !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      sizeRef.current = { w: targetW, h: targetH };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, BAND_HEIGHT);

    // Figma 2202:3552: stroke is a horizontal linear gradient — white fading
    // in 0→23%, opaque 23→79%, fading out 79→100%. Stops apply to the canvas's
    // CSS pixel width so the fade tracks the visible graph, not the DPR-scaled
    // backing store.
    const grad = ctx.createLinearGradient(0, 0, drawWidth, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.23, "rgba(255,255,255,1)");
    grad.addColorStop(0.79, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = STROKE_WIDTH;
    // Figma vector: strokeCap ROUND (the two line ends) but default MITER
    // joins — miter extends each spike vertex into a sharp needle tip, while
    // a round join would cap it with an arc and visibly blunt the peak.
    ctx.lineJoin = "miter";
    ctx.lineCap = "round";

    // Figma anchors sit at y≈6.9 of the 7px band (baseline) with spike peaks
    // at y≈0.3–0.5: the rolling minimum maps to the bottom of the band and
    // deviations above it rise toward the top. Stroke centers stay half a
    // stroke inside the band, so the flat baseline lands on a half-pixel
    // (6.5) and renders as a crisp 1px line at 100% scale.
    const min = Math.min(...history);
    const floor = Math.max(RANGE_FLOOR_MS, min * RANGE_FLOOR_RATIO);
    const range = Math.max(Math.max(...history) - min, floor);
    const stepX = drawWidth / (history.length - 1);
    const baselineY = BAND_HEIGHT - STROKE_WIDTH / 2;

    // Straight segments, no curve smoothing: the Figma vector is a polyline —
    // stutters read as crisp triangular spikes off the flat baseline (the
    // bezier commands in its exported path are only the round join/cap
    // outlines). Round joins take the 1px-scale edge off the vertices,
    // exactly like the reference.
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = i * stepX;
      const y = baselineY - ((val - min) / range) * (BAND_HEIGHT - STROKE_WIDTH);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history, drawWidth]);

  if (width === "fill") {
    // A canvas's intrinsic width (its backing-store attribute — 300 by
    // default before the first draw) participates in the pill's
    // shrink-to-fit sizing, so an in-flow canvas at width:100% inflates the
    // pill far past the value row. Absolutely positioning it removes it from
    // intrinsic sizing; the wrapper stretches to the column width set by the
    // value row and the ResizeObserver tracks that.
    return (
      <div ref={wrapperRef} style={{ position: "relative", height: BAND_HEIGHT }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width, height: BAND_HEIGHT, display: "block" }}
    />
  );
}
