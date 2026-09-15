import { lazy, Suspense } from "react";
import { PositionGrid } from "./PositionGrid";
const CustomizationEditor = lazy(() => import("../customization/CustomizationEditor"));

export function StyleTab() {
  return <div className="flex h-full w-full flex-col gap-4">
    <Suspense fallback={<p role="status">Loading customization…</p>}><CustomizationEditor /></Suspense>
    <PositionGrid />
  </div>;
}
