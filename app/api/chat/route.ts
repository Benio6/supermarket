import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  DAY_NAMES,
  DEPTS,
  PRIO_META,
  allowedPriosFor,
  deptOf,
  priceLabel,
  type Item,
  type PriceLevel,
  type WeekDay,
} from "@/lib/types";
import { URGENCY_RULES_TEXT } from "@/lib/urgency";
import { CONTEXT_RULES_TEXT } from "@/lib/context";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

type ChatMode = "normal" | "shop" | "consult";

type MemoryHint = { prio: number; usedOn: number[]; confident: boolean };

type Body = {
  messages?: { role: "user" | "assistant"; content: string }[];
  chatMode?: ChatMode;
  items?: Item[];
  imageBase64?: string;
  today?: number;
  store?: { name: string; priceLevel: PriceLevel } | null;
  memory?: Record<string, MemoryHint>;
  contextPrio?: number | null;
  contextReason?: string;
  currentDept?: string | null;
  routeHint?: string | null;
};

const ALLOWED_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

type MediaType = (typeof ALLOWED_MEDIA)[number];

const DEPT_LINES = DEPTS.map((d) => `- ${d.id} = ${d.name} ${d.emoji}`).join("\n");

const PRIO_LINES = ([1, 2, 3] as const)
  .map((p) => `- ${p} = ${PRIO_META[p].label} (${PRIO_META[p].desc})`)
  .join("\n");

const ADD_RULES = `
## מתי מוסיפים מוצר — ומתי לא
**מוסיפים רק כשיש כוונה ברורה לקנות מוצר מסוים.** סימנים לכוונה כזו: "נגמר", "נגמרה", "אין לנו", "חסר", "תוסיף", "צריך", "צריכים", "תביא", "ממש בא לי", או שם של מוצר שנאמר לבד ("חלב", "ביצים ולחם").

**משפטים ניהוליים ושיחתיים הם לעולם לא מוצרים.** אל תפיקו עבורם פעולת add בשום מקרה:
- ניווט ושליטה: "בוא נחזור", "בוא נחזור לצ'אט", "תחזור", "תראה לי", "פתח את הרשימה", "מסך קנייה", "נקה"
- נימוס וסגירה: "תודה", "זהו", "סיימתי", "זה הכל", "אוקיי", "סבבה", "מעולה"
- שאלות ובקשות מידע: "מה יש ברשימה?", "מה חסר?", "כמה פריטים יש?"
- תגובות על מה שאמרת: "לא", "כן", "לא התכוונתי", "טעות"
על משפטים כאלה פשוט עונים במשפט קצר, בלי בלוק פעולות.

**name הוא תמיד שם המוצר בלבד** — "חלב", "שמנת חמוצה", "לחם שיפון". לעולם לא המשפט של המשתמש, ולעולם לא יותר מכמה מילים. "נגמר לנו החלב בבית" → name: "חלב".

**אם לא ברור שמדובר במוצר — שואלים, לא מוסיפים.** למשל "צריך משהו לארוחת ערב" או מילה שאינה מוצר מוכר → שאלו שאלה קצרה אחת ("מה להוסיף?") והוסיפו רק אחרי תשובה. עדיף לשאול פעם אחת מיותרת מאשר להוסיף פריט שגוי לרשימה.
`.trim();

const ACTIONS_PROTOCOL = `
${ADD_RULES}

## עדכון הרשימה
כשצריך לשנות משהו ברשימה, הוסיפו בסוף התשובה בלוק פעולות. הבלוק לא מוצג למשתמש — הוא מבוצע אוטומטית והמשתמש רואה אישור קצר לכל פעולה.

<ACTIONS>
[
  { "action": "add", "name": "חלב", "dept": "dairy", "prio": 1 },
  { "action": "update_prio", "name": "קמח", "prio": 2 },
  { "action": "remove", "name": "עגבניות" },
  { "action": "check", "name": "לחם" },
  { "action": "downgrade_prio", "name": "שמן" }
]
</ACTIONS>

הפעולות:
- \`add\` — הוספת פריט. שדות רשות: dept, prio, note, qty
- \`update_prio\` — קביעת עדיפות מדויקת (חובה prio)
- \`downgrade_prio\` — הורדת דחיפות בשלב אחד. **לא מוחק** פריט
- \`check\` — סימון כנקנה
- \`remove\` — מחיקה מהרשימה
- \`set_usage_days\` — שמירת ימי השימוש במוצר, למשל { "action": "set_usage_days", "name": "קמח", "usedOn": [5] }

מזהי מחלקות:
${DEPT_LINES}

רמות עדיפות:
${PRIO_LINES}

כללים:
- בלוק אחד לכל היותר בכל תשובה, ורק כשבאמת צריך לשנות משהו.
- ב-name לפעולות על פריט קיים — השם המדויק כפי שהוא ברשימה.
- אל תזכירו את הבלוק בטקסט ואל תפרטו את הפעולות — המשתמש כבר רואה אישור לכל אחת. כתבו משפט קצר וטבעי בלבד.
`.trim();

