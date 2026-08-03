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

export type ProductMemory = Record<
  string,
  { dept: DeptId; prio: Prio; count: number }
>;

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
    color: "#EAB308",
    chip: "bg-yellow-50 text-yellow-700 border-yellow-200",
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
