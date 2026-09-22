import { NextResponse, type NextRequest } from "next/server";

/** הצ'אט הוא המסך היחיד — כל כתובת אחרת מפנה אליו */
export function middleware(req: NextRequest) {
  return NextResponse.redirect(new URL("/ai", req.url));
}

export const config = {
  // לא נוגעים בצ'אט עצמו, ב-API, בקבצי Next ובקבצים סטטיים
  matcher: ["/((?!ai(?:/|$)|api/|_next/|.*\\.[^/]+$).*)"],
};
