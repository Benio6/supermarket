"use client";

import { useMemo, useState } from "react";
import FilterChips from "@/components/FilterChips";
import QuickAdd from "@/components/QuickAdd";
import Sheet from "@/components/Sheet";
import {
  readMemory,
  removeItem,
  setPrio,
  todayIndex,
  toggleDone,
  useItems,
} from "@/lib/store";
import {
  DAY_NAMES,
  FILTERS,
  PRIO_META,
  deptOf,
  type FilterId,
  type Item,
  type Prio,
} from "@/lib/types";
import { buildViews, filterViews, groupViews, sortViews } from "@/lib/view";

const PRIOS: Prio[] = [1, 2, 3];

export default function ListPage() {
  const items = useItems();
  const [filter, setFilter] = useState<FilterId>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  const today = todayIndex();
  // הזיכרון נקרא מחדש בכל שינוי ברשימה — כך התיעדוף לפי יום מחושב בכל טעינה
  const mem = useMemo(() => readMemory(), [items]);

  const groups = useMemo(() => {
    const prios = FILTERS.find((f) => f.id === filter)?.prios ?? PRIOS;
    return groupViews(sortViews(filterViews(buildViews(items, mem, today), prios)));
  }, [items, mem, today, filter]);

  const openCount = items.filter((i) => !i.done).length;

  function askDelete(item: Item) {
    if (item.done) removeItem(item.id);
    else setPendingDelete(item);
  }

  return (
    <main className="flex-1 pb-44">
      <header className="sticky top-0 z-20 bg-sand/95 backdrop-blur">
        <div className="flex items-end justify-between px-4 pb-3 pt-6">
          <div>
            <h1 className="text-2xl font-black text-brand">הקניות שלנו</h1>
            <p className="text-sm text-brand/50">
              {openCount > 0 ? `${openCount} פריטים · יום ${DAY_NAMES[today]}` : "הרשימה ריקה"}
            </p>
          </div>
          <span className="text-3xl">🛒</span>
        </div>
        <FilterChips value={filter} onChange={setFilter} />
      </header>

      {groups.length === 0 ? (
        <div className="px-6 py-20 text-center">
          <div className="mb-3 text-5xl">🧺</div>
          <p className="font-medium text-brand/60">אין כאן כלום עדיין</p>
          <p className="mt-1 text-sm text-brand/40">כתבו למטה מה חסר ולחצו Enter</p>
        </div>
      ) : (
        <div className="space-y-5 px-4">
          {groups.map(({ dept, views }) => (
            <section key={dept.id}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-brand/60">
                <span className="text-base">{dept.emoji}</span>
                {dept.name}
                <span className="text-xs font-medium text-brand/35">
                  ({views.length})
                </span>
              </h2>

              <ul className="card divide-y divide-black/5 overflow-hidden">
                {views.map(({ item, prio, boosted }) => {
                  const meta = PRIO_META[prio];
                  return (
                    <li key={item.id} className="relative">
                      <span
                        className="absolute inset-y-0 right-0 w-1"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="flex items-center gap-2 py-3 pl-2 pr-4">
                        <button
                          onClick={() => setEditing(item)}
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
                            {boosted && (
                              <span
                                title="העדיפות הועלתה כי מתקרב יום השימוש"
                                className="shrink-0 text-xs"
                              >
                                ⏰
                              </span>
                            )}
                          </div>
                          {(item.note || item.by) && (
                            <div className="mt-0.5 truncate text-xs text-brand/45">
                              {item.note}
                              {item.note && item.by ? " · " : ""}
                              {item.by ? `הוסיף/ה ${item.by}` : ""}
                            </div>
                          )}
                        </button>

                        <button
                          aria-label={item.done ? "החזרה לרשימה" : "סימון כנקנה"}
                          onClick={() => toggleDone(item.id)}
                          className={`shrink-0 rounded-lg px-2 py-1 text-lg transition active:scale-90 ${
                            item.done ? "opacity-100" : "opacity-30"
                          }`}
                        >
                          ✅
                        </button>

                        <button
                          aria-label="מחיקה"
                          onClick={() => askDelete(item)}
                          className="shrink-0 rounded-lg px-2 py-1 text-lg text-brand/30 transition active:scale-90"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <QuickAdd />

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? editing.name : ""}
      >
        <p className="mb-3 text-sm text-brand/50">
          {editing ? `${deptOf(editing.dept).emoji} ${deptOf(editing.dept).name}` : ""}
        </p>
        <div className="space-y-2">
          {PRIOS.map((p) => {
            const meta = PRIO_META[p];
            const on = editing?.prio === p;
            return (
              <button
                key={p}
                onClick={() => {
                  if (editing) setPrio(editing.id, p);
                  setEditing(null);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-right transition ${
                  on
                    ? "border-brand bg-brand-soft"
                    : "border-black/10 bg-white active:bg-black/[0.02]"
                }`}
              >
                <span className="text-2xl">{meta.emoji}</span>
                <span className="flex-1">
                  <span className="block font-bold text-brand">{meta.label}</span>
                  <span className="block text-sm text-brand/50">{meta.desc}</span>
                </span>
                {on && <span className="text-brand">✓</span>}
              </button>
            );
          })}
        </div>
      </Sheet>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            aria-label="ביטול"
            onClick={() => setPendingDelete(null)}
            className="absolute inset-0 animate-fadeIn bg-black/40"
          />
          <div className="relative w-full max-w-sm animate-fadeIn rounded-3xl bg-white p-6 text-center shadow-sheet">
            <div className="mb-2 text-3xl">🗑️</div>
            <h3 className="text-lg font-bold text-brand">
              למחוק את &quot;{pendingDelete.name}&quot;?
            </h3>
            <p className="mt-1 text-sm text-brand/50">
              הפריט עוד לא נקנה. אפשר גם פשוט לסמן אותו כנקנה.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 font-medium text-brand/70"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  removeItem(pendingDelete.id);
                  setPendingDelete(null);
                }}
                className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 font-medium text-white"
              >
                מחיקה
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
