export const DEPTS = [
  { id: "produce", name: "פירות וירקות", emoji: "🥦" },
  { id: "dairy", name: "חלב וביצים", emoji: "🥛" },
  { id: "meat", name: "בשר ודגים", emoji: "🥩" },
  { id: "bakery", name: "לחם ומאפים", emoji: "🍞" },
  { id: "pantry", name: "שימורים ויבשים", emoji: "🥫" },
  { id: "drinks", name: "משקאות", emoji: "🧃" },
  { id: "frozen", name: "קפואים", emoji: "🧊" },
  { id: "cleaning", name: "ניקיון", emoji: "🧴" },
  { id: "snacks", name: "חטיפים וממתקים", emoji: "🍫" },
  { id: "other", name: "אחר", emoji: "🛒" },
] as const;

export type Dept = (typeof DEPTS)[number];
export type DeptId = Dept["id"];
export type Prio = 1 | 2 | 3;

export type Item = {
  id: string;
  name: string;
  dept: DeptId;
  prio: Prio;
  note: string;
  by: string;
  at: number;
  done: boolean;
  qty: string;
};

/** יום בשבוע — 0 = ראשון, 6 = שבת (תואם ל-Date.getDay) */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
] as const;

export type ProductMemoryEntry = {
  dept: DeptId;
  prio: Prio;
  /** באילו ימים בשבוע משתמשים במוצר */
  usedOn: WeekDay[];
  /** כמה פעמים ברציפות נוסף עם אותה עדיפות */
  count: number;
  /** כמה פעמים כבר שאלנו על המוצר — כדי לא לשאול שוב */
  askCount: number;
};

export type ProductMemory = Record<string, ProductMemoryEntry>;

/** אחרי כמה פעמים עם אותה עדיפות מפסיקים לשאול */
export const CONFIDENT_AFTER = 3;

export type PriceLevel = 1 | 2 | 3 | 4 | 5;

export type Store = {
  id: string;
  name: string;
  priceLevel: PriceLevel;
  lastVisited: number;
  /** סדר המחלקות שנלמד מהביקורים בסופר הזה */
  route?: DeptId[];
  /** כמה ביקורים כבר תרמו למסלול */
  routeVisits?: number;
  /** הביקורים האחרונים, שמהם מחושב הממוצע */
  routeHistory?: DeptId[][];
};

/** מכמה ביקורים המסלול נחשב אמין מספיק כדי להנחות לפיו */
export const ROUTE_CONFIDENT_AFTER = 2;

export const PRICE_OPTIONS: {
  level: PriceLevel;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { level: 1, label: "זול", emoji: "💚", desc: "מציג הכל" },
  { level: 3, label: "רגיל", emoji: "💛", desc: "דחוף + רגיל" },
  { level: 5, label: "יקר", emoji: "❤️", desc: "רק דחוף" },
];

export function priceLabel(level: PriceLevel): string {
  return (
    PRICE_OPTIONS.find((p) => p.level === level)?.label ??
    (level >= 4 ? "יקר" : level === 3 ? "רגיל" : "זול")
  );
}

/** אילו עדיפויות מציגים בסופר לפי רמת המחיר שלו */
export function allowedPriosFor(level: PriceLevel): Prio[] {
  if (level >= 4) return [1];
  if (level === 3) return [1, 2];
  return [1, 2, 3];
}

export const DEPT_IDS = DEPTS.map((d) => d.id) as DeptId[];

export function deptOf(id: DeptId): Dept {
  return DEPTS.find((d) => d.id === id) ?? DEPTS[DEPTS.length - 1];
}

export function isDeptId(v: unknown): v is DeptId {
  return typeof v === "string" && (DEPT_IDS as string[]).includes(v);
}

export const PRIO_META: Record<
  Prio,
  { emoji: string; label: string; desc: string; color: string; chip: string }
> = {
  1: {
    emoji: "🔴",
    label: "דחוף",
    desc: "נגמר לגמרי — צריך את זה היום",
    color: "#DC2626",
    chip: "bg-red-50 text-red-700 border-red-200",
  },
  2: {
    emoji: "🟡",
    label: "רגיל",
    desc: "עוד מעט נגמר — בקנייה הקרובה",
    color: "#EA580C",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
  },
  3: {
    emoji: "🟢",
    label: "כשיש",
    desc: "אם נתקלים ויש מקום בעגלה",
    color: "#16A34A",
    chip: "bg-green-50 text-green-700 border-green-200",
  },
};

export type FilterId = "all" | "urgent" | "urgent_normal";

export const FILTERS: { id: FilterId; label: string; prios: Prio[] }[] = [
  { id: "all", label: "הכל", prios: [1, 2, 3] },
  { id: "urgent", label: "🔴 דחוף", prios: [1] },
  { id: "urgent_normal", label: "🔴🟡 דחוף + רגיל", prios: [1, 2] },
];

export function filterItems(items: Item[], filter: FilterId): Item[] {
  const prios = FILTERS.find((f) => f.id === filter)?.prios ?? [1, 2, 3];
  return items.filter((i) => prios.includes(i.prio));
}

/** קיבוץ לפי מחלקה, בסדר הקבוע של DEPTS */
export function groupByDept(items: Item[]): { dept: Dept; items: Item[] }[] {
  return DEPTS.map((dept) => ({
    dept,
    items: items.filter((i) => i.dept === dept.id),
  })).filter((g) => g.items.length > 0);
}
