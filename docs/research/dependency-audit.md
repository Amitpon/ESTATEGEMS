# Dependency Audit - אתר דירות להשקעה

> תאריך: 2026-09-20 | מקור גרסאות: npm registry (נבדק בפועל)
> `npm audit` על כל הסט המוצע: **0 vulnerabilities**
> הרצה בוצעה על lockfile זמני מחוץ לתיקיית הפרויקט. לא הותקן דבר.
> בוצע על ידי: dependency-auditor agent

---

## טבלת חבילות

| חבילה | גרסה | עדכון אחרון | gzip (הערכה) | רישיון | CVEs | פסק דין |
|---|---|---|---|---|---|---|
| react | 19.3.0 | 2026-09-18 | ~3kb | MIT | אין | APPROVE |
| react-dom | 19.3.0 | 2026-09-18 | ~42kb | MIT | אין | APPROVE |
| typescript | 7.0.2 | 2026-09-20 | dev | Apache-2.0 | אין | APPROVE (TS7 - הקומפיילר ב-Go) |
| vite | 8.3.0 | 2026-09-10 | dev | MIT | אין | APPROVE |
| @vitejs/plugin-react | 6.1.1 | 2026-08-28 | dev | MIT | אין | APPROVE |
| tailwindcss | 4.3.3 | 2026-09-08 | ~5-10kb CSS | MIT | אין | APPROVE |
| postcss | 8.5.28 | 2026-09-03 | dev | MIT | אין | מיותר ב-Tailwind 4 |
| autoprefixer | 10.6.1 | 2026-09-15 | dev | MIT | אין | REJECT - Tailwind 4 כולל Lightning CSS |
| @tailwindcss/vite | 4.3.3 | 2026-09-08 | dev | MIT | אין | ADD (מחליף postcss+autoprefixer) |
| shadcn/ui | CLI | - | 0 (copy-paste) | MIT | אין | APPROVE - לא dependency |
| @radix-ui/* | 1.1.23 | 2026-07-31 | 3-8kb לרכיב | MIT | אין | APPROVE - רק מה ש-shadcn מושך |
| lucide-react | 1.47.0 | 2026-09-17 | ~0.5kb/אייקון | ISC | אין | APPROVE (import נקודתי בלבד) |
| class-variance-authority | 0.7.1 | **2024-11-26** | ~1kb | Apache-2.0 | אין | 22 חודשים ללא עדכון - יציב אבל דגל |
| clsx | 2.1.1 | 2026-09-18 | 0.5kb | MIT | אין | APPROVE |
| tailwind-merge | 3.7.0 | 2026-09-13 | ~7kb | MIT | אין | APPROVE (יקר יחסית אך הכרחי ל-shadcn) |
| zustand | 5.0.15 | 2026-08-13 | ~1.2kb | MIT | אין | APPROVE |
| idb | 8.0.3 | **2025-05-07** | ~1.2kb | ISC | אין | APPROVE (יציב, 18M/שבוע) |
| recharts | 3.10.1 | 2026-09-09 | ~95-110kb | MIT | אין | REJECT - ראה הכרעה 2 |
| react-hook-form | 7.88.0 | 2026-09-11 | ~9kb | MIT | אין | APPROVE |
| zod | 4.6.5 | 2026-09-13 | ~12kb (tree-shaken) | MIT | אין | APPROVE - חובה `zod/mini` או import נקודתי |
| jspdf | 4.2.1 | 2026-03-17 | ~150kb+ | MIT | אין | REJECT |
| html2canvas | 1.4.1 | **2025-11-13** | ~48kb | MIT | אין | REJECT - למעשה נטוש |
| react-router-dom | 7.18.4 | 2026-09-15 | ~18-22kb | MIT | אין | REJECT ל-4 מסכים |
| wouter | 3.11.0 | 2026-09-14 | ~2.1kb | Unlicense | אין | APPROVE |
| vitest | 5.0.1 | 2026-09-15 | dev | MIT | אין | APPROVE |
| @testing-library/react | 16.3.3 | 2026-08-27 | dev | MIT | אין | APPROVE |
| jsdom | 30.1.0 | 2026-09-17 | dev | MIT | אין | ADD (environment ל-vitest) |
| leaflet | 1.9.4 | 2025-08-16 | ~42kb | BSD-2 | אין | APPROVE אם צריך מפה |
| react-leaflet | 5.0.0 | **2024-12-14** | ~5kb | **Hippocratic-2.1** | אין | דגל רישיון |
| maplibre-gl | 6.10.0 | 2026-09-15 | ~220kb | BSD-3 | אין | REJECT |
| localforage | 1.10.0 | **2022-06-19** | ~9kb | Apache-2.0 | אין | REJECT - 4 שנים ללא עדכון |

---

## המלצות והחלפות - הכרעות

### 1. jspdf + html2canvas -> החוצה. `window.print()` עם print stylesheet.

~200kb gzip לפיצ'ר אחד, על אתר mobile-first. html2canvas לא עודכן מאז 11/2025 ו-**לא מרנדר עברית/RTL כמו שצריך** (בעיות bidi ו-shaping ידועות). jspdf ללא embed של פונט עברי מייצר ג'יבריש, ואמבדינג פונט עברי מוסיף עוד ~150-300kb.

**ההכרעה:** `@media print` stylesheet ייעודי + `window.print()`. אפס kb, טיפוגרפיה עברית מושלמת, המשתמש בוחר "Save as PDF" (נייטיבי בכל דפדפן מובייל ודסקטופ).

אם בעתיד חייבים PDF פרוגרמטי - Netlify Function עם Puppeteer, לא בצד לקוח.

### 2. recharts -> החוצה. SVG ידני + `d3-scale`.

~100kb gzip. recharts 3.x מושך פנימית חלקי d3 (scale, shape, array) ומרנדר דרך עץ React מלא.

לאתר ניתוח דירות נדרש בפועל: תרשים תזרים שנתי, פיזור מחירים, אולי עוגה אחת. זה 60-120 שורות SVG לכל תרשים.

**ההכרעה:** `d3-scale` + `d3-shape` (~8kb gzip ביחד, tree-shakeable) ורנדר `<svg>` ידני. חוסך ~90kb ונותן שליטה מלאה ב-RTL של הצירים - שזה בדיוק המקום שבו recharts מכאיב (הפיכת ציר X, תוויות עבריות ב-tooltip).

חלופה אם מתעקשים על ספרייה מוכנה: chart.js 4.5.1 + react-chartjs-2 (~65kb, canvas). לא visx - ה-API מפוצל ל-30 חבילות.

### 3. leaflet מול maplibre-gl -> leaflet, אם בכלל.

maplibre-gl = ~220kb gzip + WebGL + worker. פי 5 מ-leaflet. פסול למובייל-ראשון.

**ללא tile server:** אפשרי בשתיהן. ב-Leaflet פשוט לא להוסיף `L.tileLayer` - רק `L.geoJSON(data).addTo(map)` על רקע CSS.

**ההכרעה האמיתית:** אם רק מציירים פוליגונים של שכונות ללא מפת רקע - **לא להוסיף מפה בכלל**. לרנדר את ה-GeoJSON ישירות כ-`<svg>` עם `d3-geo` (projection `geoMercator`, ~5kb) - אותו d3 שכבר מגיע לתרשימים. אפס kb נוספים, pan/zoom ב-CSS transform.

Leaflet נכנס רק אם נרצה tiles אמיתיים (OSM) בהמשך. שים לב: `react-leaflet@5.0.0` תחת רישיון **Hippocratic-2.1** - לא OSI-approved. לפרויקט מסחרי זה דגל. עוקפים עם `useEffect` + Leaflet vanilla.

### 4. zustand -> נשאר. הבחירה הנכונה ב-2026.

5.0.15, עודכן 08/2026, 40M הורדות שבועיות, 1.2kb. לא צמח לו מחליף - jotai/valtio נשארו נישה, Redux Toolkit כבד פי 10 ומיותר כאן. `persist` middleware עובד עם IndexedDB דרך custom storage adapter.

**אזהרה:** לא לשמור את כל ה-state של הדירות ב-persist. persist רק להעדפות UI; הנתונים עצמם דרך idb ישירות.

### 5. idb -> נשאר. localforage החוצה.

ה-IndexedDB API הנייטיבי עדיין callback/event-based ב-2026 - אין Promise API נייטיבי. idb 8.0.3 הוא 1.2kb, 18M/שבוע, Jake Archibald (Google). העובדה שלא עודכן מאז 05/2025 היא סימן לבגרות, לא נטישה - ה-API של IndexedDB לא זז.

localforage: 1.10.0 מיוני 2022, ארבע שנים. פי 7 במשקל, נופל ל-localStorage בשקט (מסתיר באגים), API מוגבל ל-key-value בלי אינדקסים.

### 6. react-router-dom -> החוצה. wouter.

~20kb מול 2.1kb. ל-4 מסכים ללא data loaders, ללא SSR, ללא nested routes מורכבים - react-router 7 הוא overkill מובהק (הוא היום פריימוורק, לא ראוטר).

wouter 3.11.0, עודכן 09/2026, API כמעט זהה (`<Route>`, `useLocation`, `useRoute`), hash routing מובנה. חוסך ~18kb. רישיון Unlicense (public domain) - תקין מסחרית.

### 7. מה חסר

| חבילה | למה | משקל |
|---|---|---|
| `@tailwindcss/vite` | מחליף postcss+autoprefixer לגמרי ב-Tailwind 4 | dev |
| `jsdom` | vitest צריך environment ל-@testing-library | dev |
| `d3-scale` + `d3-shape` + `d3-geo` | מחליפי recharts ו-maplibre | ~12kb |
| `@types/react`, `@types/react-dom` | חובה | dev |

**RTL בטיילווינד - לא צריך `tailwindcss-rtl`.** החבילה בגרסה 0.9.0 ממאי 2022, נטושה. Tailwind 4 בנוי כולו על logical properties: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start/end`, `border-s/e`. מספיק `dir="rtl"` על `<html>` ו-`@theme` עם פונט עברי.

**פורמוט מספרים/מטבע - לא צריך חבילה.** `Intl.NumberFormat` נייטיבי מכסה הכל:
- `new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0})` -> 1,850,000 ₪
- אחוזי תשואה: `{style:'percent',minimumFractionDigits:2}`
- תאריכים: `Intl.DateTimeFormat('he-IL')`
- `Intl.RelativeTimeFormat('he-IL')` ל"לפני חודשיים"

אפס kb. לא date-fns, לא dayjs, לא numeral. לעטוף ב-`src/lib/format.ts` עם instances ממוחזרים (יצירת Intl בלולאה איטית).

---

## סך משקל bundle משוער (gzip)

### הסט המומלץ
```
react + react-dom              ~45kb
wouter                          ~2kb
zustand                         ~1kb
idb                             ~1kb
react-hook-form                 ~9kb
zod (tree-shaken)              ~12kb
radix (4-6 primitives)         ~25kb
lucide (25 אייקונים)            ~8kb
clsx + tailwind-merge + cva     ~9kb
d3-scale/shape/geo             ~12kb
קוד אפליקציה                    ~40kb
Tailwind CSS (purged)          ~10kb
─────────────────────────────────────
סה"כ                          ~174kb
```
טעינה ראשונית אחרי code-splitting של המפה/תרשימים: **~120-130kb**.

### הסט המקורי שהוצע
```
בסיס (react+radix+forms+state)  ~105kb
recharts                        ~100kb
react-router-dom                 ~20kb
jspdf + html2canvas             ~200kb
maplibre-gl (אם ייבחר)          ~220kb
─────────────────────────────────────
סה"כ                       ~445-645kb
```

**פער של פי 3-4.** על 4G ישראלי ממוצע זה ההבדל בין 1.2 שניות ל-4 שניות ל-interactive.

---

## דגלים אדומים

1. **html2canvas@1.4.1** - עדכון אחרון 11/2025, מתחזק יחיד, מאות issues פתוחים ללא מענה, **שבור ברינדור עברית/RTL**. הסיכון הגבוה ביותר ברשימה.
2. **react-leaflet רישיון Hippocratic-2.1** - לא OSI-approved, מכיל תנאי שימוש אתיים. עלול להיות בעיה בבדיקת compliance.
3. **localforage** - ארבע שנים ללא עדכון.
4. **tailwindcss-rtl** - ארבע שנים ללא עדכון, נטוש ומיותר.
5. **class-variance-authority** - 22 חודשים ללא עדכון. לא חוסם (100 שורות, יציב, נגרר מ-shadcn) אבל שווה מעקב.
6. **zod 4.x** - `import * as z from 'zod'` גורר ~60kb. חובה `zod/mini` או named imports.
7. **autoprefixer + postcss** - שאריות מ-Tailwind 3. ב-4.x כפילות שרק מאטה את הבילד.

---

## שורה תחתונה

**prod:** `react react-dom wouter zustand idb react-hook-form @hookform/resolvers zod clsx tailwind-merge class-variance-authority lucide-react d3-scale d3-shape` (+ radix לפי shadcn)

**dev:** `typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom @types/d3-scale @types/d3-shape`

**לא להתקין:** `recharts jspdf html2canvas react-router-dom postcss autoprefixer localforage tailwindcss-rtl maplibre-gl`

**החלטה נדחית:** מפה - להתחיל עם d3-geo + SVG. leaflet רק אם יתברר שצריך tiles.

---

## הערות מעשיות

1. `typescript@7` הוא הקומפיילר החדש ב-Go - לוודא ש-VS Code על תוסף TS תואם.
2. הערכות ה-gzip הן מניסיון והשוואה, לא ממדידה בפועל. אחרי הבילד הראשון להריץ `vite build` עם `rollup-plugin-visualizer` ולאמת.
3. הגרסאות נבדקו מול ה-registry ב-2026-09-20. לאמת שוב ברגע ההתקנה בפועל.
