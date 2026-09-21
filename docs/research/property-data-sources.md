# מקורות נתונים חיצוניים - ממצאים ואמת בשטח

> ## אימות עצמאי של ה-PM, 2026-09-20
>
> **CBS - אומת מלא.** `api.cbs.gov.il` מחזיר `Access-Control-Allow-Origin: *`.
> מדד תשומות הבנייה (200010) = 103.9, שינוי שנתי +3.5%, אוגוסט 2026.
>
> **govmap - אומת, עם תיקון מהותי למסמך.** קריאה ראשונה שלי החזירה **403**.
> הסיבה אינה מה שכתוב למטה: govmap יושב מאחורי הגנת בוטים של CloudFront
> ש**דורשת User-Agent של דפדפן**. בידוד הכותרות:
>
> | מה נשלח | תוצאה |
> |---|---|
> | בלי User-Agent | **403** |
> | User-Agent של דפדפן בלבד | 200 |
> | UA + Referer של govmap | 200 |
> | UA + Origin של האתר שלנו | 200 |
>
> **המשמעות המעשית:** `Referer` לא רלוונטי. דפדפן אמיתי תמיד שולח UA, ולכן
> lookup חי מהדפדפן **יעבוד** - המסקנה הארכיטקטונית במסמך נכונה.
> אבל **סקריפט build-time ב-node חייב להגדיר User-Agent במפורש**, אחרת יקבל 403.
>
> **הסיכון מתחדד:** הגנת בוטים שמסננת לפי UA היא סימן ש-govmap לא מתכוון
> שישתמשו בו כ-API. אין SLA, והחסימה עלולה להתהדק. לתכנן כשל רך: אם הקריאה
> נכשלת, הכלי ממשיך לעבוד בלי עוגן המחירים.


> נכתב על ידי api-scout, ספטמבר 2026.
> כל ממצא הועבר בבדיקת curl אמיתית לפני שנרשם כאן. תשובות לדוגמה מגיעות מקריאות חיות.

---

## טבלת סיכום

| מקור | נתון | CORS | Auth | עדכניות | מצב | מצב צריכה |
|---|---|---|---|---|---|---|
| govmap.gov.il API | עסקאות מכירה לפי כתובת | * (מאושר) | לא | אוגוסט 2026 | מומלץ | live lookup |
| api.cbs.gov.il | מדד תשומות בנייה | * (מאושר) | לא | אוגוסט 2026 | מומלץ | build-time snapshot |
| api.cbs.gov.il | CPI מדד מחירים לצרכן | * (מאושר) | לא | אוגוסט 2026 | מומלץ | build-time snapshot |
| api.cbs.gov.il | מחירי דירות - מדד | * (מאושר) | לא | יוני 2026 | שימושי | build-time snapshot |
| מדלן | -- | -- | -- | -- | לא רלוונטי | -- |
| CBS Excel/PDF | שכר דירה ממוצע לפי עיר | N/A | לא | רבעוני | עקיף | ידני ל-snapshot |

---

## א. עסקאות נדל"ן - govmap.gov.il

### המסקנה

govmap.gov.il הוא האתר הרשמי של מדינת ישראל למיפוי, ומשמש כחלון לנתוני עסקאות מקרקעין של רשות המסים.
ה-API שלו **נגיש ישירות מהדפדפן (CORS: \*)**, לא דורש מפתח API, ומחזיר עסקאות עד אוגוסט 2026.

המבנה בנוי משלושה שלבים:

### שלב 1 - המרת כתובת לקורדינטות ITM

```
POST https://www.govmap.gov.il/api/search-service/autocomplete
Body: { "searchText": "רוטשילד 1 תל אביב", "language": "he", "isAccurate": false, "maxResults": 5 }
```

תשובה אמיתית (נבדק 2026-09-20):
```json
{
  "resultsCount": 1359,
  "results": [{
    "id": "address|ADDR|64834989",
    "text": "רוטשילד 1 תל אביב",
    "type": "address",
    "shape": "POINT(3870469.1352248313 3771587.622787273)"
  }]
}
```

CORS נמדד: `access-control-allow-origin: \*`

**קריטי:** הקורדינטות הן **ITM (EPSG:2039)** - מערכת ישראלית, לא WGS84.
עם קורדינטות WGS84 (34.78, 32.08) ה-API מחזיר מערך ריק.

### שלב 2 - קבלת polygon_ids באזור

```
GET https://www.govmap.gov.il/api/real-estate/deals/{lon_ITM},{lat_ITM}/{radius_meters}
```

