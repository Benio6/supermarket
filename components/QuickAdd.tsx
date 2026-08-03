"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { addItem, classifyInBackground, recallProduct, rememberProduct } from "@/lib/store";
import { DEPTS, PRIO_META, type DeptId, type Prio } from "@/lib/types";

const PRIOS: Prio[] = [1, 2, 3];

export default function QuickAdd() {
  const [name, setName] = useState("");
  const [prio, setPrio] = useState<Prio>(2);
  const [sheetOpen, setSheetOpen] = useState(false);

  // שדות ה־bottom sheet
  const [dept, setDept] = useState<DeptId | "auto">("auto");
  const [note, setNote] = useState("");
  const [by, setBy] = useState("");

  const typing = name.trim().length > 0;

  function reset() {
    setName("");
    setPrio(2);
    setDept("auto");
    setNote("");
    setBy("");
  }

  function submit(withDetails: boolean) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const remembered = recallProduct(trimmed);
    const chosenDept: DeptId | undefined =
      withDetails && dept !== "auto" ? dept : remembered?.dept;

    const item = addItem({
      name: trimmed,
      dept: chosenDept,
      prio,
      note: withDetails ? note.trim() : "",
      by: withDetails ? by.trim() : "",
    });

    if (chosenDept) {
      // המשתמש בחר מחלקה במפורש (או שהיא הגיעה מהזיכרון) — שומרים ולא מפעילים AI
      rememberProduct(trimmed, chosenDept, prio);
    } else {
      // זיהוי מחלקה אוטומטי ברקע
      void classifyInBackground(item);
    }

    reset();
    setSheetOpen(false);
  }

  return (
    <>
      <div
        className="fixed inset-x-0 z-30"
        style={{ bottom: "calc(62px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto w-full max-w-lg px-3 pb-2">
          <div className="card overflow-hidden border border-black/5 p-2">
            {typing && (
              <div className="animate-growIn overflow-hidden">
                <div className="flex gap-2 px-1 pb-2 pt-1">
                  {PRIOS.map((p) => {
                    const meta = PRIO_META[p];
                    const on = prio === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrio(p)}
                        className={`flex-1 rounded-xl border px-2 py-1.5 text-sm font-medium transition ${
                          on
                            ? "border-brand bg-brand text-white"
                            : "border-black/10 bg-white text-brand/70"
                        }`}
                      >
                        {meta.emoji} {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit(false);
                  }
                }}
                placeholder="מה חסר? כתבו ולחצו Enter…"
                className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 outline-none placeholder:text-brand/35"
                enterKeyHint="done"
              />
              <button
                type="button"
                aria-label="פרטים נוספים"
                onClick={() => setSheetOpen(true)}
                className="shrink-0 rounded-xl bg-brand/5 px-3 py-2.5 text-lg transition active:scale-95"
              >
                ⚙️
              </button>
              <button
                type="button"
                aria-label="הוספה"
                disabled={!typing}
                onClick={() => submit(false)}
                className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-lg font-bold text-white transition active:scale-95 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="פרטים נוספים">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand/70">
              שם המוצר
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: קוטג׳ 5%"
              className="field"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand/70">
              עדיפות
            </label>
            <div className="flex gap-2">
              {PRIOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrio(p)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition ${
                    prio === p
                      ? "border-brand bg-brand text-white"
                      : "border-black/10 bg-white text-brand/70"
                  }`}
                >
                  {PRIO_META[p].emoji} {PRIO_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand/70">
              מחלקה
            </label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value as DeptId | "auto")}
              className="field"
            >
              <option value="auto">✨ זיהוי אוטומטי</option>
              {DEPTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand/70">
              הערה
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="מותג מסוים, גודל, טעם…"
              className="field"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand/70">
              מי הוסיף
            </label>
            <input
              value={by}
              onChange={(e) => setBy(e.target.value)}
              placeholder="השם שלכם"
              className="field"
            />
          </div>

          <button
            type="button"
            onClick={() => submit(true)}
            disabled={!typing}
            className="btn-primary w-full"
          >
            הוספה לרשימה
          </button>
        </div>
      </Sheet>
    </>
  );
}
