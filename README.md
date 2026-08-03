# 🛒 הקניות שלנו

אפליקציית ניהול קניות משפחתית — Next.js 14 (App Router), TypeScript, Tailwind, עברית RTL.
כל המידע נשמר ב-localStorage של הדפדפן. ה-AI רץ דרך API route בצד השרת.

## הפעלה

```bash
npm install
# ערכו את .env.local והכניסו את מפתח ה-API שלכם
npm run dev
```

פתחו http://localhost:3000

## מבנה

```
app/
  page.tsx              רשימה — קיבוץ לפי מחלקות, quick-add, שינוי עדיפות
  shop/page.tsx         קנייה — progress bar, סימון, כמויות
  ai/page.tsx           עוזר — 3 מצבי שיחה, צילום מוצר
  api/chat/route.ts     שיחה עם Claude (system prompt לפי chatMode)
  api/classify/route.ts זיהוי מחלקה אוטומטי לפריט חדש
components/
  BottomNav.tsx  QuickAdd.tsx  FilterChips.tsx  Sheet.tsx
lib/
  types.ts       מחלקות, עדיפויות, טיפוסים
  store.ts       localStorage + זיכרון מוצרים + סנכרון בין מסכים
  aiActions.ts   פענוח פעולות מתשובת ה-AI והחלתן על הרשימה
```

## אחסון

| מפתח | תוכן |
| --- | --- |
| `fam-items` | `Item[]` — כל הפריטים |
| `fam-product-memory` | `Record<name, {dept, prio, count}>` — לומד איפה כל מוצר יושב |
| `fam-chat` | `{v, mode, messages}` — היסטוריית הצ'אט והמצב האחרון |

היסטוריית הצ'אט נשמרת עד 60 הודעות אחרונות. תמונות **לא** נשמרות (data URL אחד יכול
למלא את כל המכסה) — במקומן נשאר סימון `📷 תמונה` בבועה.

בפעם הראשונה שמוצר נוסף, ה-AI מזהה את המחלקה ברקע ושומר אותה בזיכרון.
בפעמים הבאות הזיהוי מיידי, בלי קריאת רשת.

## מודל

הקוד משתמש ב-`claude-opus-5`. אפשר להחליף בקבוע `MODEL` בשני ה-API routes.
