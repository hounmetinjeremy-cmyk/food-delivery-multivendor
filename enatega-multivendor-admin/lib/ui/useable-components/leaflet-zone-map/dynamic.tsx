"use client";

import dynamic from "next/dynamic";

// Leaflet touches window/document at module load time, which crashes
// during Next.js's server-side render pass — every consumer must import
// through this dynamic, SSR-disabled wrapper instead of index.tsx directly.
const EditableZoneMap = dynamic(() => import("./index"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
      <span className="text-sm text-gray-400">Loading map…</span>
    </div>
  ),
});

export default EditableZoneMap;
export type { IEditableZoneMapProps, ILatLng, IReferenceZone, ZoneMode } from "./index";
