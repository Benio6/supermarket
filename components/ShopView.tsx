"use client";

import { useMemo, useState } from "react";
import FilterChips from "@/components/FilterChips";
import Sheet from "@/components/Sheet";
import StorePicker from "@/components/StorePicker";
import {
  clearDone,
  readMemory,
  removeItem,
  todayIndex,
  toggleDone,
  updateItem,
  useItems,
} from "@/lib/store";
import { activeStore, useStores } from "@/lib/stores";
import {
  DAY_NAMES,
  FILTERS,
  PRICE_OPTIONS,
  PRIO_META,
  allowedPriosFor,
  priceLabel,
  type FilterId,
  type Prio,
} from "@/lib/types";
import { buildViews, filterViews, groupViews, sortViews } from "@/lib/view";

const ALL_PRIOS: Prio[] = [1, 2, 3];

export default function ShopView() {
  const items = useItems();
  const stores = useStores();
  const [filter, setFilter] = useState<FilterId>("all");
  const [picking, setPicking] = useState(false);

  const store = activeStore(stores);
  const today = todayIndex();
  const mem = useMemo(() => readMemory(), [items]);

  // הסופר קובע תקרה, והצ'יפים יכולים לצמצם אותה עוד — אף פעם לא להרחיב
  const storePrios = store ? allowedPriosFor(store.priceLevel) : ALL_PRIOS;
  const chipPrios = FILTERS.find((f) => f.id === filter)?.prios ?? ALL_PRIOS;
  const effectivePrios = storePrios.filter((p) => chipPrios.includes(p));

  const visible = useMemo(
    () => filterViews(buildViews(items, mem, today), effectivePrios),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, mem, today, effectivePrios.join(",")]
  );

  // אם נלמד מסלול בסופר הזה — המחלקות מסודרות לפיו
  const groups = useMemo(
    () => groupViews(sortViews(visible), store?.route),
    [visible, store?.route]
  );

  const total = visible.length;
  const done = visible.filter((v) => v.item.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const doneInList = items.some((i) => i.done);
  const hiddenByStore = items.filter(
    (i) => !i.done && !storePrios.includes(i.prio)
  ).length;

  return (
    <main className="flex-1 pb-28">
      <header className="sticky top-0 z-20 bg-sand/95 backdrop-blur">
        <div className="px-4 pb-3 pt-6">
          <div className="mb-2 flex items-end justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-brand">בסופר</h1>
              <p className="text-sm text-brand/50">
                {done} מתוך {total} נקנו · יום {DAY_NAMES[today]}
              </p>
            </div>
            <span className="text-3xl font-black text-brand">{pct}%</span>
          </div>

          <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-brand/10">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <button
            onClick={() => setPicking(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-right text-sm transition active:scale-[0.99]"
          >
            <span className="text-lg">
              {store
                ? (PRICE_OPTIONS.find((p) => p.level === store.priceLevel)?.emoji ?? "🏪")
                : "🏪"}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {store ? (
                <>
                  <span className="font-bold text-brand">{store.name}</span>
                  <span className="text-brand/50"> · {priceLabel(store.priceLevel)}</span>
                </>
              ) : (
                <span className="text-brand/50">באיזה סופר אתם?</span>
              )}
            </span>
            <span className="shrink-0 text-brand/40">החלפה ›</span>
          </button>

          {store?.route?.length ? (
            <p className="mt-2 text-xs text-brand/45">
              🧭 מסודר לפי המסלול שלכם ב{store.name} ({store.routeVisits ?? 0} ביקורים)
            </p>
          ) : null}

          {hiddenByStore > 0 && (
            <p className="mt-2 text-xs text-brand/45">
              {hiddenByStore} פריטים מוסתרים כי {store?.name} מוגדר כ
              {priceLabel(store!.priceLevel)}
            </p>
          )}
        </div>
        <FilterChips value={filter} onChange={setFilter} />
      </header>

      {groups.length === 0 ? (
        <div className="px-6 py-20 text-center">
          <div className="mb-3 text-5xl">🎉</div>
          <p className="font-medium text-brand/60">אין מה לקנות כאן</p>
          <p className="mt-1 text-sm text-brand/40">
            {hiddenByStore > 0
              ? "יש פריטים שמוסתרים בגלל רמת המחיר של הסופר"
              : "הוסיפו פריטים במסך הרשימה"}
          </p>
        </div>
      ) : (
        <div className="space-y-5 px-4">
          {groups.map(({ dept, views }) => {
            const deptDone = views.filter((v) => v.item.done).length;
            return (
              <section key={dept.id}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-brand/60">
                  <span className="text-base">{dept.emoji}</span>
                  {dept.name}
                  <span className="text-xs font-medium text-brand/35">
                    {deptDone}/{views.length}
                  </span>
                </h2>

                <ul className="card divide-y divide-black/5 overflow-hidden">
                  {views.map(({ item, prio, boosted }) => {
                    const meta = PRIO_META[prio];
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
                                {boosted && <span className="shrink-0 text-xs">⏰</span>}
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

      <Sheet open={picking} onClose={() => setPicking(false)} title="באיזה סופר אתם?">
        <StorePicker onPicked={() => setPicking(false)} />
      </Sheet>
    </main>
  );
}
