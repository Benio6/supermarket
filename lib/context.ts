import type { Prio } from "./types";
import { detectAll } from "./urgency";

/**
 * הורשת הקשר בתוך שיחה.
 *
 * "ממש בא לי לאסן"            → דחוף, ההקשר נקבע לדחוף
 * "צריך בשביל זה שמנת חמוצה"  → יורש דחוף
 * "וגם בצל"                   → עדיין יורש דחוף
 * "אה ואם רואים תותים"        → מאפס לכשיש
 */

export type ContextReason =
  | "explicit" // אות דחיפות מפורש בטקסט
  | "inherited" // ירש מההקשר הקודם
  | "reset" // ביטוי שמאפס לכשיש
  | "topic" // מעבר לנושא חדש — ההקשר נמחק
  | "mixed" // גם אות חזק וגם איפוס באותו משפט — נותנים למודל להחליט
  | "none"; // אין אינדיקציה

export type ContextDecision = {
  /** העדיפות שיש להחיל על פריטים חדשים בהודעה הזו; null = אין הכרעה */
  prio: Prio | null;
  /** ההקשר שיישאר לקראת ההודעה הבאה */
  nextContext: Prio | null;
  /** האם מותר לדרוס עדיפות שהמודל קבע */
  override: boolean;
  reason: ContextReason;
  matched?: string;
};

/** ביטויים שמורים על המשכיות — הפריט החדש שייך לאותו "פרויקט" */
const CONTINUATION = [
  "בשביל זה",
  "בשביל ה",
  "בשבילו",
  "בשבילה",
  "לזה",
  "כדי להכין",
  "כדי לעשות",
  "צריך גם",
  "וגם",
  "ועוד",
  "תוסיף גם",
  "תביא גם",
  "בנוסף",
  "וצריך",
];

/** ביטויים שמסמנים מעבר לנושא אחר — ההקשר נמחק לגמרי */
const TOPIC_CHANGE = [
  "זהו לגבי",
  "מספיק עם",
  "נושא אחר",
  "משהו אחר",
  "עוד משהו לא קשור",
  "בנפרד",
  "עכשיו לגבי",
  "ולגבי",
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function firstMatch(text: string, phrases: string[]): string | null {
  for (const p of phrases) if (text.includes(p)) return p;
  return null;
}

/**
 * מכריע איזו עדיפות להחיל על ההודעה, ומה יהיה ההקשר להודעה הבאה.
 * `current` הוא ההקשר שנשמר עד כה בשיחה.
 */
export function applyContext(
  text: string,
  current: Prio | null
): ContextDecision {
  const t = normalize(text);
  if (!t) {
    return { prio: null, nextContext: current, override: false, reason: "none" };
  }

  // מעבר נושא מוחק את ההקשר, ואז ממשיכים לנתח את המשפט מאפס
  const topic = firstMatch(t, TOPIC_CHANGE);
  const base = topic ? null : current;

  const matches = detectAll(t);
  const resetHit = matches.find((m) => m.prio === 3);
  const strongHit = matches.find((m) => m.prio === 1 || m.prio === 2);

  // משפט מעורב: "נגמר החלב ואם רואים תותים" — לכל פריט עדיפות אחרת,
  // אז לא כופים כלום והמודל מחליט פר פריט.
  if (resetHit && strongHit) {
    return {
      prio: null,
      nextContext: 3,
      override: false,
      reason: "mixed",
      matched: `${strongHit.phrase} + ${resetHit.phrase}`,
    };
  }

  if (resetHit) {
    return {
      prio: 3,
      nextContext: 3,
      override: true,
      reason: "reset",
      matched: resetHit.phrase,
    };
  }

  if (strongHit?.prio) {
    return {
      prio: strongHit.prio,
      nextContext: strongHit.prio,
      override: true,
      reason: "explicit",
      matched: strongHit.phrase,
    };
  }

  const cont = firstMatch(t, CONTINUATION);
  if (cont && base !== null) {
    return {
      prio: base,
      nextContext: base,
      override: true,
      reason: "inherited",
      matched: cont,
    };
  }

  if (topic) {
    return {
      prio: null,
      nextContext: null,
      override: false,
      reason: "topic",
      matched: topic,
    };
  }

  return { prio: null, nextContext: base, override: false, reason: "none" };
}

/** תיאור קצר להצגה למשתמש, או null כשאין מה להסביר */
export function explainContext(d: ContextDecision): string | null {
  if (d.reason === "inherited") return `באותו הקשר — ${d.matched}`;
  if (d.reason === "reset") return `הקשר אופס — ${d.matched}`;
  return null;
}

export const CONTEXT_RULES_TEXT = `- ביטויי המשך ("בשביל זה", "בשביל ה-X", "כדי להכין", "וגם", "ועוד", "בנוסף") → הפריט החדש **יורש את הדחיפות של הפריט הקודם באותה שיחה**.
- ביטויי איפוס ("ואם רואים", "אם במקרה", "כשיש", "לא דחוף") → הפריט מקבל prio 3 וההקשר מתאפס.
- מעבר נושא ("זהו לגבי X", "עכשיו לגבי", "משהו אחר") → ההקשר נמחק, והפריט הבא נשפט לגופו.`;
