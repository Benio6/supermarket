"use client";

import { useSyncExternalStore } from "react";
import type { DeptId, Item, Prio, ProductMemory } from "./types";
import { isDeptId } from "./types";

const ITEMS_KEY = "fam-items";
const MEMORY_KEY = "fam-product-memory";

const EMPTY: Item[] = [];

let cache: Item[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readStorage(): Item[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((i: unknown): i is Item => {
      const it = i as Item;
      return !!it && typeof it.id === "string" && typeof it.name === "string";
    });
  } catch {
    return EMPTY;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(cache));
  } catch {
    /* מצב פרטי / אחסון מלא — מתעלמים */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Item[] {
  if (!loaded && typeof window !== "undefined") {
    cache = readStorage();
    loaded = true;
  }
  return cache;
}

function getServerSnapshot(): Item[] {
  return EMPTY;
}

/** הוק ראשי — מחזיר את הרשימה ומרנדר מחדש בכל שינוי */
export function useItems(): Item[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getItems(): Item[] {
  return getSnapshot();
}

function commit(next: Item[]) {
  cache = next;
  loaded = true;
  persist();
  emit();
}

// ---------- פעולות ----------

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addItem(partial: {
  name: string;
  dept?: DeptId;
  prio?: Prio;
  note?: string;
  by?: string;
  qty?: string;
}): Item {
  const remembered = recallProduct(partial.name);
  const item: Item = {
    id: newId(),
    name: partial.name.trim(),
    dept: partial.dept ?? remembered?.dept ?? "other",
    prio: partial.prio ?? remembered?.prio ?? 2,
    note: partial.note ?? "",
    by: partial.by ?? "",
    at: Date.now(),
    done: false,
    qty: partial.qty ?? "",
  };
  commit([...getItems(), item]);
  return item;
}

export function updateItem(id: string, patch: Partial<Item>) {
  commit(getItems().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function removeItem(id: string) {
  commit(getItems().filter((i) => i.id !== id));
}

export function toggleDone(id: string) {
  const item = getItems().find((i) => i.id === id);
  if (!item) return;
  updateItem(id, { done: !item.done });
}

export function clearDone() {
  commit(getItems().filter((i) => !i.done));
}

export function setPrio(id: string, prio: Prio) {
  const item = getItems().find((i) => i.id === id);
  updateItem(id, { prio });
  if (item) rememberProduct(item.name, item.dept, prio);
}

export function setDept(id: string, dept: DeptId) {
  const item = getItems().find((i) => i.id === id);
  updateItem(id, { dept });
  if (item) rememberProduct(item.name, dept, item.prio);
}

// ---------- זיכרון מוצרים ----------

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function readMemory(): ProductMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ProductMemory) : {};
  } catch {
    return {};
  }
}

function writeMemory(mem: ProductMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
  } catch {
    /* מתעלמים */
  }
}

export function recallProduct(
  name: string
): { dept: DeptId; prio: Prio; count: number } | null {
  const key = normalizeName(name);
  if (!key) return null;
  const entry = readMemory()[key];
  if (!entry || !isDeptId(entry.dept)) return null;
  return entry;
}

export function rememberProduct(name: string, dept: DeptId, prio: Prio) {
  const key = normalizeName(name);
  if (!key) return;
  const mem = readMemory();
  const prev = mem[key];
  mem[key] = { dept, prio, count: (prev?.count ?? 0) + 1 };
  writeMemory(mem);
}

// ---------- זיהוי מחלקה אוטומטי ברקע ----------

const classifying = new Set<string>();

/**
 * מנסה לזהות את המחלקה של פריט חדש דרך ה-AI.
 * רץ ברקע — אם משהו נכשל, הפריט פשוט נשאר במחלקה שנבחרה.
 */
export async function classifyInBackground(item: Item) {
  const key = normalizeName(item.name);
  if (!key || classifying.has(key)) return;

  // אם כבר מכירים את המוצר מהזיכרון המקומי — לא צריך AI
  const remembered = recallProduct(item.name);
  if (remembered) {
    if (remembered.dept !== item.dept) {
      updateItem(item.id, { dept: remembered.dept });
    }
    return;
  }

  classifying.add(key);
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { dept?: string };
    if (isDeptId(data.dept)) {
      const current = getItems().find((i) => i.id === item.id);
      if (!current) return;
      updateItem(item.id, { dept: data.dept });
      rememberProduct(item.name, data.dept, current.prio);
    }
  } catch {
    /* אופליין או שגיאת רשת — מתעלמים בשקט */
  } finally {
    classifying.delete(key);
  }
}
