import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "הקניות שלנו",
  description: "ניהול רשימת קניות משפחתית",
};

export const viewport: Viewport = {
  themeColor: "#DC2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.className}>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