function contextSection(contextPrio: number | null): string {
  const active =
    contextPrio === 1 || contextPrio === 2 || contextPrio === 3
      ? `**ההקשר הפעיל בשיחה כרגע: ${PRIO_META[contextPrio].label} (prio ${contextPrio}).** פריט שנאמר בהמשך לאותו הקשר יורש את הדחיפות הזו.`
      : "אין כרגע הקשר פעיל.";
  return `
## הורשת הקשר בתוך השיחה
${active}

${CONTEXT_RULES_TEXT}

דוגמה:
"ממש בא לי לאסן" → לאסן prio 1, ההקשר נקבע לדחוף
"צריך בשביל זה שמנת חמוצה" → שמנת prio 1 (ירשה)
"וגם בצל" → בצל prio 1 (עדיין באותו הקשר)
"אה ואם רואים תותים" → תותים prio 3, ההקשר מתאפס
`.trim();
}

const URGENCY_SECTION = `
## זיהוי דחיפות מהטקסט
${URGENCY_RULES_TEXT}

"קניתי רק אחד" או "לקחתי חצי" אף פעם לא מוחקים פריט — רק מורידים דחיפות בשלב אחד.
`.trim();

function learningSection(memory: Record<string, MemoryHint>): string {
  const known = Object.entries(memory);
  if (known.length === 0) {
    return `
## למידה
עוד לא למדנו שום מוצר. כשמוסיפים מוצר בפעם הראשונה מותר לשאול שאלה קצרה אחת (למשל "מתי אתם משתמשים בקמח?") — ואז לשמור עם set_usage_days ולא לשאול שוב לעולם.
`.trim();
  }

  const confident = known.filter(([, e]) => e.confident).map(([n]) => n);
  const withDays = known
    .filter(([, e]) => e.usedOn.length > 0)
    .map(([n, e]) => `${n} → ${e.usedOn.map((d) => DAY_NAMES[d]).join("/")}`);

  return `
## למידה
מוצרים שכבר למדנו — **אל תשאלו עליהם שום דבר**, פשוט הוסיפו בעדיפות שנשמרה:
${confident.length ? confident.join(", ") : "— אין עדיין —"}

ימי שימוש ידועים (אל תשאלו שוב):
${withDays.length ? withDays.join("\n") : "— אין עדיין —"}

למוצר חדש לגמרי מותר לשאול שאלה קצרה אחת על יום השימוש, ואז לשמור עם set_usage_days.
`.trim();
}

function systemFor(
  mode: ChatMode,
  items: Item[],
  today: WeekDay,
  store: { name: string; priceLevel: PriceLevel } | null,
  memory: Record<string, MemoryHint>,
  contextPrio: number | null,
  currentDept: string | null,
  routeHint: string | null
): string {
  const base = `אתה עוזר קניות משפחתי באפליקציה בעברית. דבר עברית טבעית, ידידותית וקצרה. השתמש באימוג'ים במידה. אל תשתמש ב-Markdown מורכב.

**היום יום ${DAY_NAMES[today]}.** מוצר שמשויך ליום שימוש שמתקרב — העלה לו את הדחיפות. מוצר שהיום הוא יום השימוש שלו — דחוף (prio 1).

${listContext(items)}

${learningSection(memory)}`;

  if (mode === "shop") {
    const storeLine = store
      ? `המשתמש נמצא ב**${store.name}** (${priceLabel(store.priceLevel)}). בסופר הזה מציגים רק עדיפויות: ${allowedPriosFor(store.priceLevel).join(", ")}.
${
  store.priceLevel >= 4
    ? "זה סופר יקר — אל תציע לקנות פריטים שאינם דחופים. אם שואלים על פריט לא דחוף, אמור שעדיף לחכות לסופר זול יותר."
    : store.priceLevel === 3
      ? "סופר בינוני — דחוף ורגיל כן, 'כשיש' עדיף לדחות."
      : "סופר זול — אפשר לקנות הכל, כולל פריטי 'כשיש'."
}`
      : "עוד לא ידוע באיזה סופר המשתמש נמצא. שאל אותו קודם.";

    const routeLine = routeHint
      ? `\n## המסלול הרגיל בסופר הזה
המשתמש כבר הלך כאן כמה פעמים ואנחנו מכירים את הסדר שלו.
${currentDept ? `הוא נמצא עכשיו ב**${deptOf(currentDept as never).name}**.` : ""}
**כשהוא מסיים במחלקה הנוכחית, הנחה אותו למחלקה הבאה בניסוח הזה בדיוק:**
"${routeHint}"
אל תמציא סדר אחר ואל תוסיף מחלקות שאין בהן פריטים.`
      : `\n## מסלול
עוד לא למדנו את סדר המחלקות בסופר הזה. אם המשתמש מדווח איפה הוא ("אני במחלקת ירקות", "עברתי לחלב") — פשוט המשך לעזור, הסדר נלמד ברקע.`;

    return `${base}

## המצב הנוכחי: 🛒 סופר
${storeLine}

- הנחה מחלקה־מחלקה לפי סדר המחלקות ברשימה.
- כשהוא אומר שקנה משהו — \`check\` מיד.
- "קניתי רק אחד" / "לקחתי חצי" → \`downgrade_prio\`, לא \`check\` ולא \`remove\`.
- תשובות קצרות מאוד. הוא עסוק, מחזיק טלפון ביד אחת.
- אם צילם מוצר — אמור אם הוא מתאים למה שברשימה.
${routeLine}

${URGENCY_SECTION}

${contextSection(contextPrio)}

${ACTIONS_PROTOCOL}`;
  }

  if (mode === "consult") {
    return `${base}

## המצב הנוכחי: 💬 ייעוץ
ענה על שאלות לגבי מוצרים: השוואות, ערך תזונתי, איך בוחרים, תחליפים, מה מתאים למתכון.
- **אסור לך לשנות את הרשימה בשום צורה.** אל תפיק בלוק פעולות בכלל.
- אם המשתמש מבקש להוסיף משהו, הצע לו לעבור למצב 🏠 רגיל.
- אם צילם מוצר — נתח אותו: מה זה, איכות, למה לשים לב.
- תשובה של 2–4 משפטים, לעניין.`;
  }

  return `${base}

## המצב הנוכחי: 🏠 רגיל
המשתמש כותב בשפה חופשית מה חסר בבית ("נגמר החלב", "תוסיף לחם וביצים לשבת").
- פרק משפט לכמה פריטים כשצריך, והוסף כל אחד בנפרד.
- קבע מחלקה ועדיפות בעצמך; אל תשאל שאלות מיותרות על פריט שכבר ברור שהוא מוצר. אם לא ברור שזה מוצר בכלל — שאל (ראו "מתי מוסיפים מוצר").
- אם המשתמש כותב "זהו" / "תודה" / "סיימתי" — סכם במשפט אחד. הסיכום המפורט מוצג אוטומטית מתחת לתשובה, אל תחזור עליו.

${URGENCY_SECTION}

${contextSection(contextPrio)}

${ACTIONS_PROTOCOL}`;
}

