"use client";

import {
  addItem,
  classifyInBackground,
  downgradeItemPrio,
  getItems,
  normalizeName,
  removeItem,
  rememberProduct,
  setUsageDays,
  updateItem,
} from "./store";
import {
  DAY_NAMES,
  PRIO_META,
  deptOf,
  isDeptId,
  type DeptId,
  type Prio,
  type WeekDay,
} from "./types";

export type AiAction =
  | { action: "add"; name: string; dept?: DeptId; prio?: Prio; note?: string; qty?: string }
  | { action: "update_prio"; name: string; prio: Prio }
  | { action: "remove"; name: string }
  | { action: "check"; name: string }
  | { action: "downgrade_prio"; name: string }
  | { action: "set_usage_days"; name: string; usedOn: WeekDay[] };

export type ActionResult = {
  /** אישור קצר להצגה: "הוספתי חלב (דחוף) 🥛" */
  text: string;
  kind: AiAction["action"];
};

const BLOCK = /<ACTIONS>([\s\S]*?)<\/ACTIONS>/;

const VALID = [
  "add",
  "update_prio",
  "remove",
  "check",
  "downgrade_prio",
  "set_usage_days",
];

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
    /* JSON לא תקין — מציגים רק את הטקסט */
  }
  return { text, actions };
}

function isValidAction(a: unknown): a is AiAction {
  if (!a || typeof a !== "object") return false;
  const obj = a as Record<string, unknown>;
  // תמיכה גם ב-"op" מהגרסה הקודמת של הפרוטוקול
  const kind = obj.action ?? obj.op;
  if (typeof kind !== "string" || !VALID.includes(kind)) return false;
  if (typeof obj.name !== "string" || !obj.name.trim()) return false;
  obj.action = kind;
  return true;
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

function label(prio: Prio): string {
  return PRIO_META[prio].label;
}

/** מפעיל את הפעולות על הרשימה ומחזיר אישורים קצרים להצגה בצ'אט */
export function applyActions(actions: AiAction[]): ActionResult[] {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const name = action.name.trim();
    if (!name) continue;

    if (action.action === "add") {
      const dept = isDeptId(action.dept) ? action.dept : undefined;
      const prio = asPrio(action.prio) ?? 2;
      const existing = findItem(name);

      if (existing && !existing.done) {
        updateItem(existing.id, { prio });
        rememberProduct(existing.name, existing.dept, prio);
        results.push({
          kind: "add",
          text: `עדכנתי ${existing.name} (${label(prio)}) ${deptOf(existing.dept).emoji}`,
        });
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
      results.push({
        kind: "add",
        text: `הוספתי ${item.name} (${label(prio)}) ${deptOf(item.dept).emoji}`,
      });
      continue;
    }

    if (action.action === "set_usage_days") {
      const days = Array.isArray(action.usedOn)
        ? (action.usedOn.filter(
            (d) => typeof d === "number" && d >= 0 && d <= 6
          ) as WeekDay[])
        : [];
      setUsageDays(name, days);
      results.push({
        kind: "set_usage_days",
        text: days.length
          ? `אזכור ש${name} לימי ${days.map((d) => DAY_NAMES[d]).join(", ")} 🗓️`
          : `רשמתי ש${name} בלי יום קבוע 🗓️`,
      });
      continue;
    }

    const item = findItem(name);
    if (!item) continue;

    switch (action.action) {
      case "update_prio": {
        const prio = asPrio(action.prio);
        if (!prio) break;
        updateItem(item.id, { prio });
        rememberProduct(item.name, item.dept, prio);
        results.push({
          kind: "update_prio",
          text: `עדכנתי ${item.name} ל${label(prio)} ${PRIO_META[prio].emoji}`,
        });
        break;
      }
      case "downgrade_prio": {
        const next = downgradeItemPrio(item.id);
        if (!next) break;
        results.push({
          kind: "downgrade_prio",
          text: `הורדתי את ${item.name} ל${label(next)} ${PRIO_META[next].emoji}`,
        });
        break;
      }
      case "check": {
        updateItem(item.id, { done: true });
        results.push({ kind: "check", text: `סימנתי ${item.name} כנקנה ✅` });
        break;
      }
      case "remove": {
        removeItem(item.id);
        results.push({ kind: "remove", text: `הסרתי ${item.name} 🗑️` });
        break;
      }
    }
  }

  return results;
}
