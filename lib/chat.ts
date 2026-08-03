"use client";

export type ChatMode = "normal" | "shop" | "consult";

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  /** data URL — קיים רק בזיכרון, לא נשמר ב-localStorage */
  image?: string;
  /** סימון שההודעה כללה תמונה, כדי שאחרי טעינה מחדש עדיין נראה את זה */
  hadImage?: boolean;
  log?: string[];
};

export type ChatState = { mode: ChatMode; messages: ChatMsg[] };

const KEY = "fam-chat";
/** תקרה כדי שהאחסון לא יגדל בלי גבול */
const MAX_MESSAGES = 60;

type Stored = { v: 1; mode: ChatMode; messages: ChatMsg[] };

function isMode(v: unknown): v is ChatMode {
  return v === "normal" || v === "shop" || v === "consult";
}

function isMsg(v: unknown): v is ChatMsg {
  if (!v || typeof v !== "object") return false;
  const m = v as ChatMsg;
  return (
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
}

/**
 * מסירה את ה-data URL של התמונות לפני השמירה.
 * תמונה אחת בבסיס־64 יכולה לתפוס כמה מגה — זה ימלא את המכסה של localStorage
 * (בערך 5MB) אחרי שתיים־שלוש הודעות.
 */
function forStorage(messages: ChatMsg[]): ChatMsg[] {
  return messages.slice(-MAX_MESSAGES).map(({ image, ...rest }) => ({
    ...rest,
    ...(image ? { hadImage: true } : {}),
  }));
}

export function loadChat(): ChatState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || parsed.v !== 1) return null;
    return {
      mode: isMode(parsed.mode) ? parsed.mode : "normal",
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.filter(isMsg)
        : [],
    };
  } catch {
    return null;
  }
}

export function saveChat(state: ChatState): void {
  if (typeof window === "undefined") return;
  const write = (messages: ChatMsg[]) => {
    const payload: Stored = { v: 1, mode: state.mode, messages };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  };

  const messages = forStorage(state.messages);
  try {
    write(messages);
  } catch {
    // מכסת האחסון מלאה — מנסים שוב עם החלק האחרון של השיחה בלבד
    try {
      write(messages.slice(-10));
    } catch {
      /* עדיין נכשל (מצב פרטי / אחסון חסום) — ממשיכים בלי שמירה */
    }
  }
}

export function clearChat(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* מתעלמים */
  }
}
