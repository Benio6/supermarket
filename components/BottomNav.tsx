"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "רשימה", icon: "📝" },
  { href: "/shop", label: "קנייה", icon: "🛒" },
  { href: "/ai", label: "עוזר", icon: "✨" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex w-full max-w-lg">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-brand" : "text-brand/40"
              }`}
            >
              <span className={`text-xl leading-none ${active ? "" : "opacity-60"}`}>
                {tab.icon}
              </span>
              {tab.label}
              <span
                className={`mt-0.5 h-0.5 w-6 rounded-full transition-colors ${
                  active ? "bg-brand" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
