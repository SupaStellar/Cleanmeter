import { useRef, useEffect } from "react";

interface NetGraphProps {
  downHistory: number[];
  upHistory: number[];
  width: number;
  height: number;
}

export function NetGraph({ downHistory, upHistory, width, height }: NetGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    const allValues = [...downHistory, ...upHistory];
    const maxVal = Math.max(...allValues, 1);

    if (downHistory.length > 1) {
      drawLine(ctx, downHistory, maxVal, width, height, "white");
    }
    if (upHistory.length > 1) {
      drawLine(ctx, upHistory, maxVal, width, height, "white");
    }
  }, [downHistory, upHistory, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="opacity-80"
    />
  );
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  data: number[],
  maxVal: number,
  width: number,
  height: number,
  color: string
) {
  const stepX = width / (data.length - 1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  data.forEach((val, i) => {
    const x = i * stepX;
    const y = height - (val / maxVal) * (height - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
