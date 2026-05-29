import { useRef, useEffect } from "react";

interface FrametimeGraphProps {
  history: number[];
  width: number;
  height: number;
}

export function FrametimeGraph({ history, width, height }: FrametimeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = width * dpr;
    const targetH = height * dpr;

    if (sizeRef.current.w !== targetW || sizeRef.current.h !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      sizeRef.current = { w: targetW, h: targetH };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...history, 1);
    const stepX = width / (history.length - 1);

    // Figma 2202:3552: stroke is a horizontal linear gradient — white fading
    // in 0→23%, opaque 23→79%, fading out 79→100%. Stops apply to the canvas's
    // CSS pixel width so the fade tracks the visible graph, not the DPR-scaled
    // backing store.
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.23, "rgba(255,255,255,1)");
    grad.addColorStop(0.79, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    history.forEach((val, i) => {
      const x = i * stepX;
      const y = height - (val / maxVal) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}
