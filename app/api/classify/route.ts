import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEPTS, DEPT_IDS } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

const SYSTEM = `אתה מסווג מוצרי סופרמרקט למחלקות.
קלט: שם מוצר בעברית. פלט: מזהה המחלקה בלבד, באנגלית, בלי שום טקסט נוסף.

המחלקות:
${DEPTS.map((d) => `${d.id} = ${d.name}`).join("\n")}

אם אינך בטוח — החזר other. אל תסביר, אל תוסיף ניקוד או סימני פיסוק. רק המזהה.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json({ dept: null }, { status: 200 });
  }

  let name = "";
  try {
    const body = (await req.json()) as { name?: string };
    name = (body.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  if (!name) return NextResponse.json({ error: "חסר שם מוצר" }, { status: 400 });

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: name }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .toLowerCase();

    const dept = DEPT_IDS.find((id) => text.includes(id)) ?? "other";
    return NextResponse.json({ dept });
  } catch {
    // כישלון בסיווג הוא לא קריטי — הפריט פשוט נשאר איפה שהוא
    return NextResponse.json({ dept: null }, { status: 200 });
  }
}