דוגמה: `GET /api/real-estate/deals/3870469,3771587/500`

תשובה אמיתית:
```json
[{ "dealscount": "1", "settlementNameHeb": "תל אביב -יפו", "polygon_id": "7424-26", "objectid": 24091 }]
```

CORS נמדד: `access-control-allow-origin: \*`
טווח מומלץ: 300-1000 מטר.

### שלב 3 - עסקאות אמיתיות לפי שכונה

```
GET https://www.govmap.gov.il/api/real-estate/neighborhood-deals/{polygon_id}
  ?limit=50&startDate=YYYY-MM&endDate=YYYY-MM
```

תשובה אמיתית (נבדק 2026-09-20):
json
{
  "totalCount": "1500",
  "data": [{
    "objectid": 2211468,
    "settlementNameHeb": "תל אביב-יפו",
    "streetNameHeb": "אברבנאל",
    "houseNum": 2,
    "floorNo": "תשיעית",
    "assetArea": 104,
    "dealAmount": 13500000,
    "assetRoomNum": 4,
    "neighborhood": "פלורנטין",
    "dealDate": "2026-08-05T00:00:00.000Z",
    "gushNum": 7083,
    "parcelNum": 128
  }]
}


CORS: access-control-allow-origin: *
עסקה לדוגמה: 4 חדרים, 104 מ"ר, פלורנטין ת"א, 13.5M שקל, אוגוסט 2026.

### שדות זמינים

| שדה | תיאור |
|---|---|
| assetArea | שטח במ"ר |
| dealAmount | מחיר בשקלים |
| assetRoomNum | מספר חדרים |
| dealDate | תאריך עסקה (ISO 8601) |
| neighborhood | שכונה |
| streetNameHeb | רחוב |
| floorNo | קומה (טקסט עברי) |
| gushNum / parcelNum | גוש/חלקה |

### מצב צריכה: live lookup - ישירות מהדפדפן

כל 3 ה-endpoints מחזירים access-control-allow-origin: *. **אין צורך ב-Netlify Function.**

זרימה מלאה:
1. POST /api/search-service/autocomplete - קבל קואורדינטות ITM מתוך shape
2. GET /api/real-estate/deals/{lon},{lat}/500 - קבל polygon_ids
3. GET /api/real-estate/neighborhood-deals/{polygon_id}?limit=50&startDate=2022-01 - עסקאות

---

## ב. מדלן

**מדלן אינה רלוונטית לפרויקט זה.**

עובדות שאומתו:
1. אין API ציבורי מתועד. madlan.co.il/terms/ מחזיר 404. אין /developers ואין /api/docs.
2. פורום הסולידית (ציבורי): "לאתר רשות המסים אין API, מדלן אוספת ומנתחת במערכת פנימית".
3. Apify מציעים scrapers בתשלום - מאשר שאין API חופשי.

**מסקנה:** לא לממש, לא לתכנן. govmap.gov.il מספקת את אותם נתונים ברישיון ציבורי.

---

## ג. מדד תשומות הבנייה


GET https://api.cbs.gov.il/index/data/price?id=200010&format=json&lang=en&last=24


אין מפתח API. תשובה אמיתית (2026-09-20):

json
{
  "month": [{
    "code": 200010,
    "name": "Price index of input in residential building - general",
    "date": [{
      "year": 2026, "month": 8, "monthDesc": "August",
      "percent": 0.4, "percentYear": 3.5,
      "currBase": { "baseDesc": "July 2025", "value": 103.9 }
    }]
  }]
}


CORS: access-control-allow-origin: *
שיעור שנתי (אוגוסט 2026): **+3.5%**

מחליף הנחה ידנית ב-src/lib/calc/payment-schedule.ts. מוצג כ: "שיעור שינוי מדד תשומות: 3.5% (למ"ס, אוגוסט 2026)".

**מצב צריכה:** build-time snapshot.

---

## ד. מדד המחירים לצרכן (CPI)


GET https://api.cbs.gov.il/index/data/price?id=120010&format=json&lang=en&last=24


תשובה אמיתית (2026-09-20):

json
{
  "month": [{
    "code": 120010,
    "name": "Consumer Price Index - General",
    "date": [{
      "year": 2026, "month": 8, "monthDesc": "August",
      "percent": 0.7, "percentYear": 1.5,
      "currBase": { "baseDesc": "Average 2024", "value": 105.8 }
    }]
  }]
}


