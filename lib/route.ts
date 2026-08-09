import { DEPTS, deptOf, type DeptId, type Item } from "./types";

/**
 * למידת מסלול הליכה בסופר.
 * המשתמש מדווח איפה הוא ("אני במחלקת ירקות", "עברתי לחלב"),
 * ומהסדר הזה נלמד המסלול הקבוע של אותו סניף.
 */

/** מילות רמז שמסמנות דיווח מיקום, ולא בקשה להוסיף מוצר */
const LOCATION_CUES = [
  "אני ב",
  "אני עכשיו ב",
  "עברתי ל",
  "עובר ל",
  "הגעתי ל",
  "מגיע ל",
  "עכשיו ב",
  "נמצא ב",
  "נמצאת ב",
  "במחלקת",
  "במחלקה",
  "אני ליד",
  "עומד ב",
  "עומדת ב",
];

/** מילים שמזהות מחלקה. הסדר בתוך כל מחלקה לא משנה. */
const DEPT_WORDS: Record<DeptId, string[]> = {
  produce: ["ירקות", "פירות", "ירק", "פירות וירקות", "פרי"],
  dairy: ["חלב", "מוצרי חלב", "גבינות", "גבינה", "ביצים", "יוגורט"],
  meat: ["בשר", "דגים", "קצביה", "קצבייה", "עוף"],
  bakery: ["לחם", "מאפים", "מאפייה", "מאפיה", "לחמים"],
  pantry: ["שימורים", "יבשים", "מזווה", "אורז", "פסטה", "קטניות"],
  drinks: ["משקאות", "שתייה", "שתיה", "מיצים"],
  frozen: ["קפואים", "קפוא", "הקפאה", "מקפיא"],
  cleaning: ["ניקיון", "חומרי ניקוי", "נקיון", "כביסה"],
  snacks: ["חטיפים", "ממתקים", "חטיף", "שוקולד"],
  other: ["אחר", "כללי"],
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * מזהה דיווח על מחלקה. מחייב מילת רמז של מיקום —
 * "תוסיף חלב" הוא בקשה להוסיף מוצר, לא הודעה שאנחנו במחלקת חלב.
 */
export function detectDeptVisit(text: string): DeptId | null {
  const t = normalize(text);
  if (!t) return null;
  if (!LOCATION_CUES.some((cue) => t.includes(cue))) return null;

  // המחלקה עם ההתאמה המוקדמת ביותר בטקסט — הקרובה לרמז המיקום
  let best: { dept: DeptId; at: number } | null = null;
  for (const [dept, words] of Object.entries(DEPT_WORDS) as [DeptId, string[]][]) {
    for (const w of words) {
      const at = t.indexOf(w);
      if (at !== -1 && (best === null || at < best.at)) {
        best = { dept, at };
      }
    }
  }
  return best?.dept ?? null;
}

/** מוסיף מחלקה לרצף הביקור, בלי כפילות רצופה */
export function appendVisit(seq: DeptId[], dept: DeptId): DeptId[] {
  if (seq.length && seq[seq.length - 1] === dept) return seq;
  return [...seq, dept];
}

/** כמה ביקורים אחרונים נכללים בממוצע */
export const ROUTE_HISTORY_SIZE = 5;

function canonicalIndex(dept: DeptId): number {
  return DEPTS.findIndex((d) => d.id === dept);
}

/** מוסיף ביקור להיסטוריה ושומר רק את האחרונים */
export function pushRouteHistory(
  history: DeptId[][],
  observed: DeptId[],
  size = ROUTE_HISTORY_SIZE
): DeptId[][] {
  if (observed.length === 0) return history;
  return [...history, observed].slice(-size);
}

/**
 * מחשב מסלול כממוצע המיקומים על פני הביקורים האחרונים.
 *
 * הממוצע מחושב תמיד מחדש מההיסטוריה ולא מהמסלול הקודם — אחרת הסדר
 * הישן משמש גם כקלט וגם כפלט, ומשקלו רק גדל, כך שמסלול שהשתנה
 * בפועל לא היה מצליח להתעדכן לעולם.
 *
 * מחלקה שנצפתה בחלק מהביקורים בלבד נשפטת לפי הממוצע שלה בלבד,
 * ולא "נענשת" על ביקורים שבהם לא עברו בה.
 */
export function averageRoutes(history: DeptId[][]): DeptId[] {
  const seqs = history.filter((h) => h.length > 0);
  if (seqs.length === 0) return [];

  const stats = new Map<DeptId, { total: number; n: number }>();
  for (const seq of seqs) {
    seq.forEach((dept, i) => {
      const cur = stats.get(dept) ?? { total: 0, n: 0 };
      cur.total += i;
      cur.n += 1;
      stats.set(dept, cur);
    });
  }

  return [...stats.keys()].sort((a, b) => {
    const A = stats.get(a)!;
    const B = stats.get(b)!;
    const diff = A.total / A.n - B.total / B.n;
    if (diff !== 0) return diff;
    return canonicalIndex(a) - canonicalIndex(b);
  });
}

/** סדר המחלקות לתצוגה: קודם לפי המסלול, והשאר בסדר הקנוני */
export function orderDeptsByRoute(route: DeptId[] | undefined): DeptId[] {
  const canonical = DEPTS.map((d) => d.id);
  if (!route || route.length === 0) return canonical;
  const inRoute = route.filter((d) => canonical.includes(d));
  const rest = canonical.filter((d) => !inRoute.includes(d));
  return [...inRoute, ...rest];
}

/** המחלקה הבאה במסלול אחרי `current`, שיש בה פריטים פתוחים */
export function nextStopInRoute(
  route: DeptId[] | undefined,
  current: DeptId | null,
  openItems: Item[]
): { dept: DeptId; items: Item[] } | null {
  const order = orderDeptsByRoute(route);
  const startAt = current ? order.indexOf(current) + 1 : 0;
  if (startAt <= 0 && current) return null;

  for (let i = startAt; i < order.length; i++) {
    const dept = order[i];
    const items = openItems.filter((it) => it.dept === dept);
    if (items.length) return { dept, items };
  }
  return null;
}

/** ניסוח ההנחיה: "לפי המסלול הרגיל שלך, הבא הוא חלב וביצים – יש לך שם: חלב 3% (דחוף)" */
export function routeHint(
  next: { dept: DeptId; items: Item[] } | null
): string | null {
  if (!next) return null;
  const dept = deptOf(next.dept);
  const list = next.items
    .slice(0, 4)
    .map((i) => `${i.name} (${i.prio === 1 ? "דחוף" : i.prio === 2 ? "רגיל" : "כשיש"})`)
    .join(", ");
  return `לפי המסלול הרגיל שלך, הבא הוא ${dept.name} ${dept.emoji} – יש לך שם: ${list}`;
}
