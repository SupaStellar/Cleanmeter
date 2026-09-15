import type { Surface } from "@/lib/customization/schema";

/** Alpha applies to the entire background, including its image, never to text. */
export function SurfaceBackground({ surface }: { surface: Surface }) {
  return <span aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -1,
    pointerEvents: "none", borderRadius: "inherit", opacity: surface.opacity,
    backgroundColor: surface.color, backgroundImage: surface.image ? `url("${surface.image}")` : undefined,
    backgroundSize: "cover", backgroundPosition: "center" }} />;
}
