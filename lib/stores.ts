"use client";

import { useSyncExternalStore } from "react";
import { averageRoutes, pushRouteHistory } from "./route";
import { isDeptId, type DeptId, type PriceLevel, type Store } from "./types";

const KEY = "fam-stores";
const EMPTY: Store[] = [];

let cache: Store[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Store[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((s: unknown): s is Store => {
      const st = s as Store;
      return (
        !!st &&
        typeof st.id === "string" &&
        typeof st.name === "string" &&
        typeof st.priceLevel === "number"
      );
    });
  } catch {
    return EMPTY;
  }
}

function commit(next: Store[]) {
  cache = next;
  loaded = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* מתעלמים */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot(): Store[] {
  if (!loaded && typeof window !== "undefined") {
    cache = read();
    loaded = true;
  }
  return cache;
}

function getServerSnapshot(): Store[] {
  return EMPTY;
}

export function useStores(): Store[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getStores(): Store[] {
  return getSnapshot();
}

/**
 * חותמת ביקור שתמיד גדולה מכל קיימת.
 * בלי זה שני סופרים שנוצרים באותה מילישנייה מקבלים ערך זהה,
 * ו"הסופר הפעיל" נקבע שרירותית לפי סדר המערך.
 */
function nextVisitStamp(stores: Store[]): number {
  const max = stores.reduce((m, s) => Math.max(m, s.lastVisited), 0);
  return Math.max(Date.now(), max + 1);
}

export function addStore(name: string, priceLevel: PriceLevel): Store {
  const existing = getStores();
  const store: Store = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    priceLevel,
    lastVisited: nextVisitStamp(existing),
  };
  commit([...existing, store]);
  return store;
}

/**
 * מסמן ביקור בסופר. הסופר הפעיל הוא תמיד זה עם lastVisited הכי עדכני —
 * כך אין צורך במפתח נפרד ל"סופר נוכחי", וה-schema נשאר בדיוק כפי שהוגדר.
 */
export function visitStore(id: string) {
  const stores = getStores();
  const stamp = nextVisitStamp(stores);
  commit(stores.map((s) => (s.id === id ? { ...s, lastVisited: stamp } : s)));
}

/**
 * מעדכן את המסלול של הסופר בסוף ביקור.
 * `observed` הוא סדר המחלקות שדווח בשיחה; המסלול השמור זז לכיוונו
 * לפי משקל מספר הביקורים הקודמים.
 */
export function recordRoute(id: string, observed: DeptId[]): Store | null {
  const clean = observed.filter(isDeptId);
  if (clean.length < 2) return null; // ביקור במחלקה אחת לא מלמד סדר

  let updated: Store | null = null;
  commit(
    getStores().map((s) => {
      if (s.id !== id) return s;
      const history = pushRouteHistory(s.routeHistory ?? [], clean);
      updated = {
        ...s,
        routeHistory: history,
        route: averageRoutes(history),
        routeVisits: (s.routeVisits ?? 0) + 1,
      };
      return updated;
    })
  );
  return updated;
}

/** האם המסלול נלמד מספיק כדי להנחות לפיו */
export function routeIsConfident(store: Store | null, after = 2): boolean {
  return !!store && (store.routeVisits ?? 0) >= after && !!store.route?.length;
}

export function removeStore(id: string) {
  commit(getStores().filter((s) => s.id !== id));
}

export function activeStore(stores: Store[] = getStores()): Store | null {
  if (stores.length === 0) return null;
  return [...stores].sort((a, b) => b.lastVisited - a.lastVisited)[0];
}

export function findStoreByName(name: string): Store | null {
  const key = name.trim().toLowerCase();
  return getStores().find((s) => s.name.trim().toLowerCase() === key) ?? null;
}
