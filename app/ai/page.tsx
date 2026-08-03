"use client";

import { useEffect, useRef, useState } from "react";
import { applyActions, parseActions } from "@/lib/aiActions";
import {
  clearChat,
  loadChat,
  saveChat,
  type ChatMode,
  type ChatMsg,
} from "@/lib/chat";
import { useItems } from "@/lib/store";

const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: "normal", label: "🏠 רגיל", hint: "מוסיף ומעדכן פריטים ברשימה" },
  { id: "shop", label: "🛒 סופר", hint: "מלווה אתכם בין המחלקות" },
  { id: "consult", label: "💬 ייעוץ", hint: "עונה על שאלות, לא נוגע ברשימה" },
];

const WELCOME = `שלום! אני העוזר של הרשימה 👋

בחרו מצב למעלה:

🏠 **רגיל** — פשוט תכתבו מה חסר ("נגמר החלב ותביא לחם"), ואני אוסיף ואעדכן את הרשימה בשבילכם.

🛒 **סופר** — כשאתם בחנות. אני אנווט אתכם מחלקה־מחלקה ואסמן מה שקניתם.

💬 **ייעוץ** — שאלות על מוצרים: מה בריא יותר, איך בוחרים אבוקדו, תחליף לחלב. הרשימה נשארת כמו שהיא.

אפשר גם לצלם מוצר 📷 ואני אזהה אותו.`;

export default function AiPage() {
  const items = useItems();
  const [mode, setMode] = useState<ChatMode>("normal");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // טעינת השיחה השמורה — אחרי ה-mount, כדי לא לשבור את ההידרציה
  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      setMessages(saved.messages);
      setMode(saved.mode);
    }
    setRestored(true);
  }, []);

  // שמירה בכל שינוי — רק אחרי שהטעינה הסתיימה, אחרת נדרוס את מה שנשמר
  useEffect(() => {
    if (!restored) return;
    saveChat({ mode, messages });
  }, [mode, messages, restored]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function resetChat() {
    setMessages([]);
    setImage(null);
    setError(null);
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
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          chatMode: mode,
          items,
          imageBase64: userMsg.image ?? undefined,
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
      const log = mode === "consult" ? [] : applyActions(actions);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: clean, log: log.length ? log : undefined },
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
          <div>
            <h1 className="text-2xl font-black text-brand">העוזר</h1>
            <p className="text-sm text-brand/50">
              {MODES.find((m) => m.id === mode)?.hint}
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`chip ${mode === m.id ? "chip-on" : "chip-off"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 pt-1">
        {/* הודעת פתיחה */}
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
                m.role === "user"
                  ? "bg-brand text-white"
                  : "card text-brand-dark"
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
              {m.log && (
                <ul className="mt-2 space-y-0.5 border-t border-black/5 pt-2 text-xs text-brand/50">
                  {m.log.map((l, j) => (
                    <li key={j}>✓ {l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="card px-4 py-3 text-brand/40">חושב…</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* תיבת קלט */}
      <div
        className="fixed inset-x-0 z-30"
        style={{ bottom: "calc(62px + env(safe-area-inset-bottom, 0px))" }}
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
                placeholder="כתבו הודעה…"
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
    </main>
  );
}