function listContext(items: Item[]): string {
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  if (items.length === 0) return "## הרשימה כרגע\nהרשימה ריקה.";

  const line = (i: Item) =>
    `- ${i.name} | ${deptOf(i.dept).name} | ${PRIO_META[i.prio].label}${
      i.note ? ` | הערה: ${i.note}` : ""
    }`;

  return `## הרשימה כרגע
### עוד לא נקנה (${open.length})
${open.length ? open.map(line).join("\n") : "— אין —"}

### כבר נקנה (${done.length})
${done.length ? done.map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ""}`).join("\n") : "— אין —"}`;
}

function parseDataUrl(
  dataUrl: string
): { mediaType: MediaType; data: string } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mediaType = match[1].toLowerCase();
  if (!(ALLOWED_MEDIA as readonly string[]).includes(mediaType)) return null;
  return { mediaType: mediaType as MediaType, data: match[2] };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "חסר מפתח API. הוסיפו ANTHROPIC_API_KEY לקובץ .env.local והפעילו מחדש." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const chatMode: ChatMode =
    body.chatMode === "shop" || body.chatMode === "consult"
      ? body.chatMode
      : "normal";
  const items = Array.isArray(body.items) ? body.items : [];
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const today = (
    typeof body.today === "number" && body.today >= 0 && body.today <= 6
      ? body.today
      : new Date().getDay()
  ) as WeekDay;
  const store = body.store ?? null;
  const memory =
    body.memory && typeof body.memory === "object" ? body.memory : {};
  const contextPrio =
    body.contextPrio === 1 || body.contextPrio === 2 || body.contextPrio === 3
      ? body.contextPrio
      : null;
  const currentDept =
    typeof body.currentDept === "string" ? body.currentDept : null;
  const routeHint =
    typeof body.routeHint === "string" && body.routeHint.trim()
      ? body.routeHint
      : null;

  const history = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-20);

  if (history.length === 0) {
    return NextResponse.json({ error: "לא נשלחה הודעה" }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const image = body.imageBase64 ? parseDataUrl(body.imageBase64) : null;
  const last = messages[messages.length - 1];
  if (image && last.role === "user") {
    last.content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.data,
        },
      },
      { type: "text", text: typeof last.content === "string" ? last.content : "" },
    ];
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemFor(
        chatMode,
        items,
        today,
        store,
        memory,
        contextPrio,
        currentDept,
        routeHint
      ),
      messages,
    });

    if ((response.stop_reason as string) === "refusal") {
      return NextResponse.json({
        reply: "מצטער, לא אוכל לעזור עם זה. אפשר לנסות לנסח אחרת?",
      });
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: reply || "לא הצלחתי לנסח תשובה. נסו שוב." });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "מפתח ה-API לא תקין. בדקו את ANTHROPIC_API_KEY ב-.env.local." },
        { status: 500 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "יותר מדי בקשות כרגע. נסו שוב בעוד רגע." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `שגיאה מהשרת (${err.status ?? "?"}). נסו שוב.` },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "שגיאה לא צפויה. נסו שוב." }, { status: 500 });
  }
}
