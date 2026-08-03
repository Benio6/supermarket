"use client";

import { useMemo, useState } from "react";
import FilterChips from "@/components/FilterChips";
import { clearDone, removeItem, toggleDone, updateItem, useItems } from "@/lib/store";
import {
  PRIO_META,
  filterItems,
  groupByDept,
  type FilterId,
} from "@/lib/types";

export default function ShopPage() {
  const items = useItems();
  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = useMemo(() => filterItems(items, filter), [items, filter]);

  const groups = useMemo(() => {
    // בתוך כל מחלקה: לא קנוי דחוף → לא קנוי רגיל → קנוי
    const sorted = [...filtered].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.prio !== b.prio) return a.prio - b.prio;
      return a.at - b.at;
    });
    return groupByDept(sorted);
  }, [filtered]);

  const total = filtered.length;
  const done = filtered.filter((i) => i.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const doneInList = items.some((i) => i.done);

  return (
    <main className="flex-1 pb-28">
      <header className="sticky top-0 z-20 bg-sand/95 backdrop-blur">
        <div className="px-4 pb-3 pt-6">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-black text-brand">בסופר</h1>
              <p className="text-sm text-brand/50">
                {done} מתוך {total} נקנו
              </p>
            </div>
            <span className="text-3xl font-black text-brand">{pct}%</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand/10">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <FilterChips value={filter} onChange={setFilter} />
      </header>

      {groups.length === 0 ? (
        <div className="px-6 py-20 text-center">
          <div className="mb-3 text-5xl">🎉</div>
          <p className="font-medium text-brand/60">אין מה לקנות</p>
          <p className="mt-1 text-sm text-brand/40">
            הוסיפו פריטים במסך הרשימה
          </p>
        </div>
      ) : (
        <div className="space-y-5 px-4">
          {groups.map(({ dept, items: deptItems }) => {
            const deptDone = deptItems.filter((i) => i.done).length;
            return (
              <section key={dept.id}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-brand/60">
                  <span className="text-base">{dept.emoji}</span>
                  {dept.name}
                  <span className="text-xs font-medium text-brand/35">
                    {deptDone}/{deptItems.length}
                  </span>
                </h2>

                <ul className="card divide-y divide-black/5 overflow-hidden">
                  {deptItems.map((item) => {
                    const meta = PRIO_META[item.prio];
                    return (
                      <li
                        key={item.id}
                        className={`relative transition-colors ${
                          item.done ? "bg-brand-soft/40" : ""
                        }`}
                      >
                        <span
                          className="absolute inset-y-0 right-0 w-1"
                          style={{
                            backgroundColor: meta.color,
                            opacity: item.done ? 0.3 : 1,
                          }}
                        />
                        <div className="py-3 pl-2 pr-3">
                          <div className="flex items-center gap-3">
                            <button
                              aria-label={item.done ? "ביטול סימון" : "סימון כנקנה"}
                              onClick={() => toggleDone(item.id)}
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold transition active:scale-90 ${
                                item.done
                                  ? "border-brand bg-brand text-white"
                                  : "border-brand/25 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </button>

                            <button
                              onClick={() => toggleDone(item.id)}
                              className="min-w-0 flex-1 text-right"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`truncate font-medium ${
                                    item.done
                                      ? "text-brand/35 line-through"
                                      : "text-brand-dark"
                                  }`}
                                >
                                  {item.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                                >
                                  {meta.emoji} {meta.label}
                                </span>
                              </div>
                              {item.note && (
                                <div className="mt-0.5 truncate text-xs text-brand/45">
                                  {item.note}
                                </div>
                              )}
                            </button>

                            <button
                              aria-label="מחיקה"
                              onClick={() => removeItem(item.id)}
                              className="shrink-0 rounded-lg px-2 py-1 text-lg text-brand/30 transition active:scale-90"
                            >
                              ×
                            </button>
                          </div>

                          {item.done && (
                            <div className="animate-growIn overflow-hidden">
                              <div className="flex items-center gap-2 pr-10 pt-2">
                                <span className="text-xs text-brand/45">כמה נקנה?</span>
                                <input
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateItem(item.id, { qty: e.target.value })
                                  }
                                  placeholder="2 יח׳ / 1 ק״ג"
                                  className="w-32 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-sm outline-none focus:border-brand"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {doneInList && (
        <div className="px-4 pt-6">
          <button
            onClick={clearDone}
            className="w-full rounded-xl border border-brand/20 bg-white px-4 py-3 font-medium text-brand transition active:scale-[0.99]"
          >
            🧹 הסר שנקנו
          </button>
        </div>
      )}
    </main>
  );
}
