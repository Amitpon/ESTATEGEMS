/**
 * scripts/fetch-cbs.mjs
 *
 * מושך מדדי מחירים מ-API של הלשכה המרכזית לסטטיסטיקה (למ"ס)
 * ושומר snapshot ל-src/data/cbs-indices.json.
 *
 * הרצה: node scripts/fetch-cbs.mjs
 * או:   npm run data:cbs
 *
 * ה-API של הלמ"ס (api.cbs.gov.il) מחזיר CORS headers ורישיון פתוח,
 * אך הוא אינו יציב - טיימאוטים ותשובות חלקיות קורים. לכן:
 * אם המשיכה נכשלת ויש snapshot קיים - שומרים אותו ויוצאים עם exit(0).
 *
 * מדדים:
 *   120010 = מדד המחירים לצרכן (CPI)
 *   40010  = מדד מחירי דירות
 *   200010 = מדד תשומות הבנייה
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'cbs-indices.json');

const CBS_BASE = 'https://api.cbs.gov.il/index/data/price';

const INDICES = {
  cpi: { id: 120010, label: 'מדד המחירים לצרכן' },
  housingPrices: { id: 40010, label: 'מדד מחירי דירות' },
  constructionInputs: { id: 200010, label: 'מדד תשומות הבנייה' },
};

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    // User-Agent נדרש - ה-API חוסם בקשות ללא header זה
    const req = https.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; dirot-lehashkaa-build/1.0)',
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON parse failed for ${url}: ${e.message}\nBody starts: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Fetch one index
// ---------------------------------------------------------------------------

/**
 * שולף סדרה של מדד אחד.
 *
 * המבנה האמיתי (אומת ב-curl חי, לא כפי שתועד בטיוטה הקודמת של הסקריפט):
 * `json.month[0].date[]`, וכל איבר הוא
 * `{ year, month, monthDesc, percent, percentYear, currBase: { baseDesc, value }, prevBase }`.
 * אין `DataSet.Series[].obs[]` - זו הייתה הנחה שגויה שלא נבדקה מול תשובה אמיתית.
 *
 * מחזיר מערך של { period, value } ממוין כרונולוגית.
 */
async function fetchIndex(id, label) {
  const url = `${CBS_BASE}?id=${id}&format=json&download=false`;
  console.log(`Fetching ${label} (id=${id})...`);

  const json = await fetchJson(url);

  const monthSeries = json?.month;
  if (!Array.isArray(monthSeries) || monthSeries.length === 0) {
    throw new Error(`${label}: no month series in response`);
  }

  const dates = monthSeries[0]?.date;
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new Error(`${label}: no observations`);
  }

  const points = dates
    .map((d) => ({
      period:
        Number.isFinite(d?.year) && Number.isFinite(d?.month)
          ? `${d.year}-${String(d.month).padStart(2, '0')}`
          : '',
      value: typeof d?.currBase?.value === 'number' ? d.currBase.value : Number(d?.currBase?.value),
    }))
    .filter((p) => p.period && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.period.localeCompare(b.period));

  if (points.length === 0) {
    throw new Error(`${label}: no valid observations after filtering`);
  }

  const latest = points[points.length - 1];
  console.log(`  ${label}: ${points.length} points, latest ${latest.period} = ${latest.value}`);

  // sanity: CPI בישראל נע בין 80-200 (בסיס 2020=100), דירות בין 50-300
  // נבדוק רק שהערך חיובי ולא אסטרונומי
  if (latest.value <= 0 || latest.value > 10000) {
    throw new Error(`Sanity check failed: ${label} latest value = ${latest.value}. Expected 0-10000.`);
  }

  return {
    id,
    label,
    latestPeriod: latest.period,
    latestValue: latest.value,
    points,
    source: 'https://www.cbs.gov.il/',
    apiUrl: url,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('--- fetch-cbs.mjs ---');

  let existingSnapshot = null;
  if (existsSync(OUTPUT_PATH)) {
    try {
      existingSnapshot = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
      console.log(`Existing snapshot found (fetchedAt: ${existingSnapshot.fetchedAt})`);
    } catch {
      console.warn('Existing snapshot unreadable, will overwrite.');
    }
  }

  const results = {};

  for (const [key, { id, label }] of Object.entries(INDICES)) {
    try {
      results[key] = await fetchIndex(id, label);
    } catch (err) {
      if (existingSnapshot) {
        console.error(`${label} fetch failed: ${err.message}`);
        console.warn('Keeping existing snapshot. Run again to retry.');
        process.exit(0);
      }
      throw err;
    }
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    ...results,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`\nSnapshot saved to ${OUTPUT_PATH}`);
  console.log(`CPI: ${results.cpi.latestValue} (${results.cpi.latestPeriod})`);
  console.log(`Housing prices: ${results.housingPrices.latestValue} (${results.housingPrices.latestPeriod})`);
  console.log(`Construction inputs: ${results.constructionInputs.latestValue} (${results.constructionInputs.latestPeriod})`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
