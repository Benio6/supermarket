"use client";

import { boostedPrio, isBoosted, todayIndex } from "./store";
import { orderDeptsByRoute } from "./route";
import {
  deptOf,
  type Dept,
  type DeptId,
  type Item,
  type Prio,
  type ProductMemory,
  type WeekDay,
} from "./types";

/** פריט + העדיפות האפקטיבית שלו אחרי חיזוק לפי יום בשבוע */
export type ItemView = {
  item: Item;
  /** מה שמוצג בפועל — יכול להיות גבוה מ-item.prio */
  prio: Prio;
  /** האם החיזוק הזמני העלה את העדיפות */
  boosted: boolean;
};

export function buildViews(
  items: Item[],
  mem: ProductMemory,
  today: WeekDay = todayIndex()
): ItemView[] {
  return items.map((item) => ({
    item,
    prio: boostedPrio(item, mem, today),
    boosted: isBoosted(item, mem, today),
  }));
}

/** מיון אחיד: לא קנוי לפני קנוי, ואז לפי עדיפות אפקטיבית, ואז לפי זמן הוספה */
export function sortViews(views: ItemView[]): ItemView[] {
  return [...views].sort((a, b) => {
    if (a.item.done !== b.item.done) return a.item.done ? 1 : -1;
    if (a.prio !== b.prio) return a.prio - b.prio;
    return a.item.at - b.item.at;
  });
}

export function filterViews(views: ItemView[], prios: Prio[]): ItemView[] {
  return views.filter((v) => prios.includes(v.prio));
}

/**
 * קיבוץ לפי מחלקה. אם מועבר מסלול נלמד — המחלקות מסודרות לפיו,
 * והשאר נשארות בסדר הקנוני אחריו.
 */
export function groupViews(
  views: ItemView[],
  route?: DeptId[]
): { dept: Dept; views: ItemView[] }[] {
  const order = orderDeptsByRoute(route);
  return order
    .map((id) => ({
      dept: deptOf(id),
      views: views.filter((v) => v.item.dept === id),
    }))
    .filter((g) => g.views.length > 0);
}
