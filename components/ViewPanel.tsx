"use client";

import { useEffect } from "react";
import ListView from "./ListView";
import ShopView from "./ShopView";
import type { ChatView } from "@/lib/intent";

/** מסך הרשימה / הקנייה, פתוח מעל הצ'אט עד שחוזרים אליו */
export default function ViewPanel({
  view,
  onClose,
}: {
  view: ChatView | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [view, onClose]);

  if (!view) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-black/20">
      <div className="flex h-full w-full max-w-lg animate-slideUp flex-col bg-sand">
        <div
          className="flex shrink-0 items-center border-b border-black/5 px-3 pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
        >
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-brand/70 transition active:scale-95"
          >
            → חזרה לצ'אט
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          {view === "list" ? <ListView /> : <ShopView />}
        </div>
      </div>
    </div>
  );
}
