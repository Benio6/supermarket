"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StorePicker from "@/components/StorePicker";
import ViewPanel from "@/components/ViewPanel";
import { detectMode, detectViewRequest, type ChatView } from "@/lib/intent";
import { applyActions, parseActions, type ActionResult } from "@/lib/aiActions";
import {
  clearChat,
  loadChat,
  saveChat,
  type ChatMode,
  type ChatMsg,
} from "@/lib/chat";
import { readMemory, refreshItems, todayIndex, useItems } from "@/lib/store";
import { activeStore, recordRoute, routeIsConfident, useStores } from "@/lib/stores";
import {
  appendVisit,
  detectDeptVisit,
  nextStopInRoute,
  routeHint,
} from "@/lib/route";
import {
  DAY_NAMES,
  ROUTE_CONFIDENT_AFTER,
  deptOf,
  priceLabel,
  type DeptId,
  type Store,
} from "@/lib/types";
import { applyContext, explainContext } from "@/lib/context";
import type { Prio } from "@/lib/types";

const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: "normal", label: "🏠 רגיל", hint: "מוסיף ומעדכן פריטים ברשימה" },
  { id: "shop", label: "🛒 סופר", hint: "מלווה אתכם בין המחלקות" },
  { id: "consult", label: "💬 ייעוץ", hint: "עונה על שאלות, לא נוגע ברשימה" },
];

/** ביטויים שמסמנים סוף שיחה */
const END_PHRASES = ["זהו", "תודה", "סיימתי", "זה הכל", "זהו זה", "סיימנו"];

function isEndPhrase(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!?,]/g, "");
  return END_PHRASES.some((p) => t === p || t.startsWith(p + " ") || t.endsWith(" " + p));
}

const WELCOME = `שלום! אני העוזר של הרשימה 👋

פשוט תכתבו, ואני אבין לבד מה צריך:

🏠 **מה חסר** — "נגמר החלב ותביא לחם", ואני אוסיף ואעדכן את הרשימה.

🛒 **בסופר** — "אני בשופרסל". אשאל באיזה סופר אתם, ואתאים את הרשימה לרמת המחירים שלו. "יצאתי מהסופר" מסיים את הקנייה.

💬 **שאלות** — מה בריא יותר, איך בוחרים אבוקדו, תחליף לחלב. הרשימה נשארת כמו שהיא.

📝 **"תראה לי את הרשימה"** או **"מסך קנייה"** — פותח את המסך המלא.

אפשר גם לצלם מוצר 📷 ואני אזהה אותו. כשתסיימו — כתבו "זהו" ואציג סיכום.`;

const VIEW_LABEL: Record<ChatView, string> = {
  list: "📝 פתיחת הרשימה",
  shop: "🛒 פתיחת מסך הקנייה",
};

