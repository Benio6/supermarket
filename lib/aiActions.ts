"use client";

import {
  addItem,
  classifyInBackground,
  getItems,
  normalizeName,
  removeItem,
  rememberProduct,
  updateItem,
} from "./store";
import { isDeptId, type DeptId, type Prio } from "./types";

export type AiAction =
  | { op: "add"; name: string; dept?: DeptId; prio?: Prio; note?: string; qty?: string }
  | { op: "done"; name: string }
  | { op: "undone"; name: string }
  | { op: "delete"; name: string }
  | { op: "prio"; name: string; prio: Prio };

const BLOCK = /<ACTIONS>([\s\S]*?)<\/ACTIONS>/;

/** מוציא את בלוק הפעולות מהתשובה ומחזיר גם את הטקסט הנקי להצגה */
export function parseActions(reply: string): {
  text: string;
  actions: AiAction[];
} {
  const match = reply.match(BLOCK);
  if (!match) return { text: reply.trim(), actions: [] };

  const text = reply.replace(BLOCK, "").trim();
  let actions: AiAction[] = [];
  try {
    const parsed = JSON.parse(match[1].trim());
    if (Array.isArray(parsed)) actions = parsed.filter(isValidAction);
  } catch {
    /* JSON לא תקין — מתעלמים ומציגים רק את הטקסט */
  }
  return { text, actions };
}

function isValidAction(a: unknown): a is AiAction {
  if (!a || typeof a !== "object") return false;
  const obj = a as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) return false;
  return ["add", "done", "undone", "delete", "prio"].includes(String(obj.op));
}

function findItem(name: string) {
  const key = normalizeName(name);
  const items = getItems();
  return (
    items.find((i) => normalizeName(i.name) === key) ??
    items.find((i) => normalizeName(i.name).includes(key)) ??
    items.find((i) => key.includes(normalizeName(i.name)))
  );
}

function asPrio(v: unknown): Prio | undefined {
  return v === 1 || v === 2 || v === 3 ? v : undefined;
}

/** מפעיל את הפעולות על הרשימה ומחזיר תיאור קצר של מה קרה */
export function applyActions(actions: AiAction[]): string[] {
  const log: string[] = [];

  for (const action of actions) {
    const name = action.name.trim();
    if (!name) continue;

    if (action.op === "add") {
      const dept = isDeptId(action.dept) ? action.dept : undefined;
      const prio = asPrio(action.prio) ?? 2;
      const existing = findItem(name);
      if (existing && !existing.done) {
        updateItem(existing.id, { prio });
        log.push(`עודכן: ${existing.name}`);
        continue;
      }
      const item = addItem({
        name,
        dept,
        prio,
        note: typeof action.note === "string" ? action.note : "",
        qty: typeof action.qty === "string" ? action.qty : "",
        by: "עוזר",
      });
      if (dept) {
        rememberProduct(name, dept, prio);
      } else {
        void classifyInBackground(item);
      }
      log.push(`נוסף: ${item.name}`);
      continue;
    }

    const item = findItem(name);
    if (!item) continue;

    if (action.op === "done") {
      updateItem(item.id, { done: true });
      log.push(`סומן כנקנה: ${item.name}`);
    } else if (action.op === "undone") {
      updateItem(item.id, { done: false });
      log.push(`הוחזר לרשימה: ${item.name}`);
    } else if (action.op === "delete") {
      removeItem(item.id);
      log.push(`נמחק: ${item.name}`);
    } else if (action.op === "prio") {
      const prio = asPrio(action.prio);
      if (prio) {
        updateItem(item.id, { prio });
        rememberProduct(item.name, item.dept, prio);
        log.push(`עדיפות עודכנה: ${item.name}`);
      }
    }
  }

  return log;
}
