import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEPTS, PRIO_META, deptOf, type Item } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

type ChatMode = "normal" | "shop" | "consult";

type Body = {
  messages?: { role: "user" | "assistant"; content: string }[];
  chatMode?: ChatMode;
  items?: Item[];
  imageBase64?: string;
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

const ACTIONS_PROTOCOL = `
## עדכון הרשימה
כשצריך לשנות משהו ברשימה, הוסיפו בסוף התשובה בלוק פעולות. הבלוק לא מוצג למשתמש — הוא מבוצע אוטומטית.

<ACTIONS>[{"op":"add","name":"חלב 3%","dept":"dairy","prio":1,"note":"תנובה"}]</ACTIONS>

פעולות אפשריות:
- {"op":"add","name":"...","dept":"...","prio":1|2|3,"note":"...","qty":"..."} — הוספת פריט (dept, note ו-qty אופציונליים)
- {"op":"done","name":"..."} — סימון כנקנה
- {"op":"undone","name":"..."} — החזרה לרשימה
- {"op":"delete","name":"..."} — מחיקה
- {"op":"prio","name":"...","prio":1|2|3} — שינוי עדיפות

מזהי מחלקות:
${DEPT_LINES}

רמות עדיפות:
${PRIO_LINES}

כללים:
- בלוק אחד לכל היותר בכל תשובה, ורק כשבאמת צריך לשנות משהו.
- ב-name לפעולות על פריט קיים — השתמשו בשם המדויק כפי שהוא מופיע ברשימה.
- אל תזכירו את הבלוק בטקסט. פשוט כתבו בעברית מה עשיתם ("הוספתי חלב ולחם 👍").
`.trim();

function systemFor(mode: ChatMode, items: Item[]): string {
  const base = `אתה עוזר קניות משפחתי באפליקציה בעברית. דבר עברית טבעית, ידידותית וקצרה. השתמש באימוג'ים במידה. אל תשתמש ב-Markdown מורכב — טקסט פשוט וקצר.

${listContext(items)}`;

  if (mode === "shop") {
    return `${base}

## המצב הנוכחי: 🛒 סופר
המשתמש נמצא עכשיו בחנות עם העגלה.
- הנחה אותו מחלקה־מחלקה לפי סדר המחלקות ברשימה, ותן לו לרכז קניות באותו אזור.
- כשהוא אומר שקנה משהו — סמן את זה כנקנה מיד.
- תשובות קצרות מאוד. הוא עסוק, מחזיק טלפון ביד אחת.
- הזכר קודם את הפריטים הדחופים 🔴.
- אם צילם מוצר — אמור אם זה מתאים למה שברשימה.

${ACTIONS_PROTOCOL}`;
  }

  if (mode === "consult") {
    return `${base}

## המצב הנוכחי: 💬 ייעוץ
ענה על שאלות לגבי מוצרים: השוואות, ערך תזונתי, איך בוחרים, תחליפים, מה מתאים למתכון.
- **אסור לך לשנות את הרשימה בשום צורה.** אל תפיק בלוק פעולות בכלל.
- אם המשתמש מבקש להוסיף משהו, הצע לו לעבור למצב 🏠 רגיל.
- אם צילם מוצר — נתח אותו: מה זה, איכות, מה כדאי לשים לב אליו.
- תשובה של 2–4 משפטים, לעניין.`;
  }

  return `${base}

## המצב הנוכחי: 🏠 רגיל
המשתמש כותב בשפה חופשית מה חסר בבית ("נגמר החלב", "תוסיף לחם וביצים לשבת").
- פרק משפט לכמה פריטים כשצריך, והוסף כל אחד בנפרד.
- קבע מחלקה ועדיפות הגיוניות בעצמך; אל תשאל שאלות מיותרות.
- "נגמר" / "חייבים" / "דחוף" → עדיפות 1. ברירת מחדל → 2. "אם יש" / "כדאי" → 3.
- אם צילם מוצר — זהה אותו והוסף לרשימה.
- אשר בקצרה מה עשית.

${ACTIONS_PROTOCOL}`;
}

function listContext(items: Item[]): string {
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  if (items.length === 0) return "## הרשימה כרגע\nהרשימה ריקה.";

  const line = (i: Item) =>
    `- ${i.name} | ${deptOf(i.dept).name} | ${PRIO_META[i.prio].label}${
      i.note ? ` | הערה: ${i.note}` : ""
    }${i.by ? ` | הוסיף/ה: ${i.by}` : ""}`;

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

  // רק 20 ההודעות האחרונות, בלי הודעות ריקות
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

  // צירוף תמונה להודעת המשתמש האחרונה
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
      system: systemFor(chatMode, items),
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
