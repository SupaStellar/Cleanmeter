import { gaugeFraction } from "@/lib/customization/gauges";
import type { GaugeStyle } from "@/lib/customization/schema";



/** Fixed geometry and no animation timers: one SVG update per sensor snapshot. */
export function CustomGauge({ style, value, max = 100, color, size = 20 }: {
  style: GaugeStyle; value: number; max?: number; color: string; size?: number;
}) {
  const p = gaugeFraction(value, max), track = "var(--overlay-track, #ffffff26)";
  const active = (i: number, count: number) => i < Math.round(p * count) ? color : track;
  const point = (angle: number, r: number) => [12 + Math.cos(angle) * r, 12 + Math.sin(angle) * r];
  const circular = ["ring", "thin-ring", "double-ring", "dashed-ring", "dotted-ring", "radial-ticks", "arc", "half-ring", "needle", "compass", "pie", "donut", "orbit"].includes(style);
  let body: React.ReactNode;
  if (circular) {
    const sweep = style === "half-ring" || style === "needle" ? 180 : style === "arc" ? 270 : 360;
    const radius = style === "pie" ? 6 : 9, length = 2 * Math.PI * radius * sweep / 360;
    const rotation = sweep === 180 ? -180 : sweep === 270 ? -225 : -90;
    const width = style === "thin-ring" ? 1 : style === "pie" ? 12 : style === "donut" ? 5 : 2.5;
    const segments = style === "dotted-ring" || style === "dashed-ring" ? 12 : 24;
    body = <>
      {["dotted-ring", "dashed-ring", "radial-ticks", "compass"].includes(style) ? Array.from({ length: segments }, (_, i) => {
        const a = i / segments * Math.PI * 2 - Math.PI / 2, [x, y] = point(a, 9), [x2, y2] = point(a, style === "compass" && i % 6 === 0 ? 5 : 7);
        if (style === "dashed-ring") return <circle key={i} cx="12" cy="12" r="9" fill="none" stroke={active(i, segments)} strokeWidth="2.5" strokeDasharray="3.4 100" transform={`rotate(${i * 30 - 90} 12 12)`} />;
        return style === "dotted-ring" ? <circle key={i} cx={x} cy={y} r={1.25} fill={active(i, segments)} /> : <line key={i} x1={x} y1={y} x2={x2} y2={y2} stroke={active(i, segments)} strokeWidth={style === "compass" && i % 6 === 0 ? 2 : 1} />;
      }) : <>
        <circle cx="12" cy="12" r={radius} fill="none" stroke={track} strokeWidth={width} strokeDasharray={`${length} 100`} transform={`rotate(${rotation} 12 12)`} />
        <circle cx="12" cy="12" r={radius} fill="none" stroke={color} strokeWidth={width} strokeDasharray={`${p * length} 100`} transform={`rotate(${rotation} 12 12)`} />
      </>}
      {style === "double-ring" && <circle cx="12" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="1" strokeDasharray={`${p * 34.56} 100`} transform="rotate(90 12 12)" />}
      {style === "needle" && <><line x1="12" y1="12" x2={point(Math.PI + p * Math.PI, 8)[0]} y2={point(Math.PI + p * Math.PI, 8)[1]} stroke={color} strokeWidth="1.5" /><circle cx="12" cy="12" r="2" fill={color} /></>}
      {style === "orbit" && <><circle cx="12" cy="12" r="4" fill={color} /><circle cx={point(p * Math.PI * 2 - Math.PI / 2, 9)[0]} cy={point(p * Math.PI * 2 - Math.PI / 2, 9)[1]} r="3" fill={color} /></>}
    </>;
  } else if (["square", "diamond", "hexagon", "triangle", "cross"].includes(style)) {
    const paths = { square: "M3 3H21V21H3Z", diamond: "M12 1L23 12L12 23L1 12Z", hexagon: "M6 2H18L23 12L18 22H6L1 12Z", triangle: "M12 2L23 22H1Z", cross: "M9 2H15V9H22V15H15V22H9V15H2V9H9Z" };
    const d = paths[style as keyof typeof paths];
    body = <><path d={d} fill="none" stroke={track} strokeWidth="2" /><path d={d} fill="none" stroke={color} strokeWidth="2" pathLength="100" strokeDasharray={`${p * 100} 100`} /></>;
  } else if (["bar", "vertical-bar", "battery", "thermometer"].includes(style)) {
    const vertical = style === "vertical-bar" || style === "thermometer";
    body = <>
      {style === "battery" && <rect x="21" y="9" width="2" height="6" rx="1" fill={track} />}
      <rect x={vertical ? 8 : 2} y={vertical ? 2 : 6} width={vertical ? 8 : 19} height={vertical ? 20 : 12} rx={style === "thermometer" ? 4 : 2} fill={track} />
      <rect x={vertical ? 10 : 4} y={vertical ? 20 - p * 16 : 8} width={vertical ? 4 : p * 15} height={vertical ? p * 16 : 8} rx="1" fill={color} />
      {style === "thermometer" && <circle cx="12" cy="19" r="4" fill={p > 0 ? color : track} />}
    </>;
  } else {
    const count = ["dots", "tiles", "diamonds"].includes(style) ? 9 : style === "honeycomb" ? 7 : 5;
    body = Array.from({ length: count }, (_, i) => {
      const fill = active(i, count), x = 3 + (i % 3) * 7, y = 3 + Math.floor(i / 3) * 7;
      switch (style) {
        case "dots": return <circle key={i} cx={x + 2} cy={y + 2} r="2.5" fill={fill} />;
        case "tiles": return <rect key={i} x={x} y={y} width="5" height="5" rx=".8" fill={fill} />;
        case "diamonds": return <path key={i} d={`M${x+2.5} ${y-1}l3.5 3.5-3.5 3.5-3.5-3.5Z`} fill={fill} />;
        case "honeycomb": { const [cx,cy] = i === 0 ? [12,12] : point((i-1)/6*Math.PI*2,7); return <path key={i} d={`M${cx-2} ${cy-3}h4l2 3-2 3h-4l-2-3Z`} fill={fill} />; }
        case "chevrons": return <path key={i} d={`M${2+i*4} 5l3 7-3 7`} fill="none" stroke={fill} strokeWidth="2" />;
        case "signal": return <rect key={i} x={1+i*4.5} y={20-(i+1)*3.5} width="3" height={(i+1)*3.5} rx="1" fill={fill} />;
        case "equalizer": return <rect key={i} x={1+i*4.5} y={12-(i+1)*1.9} width="3" height={(i+1)*3.8} rx="1" fill={fill} />;
        case "segments": return <rect key={i} x={1+i*4.5} y="6" width="3" height="12" rx="1" fill={fill} />;
        case "ladder": return <path key={i} d={`M4 ${21-i*4}h16 M4 ${21-i*4}v-3 M20 ${21-i*4}v-3`} fill="none" stroke={fill} strokeWidth="2" />;
        default: return <rect key={i} x="2" y={20-i*4} width="20" height="2.5" rx="1.25" fill={fill} />;
      }
    });
  }
  return <svg aria-hidden="true" data-gauge-style={style} width={size} height={size} viewBox="0 0 24 24" strokeLinejoin="round" style={{ flexShrink: 0 }}>{body}</svg>;
}
