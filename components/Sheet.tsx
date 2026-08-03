"use client";

import { useEffect } from "react";

export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 animate-fadeIn bg-black/40"
      />
      <div className="relative w-full max-w-lg animate-slideUp rounded-t-3xl bg-white shadow-sheet">
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        {title && (
          <h2 className="px-5 pb-1 pt-3 text-lg font-bold text-brand">{title}</h2>
        )}
        <div className="max-h-[75vh] overflow-y-auto px-5 pb-6 pt-2 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
}
