"use client";

import { FILTERS, type FilterId } from "@/lib/types";

export default function FilterChips({
  value,
  onChange,
}: {
  value: FilterId;
  onChange: (f: FilterId) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`chip ${value === f.id ? "chip-on" : "chip-off"}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
