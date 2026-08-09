import type { Prio } from "./types";

export type UrgencySignal = {
  /** עדיפות מוחלטת שזוהתה */
  prio?: Prio;
  /** הורדת דחיפות בשלב אחד (בלי למחוק) */
  downgrade?: boolean;
  /** הביטוי שזוהה — לשקיפות מול המשתמש */
  matched: string;
};

type Rule = { phrases: string[]; prio?: Prio; downgrade?: true };

/**
 * הסדר קריטי: ביטוי ספציפי חייב להיבדק לפני ביטוי כללי שמוכל בו.
 * "כמעט נגמר" מכיל "נגמר" — בלי הסדר הזה הוא היה נקרא כדחוף במקום רגיל.
 */
const RULES: Rule[] = [
  // הורדת דחיפות — נבדק ראשון כדי לגבור על "נגמר" במשפט כמו "נגמר אז קניתי רק אחד"
  {
    phrases: ["קניתי רק אחד", "לקחתי חצי", "קניתי חצי", "לקחתי רק אחד", "לקחתי רק"],
    downgrade: true,
  },
  // כשיש / לא דחוף
  {
    phrases: [
      "לא דחוף",
      "כשיש",
      "כש יש",
      "אם רואים",
      "אם תראה",
      "אם במקרה",
      "במקרה יש",
      "אם יש",
      "אם נתקל",
      "לא בוער",
    ],
    prio: 3,
  },
  // כמעט נגמר
  {
    phrases: ["כמעט נגמר", "עוד מעט נגמר", "נשאר אחד", "נשאר אחרון", "האחרון", "אחרון"],
    prio: 2,
  },
  // נגמר / חשק חזק
  {
    phrases: [
      "נגמר לגמרי",
      "נגמר",
      "אין לנו",
      "אזל",
      "ממש בא לי",
      "בא לי ממש",
      "חושק ב",
      "חושקת ב",
      "מת על",
      "מתה על",
      "ממש רוצה",
      "חייב",
      "חייבת",
      "דחוף",
    ],
    prio: 1,
  },
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export type UrgencyMatch = { prio?: Prio; downgrade?: boolean; phrase: string };

/**
 * מחזיר את *כל* ההתאמות בטקסט, לא רק הראשונה.
 * נחוץ כדי לזהות משפט מעורב כמו "נגמר החלב ואם רואים תותים" —
 * שם אסור להחיל עדיפות אחת על כל הפריטים.
 */
export function detectAll(text: string): UrgencyMatch[] {
  const t = normalize(text);
  if (!t) return [];
  const out: UrgencyMatch[] = [];
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (t.includes(phrase)) {
        out.push(
          rule.downgrade
            ? { downgrade: true, phrase }
            : { prio: rule.prio, phrase }
        );
        break; // ביטוי אחד לכל כלל מספיק
      }
    }
  }
  return out;
}

/** מזהה אות דחיפות בטקסט חופשי. מחזיר null אם אין התאמה. */
export function detectUrgency(text: string): UrgencySignal | null {
  const t = normalize(text);
  if (!t) return null;

  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (t.includes(phrase)) {
        return rule.downgrade
          ? { downgrade: true, matched: phrase }
          : { prio: rule.prio, matched: phrase };
      }
    }
  }
  return null;
}

/** מוריד דחיפות בשלב אחד — 1→2, 2→3, 3 נשאר 3. אף פעם לא מוחק. */
export function downgrade(prio: Prio): Prio {
  return prio === 1 ? 2 : 3;
}

/** מעלה דחיפות בשלב אחד — 3→2, 2→1, 1 נשאר 1. */
export function upgrade(prio: Prio): Prio {
  return prio === 3 ? 2 : 1;
}

/** תיאור הכללים עבור ה-system prompt, כדי שהמודל והלקוח יסכימו ביניהם */
export const URGENCY_RULES_TEXT = `- "נגמר" / "אין לנו" / "נגמר לגמרי" / "אזל" → prio 1
- "ממש בא לי" / "חושק ב" / "מת על" / "ממש רוצה" → prio 1
- "כמעט נגמר" / "נשאר אחד" / "אחרון" → prio 2
- "כשיש" / "אם רואים" / "לא דחוף" → prio 3
- "קניתי רק אחד" / "לקחתי חצי" → downgrade_prio (הורדה בשלב אחד, לא מחיקה)`;
