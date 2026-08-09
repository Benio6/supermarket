"use client";

import { useState } from "react";
import { addStore, useStores, visitStore } from "@/lib/stores";
import { PRICE_OPTIONS, allowedPriosFor, priceLabel, type PriceLevel, type Store } from "@/lib/types";

export default function StorePicker({
  onPicked,
  compact = false,
}: {
  onPicked: (store: Store) => void;
  compact?: boolean;
}) {
  const stores = useStores();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<PriceLevel | null>(null);

  function pick(store: Store) {
    visitStore(store.id);
    onPicked(store);
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed || level === null) return;
    const store = addStore(trimmed, level);
    setCreating(false);
    setName("");
    setLevel(null);
    onPicked(store);
  }

  if (creating) {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand/70">
            איך קוראים לסופר?
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: רמי לוי נתניה"
            className="field"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand/70">
            כמה יקר שם?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRICE_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                type="button"
                onClick={() => setLevel(opt.level)}
                className={`rounded-xl border px-3 py-2.5 text-right transition ${
                  level === opt.level
                    ? "border-brand bg-brand text-white"
                    : "border-black/10 bg-white text-brand/70"
                }`}
              >
                <span className="block font-medium">
                  {opt.emoji} {opt.label}
                </span>
                <span
                  className={`block text-xs ${
                    level === opt.level ? "text-white/70" : "text-brand/40"
                  }`}
                >
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCreating(false)}
            className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 font-medium text-brand/70"
          >
            ביטול
          </button>
          <button
            onClick={create}
            disabled={!name.trim() || level === null}
            className="btn-primary flex-1"
          >
            שמירה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stores.length === 0 && !compact && (
        <p className="text-sm text-brand/50">
          עוד לא הוספתם סופרים. בואו נוסיף את הראשון.
        </p>
      )}

      {[...stores]
        .sort((a, b) => b.lastVisited - a.lastVisited)
        .map((store) => {
          const prios = allowedPriosFor(store.priceLevel);
          return (
            <button
              key={store.id}
              onClick={() => pick(store)}
              className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3.5 text-right transition active:bg-black/[0.02]"
            >
              <span className="text-2xl">
                {PRICE_OPTIONS.find((p) => p.level === store.priceLevel)?.emoji ?? "🏪"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate font-bold text-brand">{store.name}</span>
                <span className="block text-sm text-brand/50">
                  {priceLabel(store.priceLevel)} · מציג{" "}
                  {prios.length === 3
                    ? "הכל"
                    : prios.length === 2
                      ? "דחוף + רגיל"
                      : "רק דחוף"}
                  {store.route?.length ? " · 🧭 מסלול נלמד" : ""}
                </span>
              </span>
            </button>
          );
        })}

      <button
        onClick={() => setCreating(true)}
        className="w-full rounded-2xl border border-dashed border-brand/30 bg-white/50 p-3.5 font-medium text-brand transition active:scale-[0.99]"
      >
        ＋ סופר חדש
      </button>
    </div>
  );
}