CORS: access-control-allow-origin: *
אינפלציה שנתית (אוגוסט 2026): **1.5%**

**הערה:** ה-BOI SDMX API (קיים ב-fetch-boi.mjs) לא מפרסם CPI. ה-BOI מפרסם ריבית; ה-CBS מפרסם מדדי מחירים.

**מצב צריכה:** build-time snapshot.

---

## ה. מדד מחירי דירות - בונוס


GET https://api.cbs.gov.il/index/data/price?id=40010&format=json&lang=en&last=24


ערך (יוני 2026): 594.8 (בסיס ממוצע 1993), שינוי שנתי: -1.2%
CORS: access-control-allow-origin: *

שימושי לעוגן שינוי ערך נכס היסטורי. לא ניבוי - מוצג כנתון עבר.

---

## ו. שכר דירה ממוצע לפי אזור

### מה נבדק ונכשל

| מקור | תוצאה |
|---|---|
| kamakama.gov.il API | SPA, אין API נגיש |
| api.cbs.gov.il | אין endpoint לשכ"ד לפי עיר |
| govmap neighborhood-deals | עסקאות מכירה בלבד |

### מה שקיים

CBS מפרסמת "Average Monthly Prices of Rent" רבעונית כ-Excel, לפי עיר ומספר חדרים. **אין API.**

### המלצה - Hybrid Approach

1. **עוגן מוחלט (קובץ סטטי):** src/data/rent-benchmarks.json - טבלה לפי עיר + חדרים. מתעדכנת ידנית פעם בחצי שנה עם תאריך ומקור.
2. **מגמה (CBS API):** id=120010 מכיל רכיב דיור CPI.

פורמט הצגה: "שכ"ד ממוצע ל-3 חדרים בתל אביב: כ-6,000 שקל (למ"ס, Q2/2026). הזן את שכ"ד הצפוי שלך."

---

## המלצה סופית

### build-time snapshot

Script חדש: scripts/fetch-cbs.mjs

js
// https://api.cbs.gov.il/index/data/price?id=120010&format=json&lang=en&last=36  // CPI
// https://api.cbs.gov.il/index/data/price?id=200010&format=json&lang=en&last=36  // מדד בנייה
// https://api.cbs.gov.il/index/data/price?id=40010&format=json&lang=en&last=36   // מחירי דירות
// pause 500ms between requests
// save to: src/data/cbs-indices.json


### live lookup

govmap.gov.il API - שלושה endpoints, כולם CORS: *, ישירות מהדפדפן.

### Netlify Function נדרש?

**לא.** כל המקורות שנבדקו מחזירים CORS: *. אין צורך ב-proxy.

---

## גוטצ'אות

1. **קואורדינטות ITM בלבד.** govmap עובד עם EPSG:2039. קואורדינטות מה-autocomplete כ-POINT(lon lat). WGS84 מחזיר מערך ריק.
2. **CBS rate limiting.** אחרי burst גדול: ECONNRESET. ב-build-time עם 3 קריאות + pause - לא בעיה.
3. **govmap לא מתועד רשמית.** API עובד, CORS * קיים, אבל אין SLA. שבירה עתידית אפשרית.
4. **שכ"ד - חסר API.** הפער היחידי. ראה פרק ו.
5. **CBS רישיון:** פתוח, שימוש מסחרי מותר עם ציון מקור. https://www.cbs.gov.il/en/Pages/Enduser-license.aspx

---

## טבלת IDs ל-CBS API

| מדד | ID | בסיס | ערך (אוג 2026) | שינוי שנתי |
|---|---|---|---|---|
| CPI כללי | 120010 | ממוצע 2024 | 105.8 | +1.5% |
| מחירי דירות | 40010 | ממוצע 1993 | 594.8 | -1.2% |
| מדד תשומות בנייה | 200010 | יולי 2025 | 103.9 | +3.5% |

Catalog endpoint: GET https://api.cbs.gov.il/Index/Catalog/Catalog?lang=en

## TypeScript Interface ל-CBS

typescript
interface CbsIndexDate {
  year: number;
  month: number;
  monthDesc: string;
  percent: number;      // month-over-month %
  percentYear: number;  // year-over-year %
  currBase: { baseDesc: string; value: number };
  prevBase: { baseDesc: string; value: number } | null;
}

interface CbsIndexSeries {
  code: number;
  name: string;
  date: CbsIndexDate[];
}

interface CbsPriceResponse {
  month?: CbsIndexSeries[];
  quarter?: CbsIndexSeries[];
}

