"use client";

import { useSyncExternalStore } from "react";
import type {
  DeptId,
  Item,
  Prio,
  ProductMemory,
  ProductMemoryEntry,
  WeekDay,
} from "./types";
import { CONFIDENT_AFTER, isDeptId } from "./types";
import { downgrade } from "./urgency";

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

/** מעדכן את המטמון מהדיסק ומודיע למאזינים, בלי לכתוב בחזרה */
function syncFromDisk(): Item[] {
  if (typeof window === "undefined") return cache;
  const fromDisk = readStorage();
  loaded = true;
  if (JSON.stringify(fromDisk) !== JSON.stringify(cache)) {
    cache = fromDisk;
    listeners.forEach((l) => l());
  }
  return cache;
}

/**
 * קורא את fam-items מחדש מה-localStorage ומחזיר את המצב העדכני.
 * נקרא לפני כל פנייה ל-API כדי שהצ'אט יראה תמיד את הרשימה האמיתית,
 * גם אם היא שונתה במסך אחר או בטאב אחר.
 */
export function refreshItems(): Item[] {
  return syncFromDisk();
}

let storageListenerAttached = false;

/** סנכרון אוטומטי כשטאב אחר משנה את הרשימה */
function attachStorageListener() {
  if (
    storageListenerAttached ||
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return;
  }
  storageListenerAttached = true;
  window.addEventListener("storage", (e) => {
    // key === null קורה ב-localStorage.clear()
    if (e.key !== null && e.key !== ITEMS_KEY) return;
    syncFromDisk();
  });
}

// מתחברים כבר בטעינת המודול, ולא רק כשקומפוננטה נרשמת —
// כך הסנכרון בין טאבים עובד גם במסך שלא צורך את הרשימה ישירות
attachStorageListener();

function subscribe(listener: () => void) {
  attachStorageListener();
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

/** מוריד דחיפות בשלב אחד. לעולם לא מוחק — 3 נשאר 3. */
export function downgradeItemPrio(id: string): Prio | null {
  const item = getItems().find((i) => i.id === id);
  if (!item) return null;
  const next = downgrade(item.prio);
  updateItem(id, { prio: next });
  rememberProduct(item.name, item.dept, next);
  return next;
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

/**
 * קורא את זיכרון המוצרים ומשלים שדות שחסרים ברשומות ישנות
 * (usedOn/askCount נוספו אחרי הגרסה הראשונה).
 */
export function readMemory(): ProductMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: ProductMemory = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const e = value as Partial<ProductMemoryEntry>;
      if (!e || !isDeptId(e.dept)) continue;
      out[key] = {
        dept: e.dept,
        prio: e.prio === 1 || e.prio === 2 || e.prio === 3 ? e.prio : 2,
        usedOn: Array.isArray(e.usedOn)
          ? (e.usedOn.filter(
              (d) => typeof d === "number" && d >= 0 && d <= 6
            ) as WeekDay[])
          : [],
        count: typeof e.count === "number" ? e.count : 0,
        askCount: typeof e.askCount === "number" ? e.askCount : 0,
      };
    }
    return out;
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

export function recallProduct(name: string): ProductMemoryEntry | null {
  const key = normalizeName(name);
  if (!key) return null;
  return readMemory()[key] ?? null;
}

/**
 * מעדכן את זיכרון המוצר. `count` סופר פעמים *רצופות* עם אותה עדיפות —
 * אם המשתמש שינה דעה, הספירה מתאפסת וחוזרים לשאול.
 */
export function rememberProduct(name: string, dept: DeptId, prio: Prio) {
  const key = normalizeName(name);
  if (!key) return;
  const mem = readMemory();
  const prev = mem[key];
  mem[key] = {
    dept,
    prio,
    usedOn: prev?.usedOn ?? [],
    count: prev && prev.prio === prio ? prev.count + 1 : 1,
    askCount: prev?.askCount ?? 0,
  };
  writeMemory(mem);
}

/** האם עוד צריך לשאול על המוצר, או שכבר למדנו אותו */
export function shouldAskAbout(name: string): boolean {
  const entry = recallProduct(name);
  return !entry || entry.count < CONFIDENT_AFTER;
}

/** מסמן ששאלנו — כדי לא לחזור על אותה שאלה */
export function noteAsked(name: string) {
  const key = normalizeName(name);
  if (!key) return;
  const mem = readMemory();
  const prev = mem[key];
  if (!prev) return;
  mem[key] = { ...prev, askCount: prev.askCount + 1 };
  writeMemory(mem);
}

/** שומר באילו ימים משתמשים במוצר — נשאל פעם אחת בלבד */
export function setUsageDays(name: string, days: WeekDay[]) {
  const key = normalizeName(name);
  if (!key) return;
  const mem = readMemory();
  const prev = mem[key];
  const unique = Array.from(new Set(days)).filter(
    (d) => d >= 0 && d <= 6
  ) as WeekDay[];
  mem[key] = {
    dept: prev?.dept ?? "other",
    prio: prev?.prio ?? 2,
    usedOn: unique,
    count: prev?.count ?? 0,
    askCount: (prev?.askCount ?? 0) + 1,
  };
  writeMemory(mem);
}

/** האם כבר יודעים מתי משתמשים במוצר (או שכבר שאלנו ולא ענו) */
export function knowsUsageDays(name: string): boolean {
  const entry = recallProduct(name);
  return !!entry && (entry.usedOn.length > 0 || entry.askCount > 0);
}

// ---------- תיעדוף דינמי לפי יום בשבוע ----------

export function todayIndex(): WeekDay {
  return new Date().getDay() as WeekDay;
}

/** כמה ימים נשארו עד יום השימוש הקרוב ביותר; null אם אין ימי שימוש */
export function daysUntilUse(
  usedOn: WeekDay[],
  today: WeekDay = todayIndex()
): number | null {
  if (usedOn.length === 0) return null;
  return Math.min(...usedOn.map((d) => (d - today + 7) % 7));
}

/**
 * עדיפות אפקטיבית לתצוגה: ככל שמתקרבים ליום השימוש, העדיפות עולה.
 * היום → 1, מחר → לכל היותר 2. אחרת ללא שינוי.
 *
 * מחושב בכל טעינה ולא נשמר — כך העדיפות שהמשתמש בחר במפורש
 * נשארת שלמה, והחיזוק נעלם מעצמו כשהיום עובר.
 */
export function boostedPrio(
  item: Item,
  mem: ProductMemory,
  today: WeekDay = todayIndex()
): Prio {
  const entry = mem[normalizeName(item.name)];
  if (!entry) return item.prio;
  const distance = daysUntilUse(entry.usedOn, today);
  if (distance === null) return item.prio;
  if (distance === 0) return 1;
  if (distance === 1) return Math.min(item.prio, 2) as Prio;
  return item.prio;
}

/** האם העדיפות שמוצגת גבוהה ממה שנשמר — כדי לסמן את זה בממשק */
export function isBoosted(
  item: Item,
  mem: ProductMemory,
  today: WeekDay = todayIndex()
): boolean {
  return boostedPrio(item, mem, today) < item.prio;
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