export default function AiPage() {
  // נרשמים לרשימה כדי להתעדכן משינויים חיצוניים (כולל מטאב אחר).
  // הערך עצמו לא בשימוש — לפני כל שליחה קוראים מחדש עם refreshItems().
  useItems();
  const stores = useStores();
  const [mode, setMode] = useState<ChatMode>("normal");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [askingStore, setAskingStore] = useState(false);
  const [sessionLog, setSessionLog] = useState<ActionResult[]>([]);
  /** הקשר הדחיפות שנשמר לאורך השיחה */
  const [contextPrio, setContextPrio] = useState<Prio | null>(null);
  /** סדר המחלקות שדווח בביקור הנוכחי — נשמר כמסלול בסוף הביקור */
  const [walked, setWalked] = useState<DeptId[]>([]);
  /** מסך הרשימה / הקנייה שפתוח מעל הצ'אט */
  const [openView, setOpenView] = useState<ChatView | null>(null);
  const closeView = useCallback(() => setOpenView(null), []);
  const committedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const store = activeStore(stores);
  const today = todayIndex();

  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      setMessages(saved.messages);
      setMode(saved.mode);
      setContextPrio(saved.contextPrio ?? null);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    saveChat({ mode, messages, contextPrio });
  }, [mode, messages, contextPrio, restored]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, askingStore]);

  /** שומר את המסלול שנצפה, פעם אחת לכל ביקור */
  function commitRoute(seq: DeptId[] = walked) {
    if (committedRef.current || !store || seq.length < 2) return;
    committedRef.current = true;
    recordRoute(store.id, seq);
  }

  function switchMode(next: ChatMode) {
    // יציאה ממצב סופר מסיימת את הביקור
    if (mode === "shop" && next !== "shop") commitRoute();
    setMode(next);
    // כניסה למצב סופר תמיד שואלת איפה אנחנו — המחירים משתנים בין סניפים
    if (next === "shop") {
      setAskingStore(true);
      setWalked([]);
      committedRef.current = false;
    } else {
      setAskingStore(false);
    }
  }

  function onStorePicked(picked: Store) {
    setAskingStore(false);
    setWalked([]);
    committedRef.current = false;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `מעולה, ${picked.name} (${priceLabel(picked.priceLevel)}). ${
          picked.priceLevel >= 4
            ? "אראה לכם רק את הדחופים — חבל לקנות כאן דברים שאפשר לדחות."
            : picked.priceLevel === 3
              ? "אראה לכם דחוף ורגיל."
              : "אראה לכם את כל הרשימה."
        } מה קונים?`,
      },
    ]);
  }

  /**
   * מנקה את השיחה בלבד.
   * המסלול שנצפה עד כה נשמר קודם — אחרת ניקוי באמצע ביקור היה מוחק
   * את הלמידה של אותו ביקור. fam-product-memory ו-fam-stores לא נגעים.
   */
  function resetChat() {
    commitRoute();
    setMessages([]);
    setImage(null);
    setError(null);
    setSessionLog([]);
    setContextPrio(null);
    setWalked([]);
    committedRef.current = false;
    setAskingStore(false);
    clearChat();
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("התמונה גדולה מדי (מקסימום 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function send() {
    const text = input.trim();
    if ((!text && !image) || loading) return;

    const userMsg: ChatMsg = {
      role: "user",
      content: text || "מה זה המוצר בתמונה?",
      image: image ?? undefined,
    };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    setImage(null);
    setError(null);

    // בקשה לראות את הרשימה / מסך הקנייה — נפתח מעל הצ'אט, בלי פנייה ל-API
    const view = userMsg.image ? null : detectViewRequest(text);
    if (view) {
      setMessages([
        ...history,
        {
          role: "assistant",
          content: view === "list" ? "הנה הרשימה 📝" : "הנה מסך הקנייה 🛒",
          view,
        },
      ]);
      setOpenView(view);
      return;
    }

    // המצב מזוהה מהשפה במקום מבחירה ידנית
    const activeMode = detectMode(text, mode);
    if (activeMode !== mode) switchMode(activeMode);
    // כניסה לסופר: קודם בוחרים סופר, ואז ממשיכים את השיחה
    if (activeMode === "shop" && mode !== "shop") return;

    setLoading(true);

    const decision = applyContext(text, contextPrio);
    setContextPrio(decision.nextContext);
    const ending = isEndPhrase(text);

    // דיווח מיקום במצב סופר → מרחיב את המסלול שנצפה בביקור הזה
    const reported = activeMode === "shop" ? detectDeptVisit(text) : null;
    const nextWalked = reported ? appendVisit(walked, reported) : walked;
    if (reported && nextWalked !== walked) setWalked(nextWalked);
    const currentDept = reported ?? nextWalked[nextWalked.length - 1] ?? null;

    try {
      // תמיד קוראים את fam-items מחדש מה-localStorage לפני הפנייה ל-API,
      // כדי שהצ'אט יראה שינויים שנעשו במסך הרשימה/הקנייה או בטאב אחר
      const freshItems = refreshItems();
      const mem = readMemory();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          chatMode: activeMode,
          items: freshItems,
          imageBase64: userMsg.image ?? undefined,
          today,
          contextPrio,
          contextReason: decision.reason,
          store: store
            ? { name: store.name, priceLevel: store.priceLevel }
            : null,
          currentDept,
          routeHint:
            activeMode === "shop" && routeIsConfident(store, ROUTE_CONFIDENT_AFTER)
              ? routeHint(
                  nextStopInRoute(
                    store?.route,
                    currentDept,
                    refreshItems().filter((i) => !i.done)
                  )
                )
              : null,
          memory: Object.fromEntries(
            Object.entries(mem)
              .slice(0, 120)
              .map(([name, e]) => [
                name,
                { prio: e.prio, usedOn: e.usedOn, confident: e.count >= 3 },
              ])
          ),
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok || !data.reply) {
        setError(data.error || "משהו השתבש. נסו שוב.");
        setMessages((prev) => prev.slice(0, -1));
        setInput(text);
        return;
      }

      const { text: clean, actions } = parseActions(data.reply);

      // הכרעת ההקשר גוברת על המודל כשהיא חד־משמעית (ירושה או איפוס),
      // ומשלימה עדיפות חסרה בשאר המקרים
      if (decision.prio !== null) {
        for (const a of actions) {
          if (a.action !== "add") continue;
          if (decision.override || a.prio === undefined) a.prio = decision.prio;
        }
      }

      if (ending && activeMode === "shop") commitRoute(nextWalked);

      const results = activeMode === "consult" ? [] : applyActions(actions);
      if (results.length) setSessionLog((prev) => [...prev, ...results]);

      const all = [...sessionLog, ...results];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: clean,
          log: results.length
            ? [
                ...results.map((r) => r.text),
                ...(explainContext(decision) && results.length
                  ? [explainContext(decision) as string]
                  : []),
              ]
            : undefined,
          summary: ending && all.length ? all.map((r) => r.text) : undefined,
        },
      ]);
    } catch {
      setError("אין חיבור לשרת. בדקו את החיבור ונסו שוב.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col pb-28">
      <header className="sticky top-0 z-20 bg-sand/95 backdrop-blur">
        <div className="flex items-end justify-between px-4 pb-3 pt-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-brand">העוזר</h1>
            <p className="truncate text-sm text-brand/50">
              {mode === "shop" && store
                ? `${store.name} · ${priceLabel(store.priceLevel)}`
                : (() => {
                    const m = MODES.find((x) => x.id === mode);
                    return m ? `${m.label} · ${m.hint}` : "";
                  })()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-brand/60 transition active:scale-95"
              >
                🧹 נקה שיחה
              </button>
            )}
            <span className="text-3xl">✨</span>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 pt-1">
        <div className="card whitespace-pre-wrap p-4 text-[15px] leading-relaxed text-brand-dark">
          {WELCOME.split("**").map((part, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-bold text-brand">
                {part}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                m.role === "user" ? "bg-brand text-white" : "card text-brand-dark"
              }`}
            >
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image}
                  alt="תמונת מוצר"
                  className="mb-2 max-h-48 rounded-xl object-cover"
                />
              ) : m.hadImage ? (
                <div
                  className={`mb-2 inline-block rounded-lg px-2 py-1 text-xs ${
                    m.role === "user" ? "bg-white/15" : "bg-brand/5 text-brand/50"
                  }`}
                >
                  📷 תמונה
                </div>
              ) : null}

              <p className="whitespace-pre-wrap">{m.content}</p>

              {m.view && (
                <button
                  onClick={() => setOpenView(m.view!)}
                  className="mt-2 w-full rounded-xl bg-brand px-4 py-2.5 font-medium text-white transition active:scale-[0.98]"
                >
                  {VIEW_LABEL[m.view]}
                </button>
              )}

              {m.log && (
                <ul className="mt-2 space-y-0.5 border-t border-black/5 pt-2 text-xs text-brand/50">
                  {m.log.map((l, j) => (
                    <li key={j}>✓ {l}</li>
                  ))}
                </ul>
              )}

              {m.summary && (
                <div className="mt-3 rounded-xl bg-brand-soft/60 p-3">
                  <p className="mb-1.5 text-sm font-bold text-brand">
                    📋 סיכום השיחה
                  </p>
                  <ul className="space-y-1 text-sm text-brand-dark">
                    {m.summary.map((s, j) => (
                      <li key={j}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* בחירת סופר — נכנס לזרימת השיחה כמו הודעה */}
        {askingStore && (
          <div className="flex justify-end">
            <div className="card w-full max-w-[92%] p-4">
              <p className="mb-3 font-medium text-brand-dark">באיזה סופר אתם? 🏪</p>
              <StorePicker onPicked={onStorePicked} />
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-end">
            <div className="card px-4 py-3 text-brand/40">חושב…</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div
        className="fixed inset-x-0 z-30"
        style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto w-full max-w-lg px-3 pb-2">
          <div className="card border border-black/5 p-2">
            {image && (
              <div className="flex items-center gap-2 px-1 pb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt="תצוגה מקדימה"
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <span className="flex-1 text-sm text-brand/50">תמונה מצורפת</span>
                <button
                  onClick={() => setImage(null)}
                  className="rounded-lg px-2 py-1 text-brand/40"
                  aria-label="הסרת תמונה"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPickPhoto}
                className="hidden"
              />
              <button
                aria-label="צילום מוצר"
                onClick={() => fileRef.current?.click()}
                className="shrink-0 rounded-xl bg-brand/5 px-3 py-2.5 text-lg transition active:scale-95"
              >
                📷
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`מה חסר? (יום ${DAY_NAMES[today]})`}
                className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 outline-none placeholder:text-brand/35"
                enterKeyHint="send"
              />
              <button
                aria-label="שליחה"
                disabled={loading || (!input.trim() && !image)}
                onClick={() => void send()}
                className="shrink-0 rounded-xl bg-brand px-4 py-2.5 font-bold text-white transition active:scale-95 disabled:opacity-30"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>

      <ViewPanel view={openView} onClose={closeView} />
    </main>
  );
}
