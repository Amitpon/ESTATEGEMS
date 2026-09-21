/**
 * scripts/fetch-boi.mjs
 *
 * מושך נתוני ריבית מה-API של בנק ישראל (SDMX) ושומר snapshot ל-src/data/boi-rates.json.
 * רץ בזמן build - לא בדפדפן, לכן אין בעיית CORS.
 *
 * הרצה: node scripts/fetch-boi.mjs
 * או:   npm run data:boi
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import https from 'https';
import { URL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'boi-rates.json');

const BASE = 'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS';

// --- HTTP helper ---

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
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

// --- SDMX helpers ---

/**
 * builds a lookup map: dimensionId -> (valueId -> index)
 */
/**
 * המרת ערך תצפית למספר.
 * ה-SDMX של בנק ישראל מחזיר ערכים כמחרוזות ("3.25"), וימים ללא מסחר כ-null.
 * מחזיר null לכל ערך שאינו מספר תקין.
 */
function toNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildDimMaps(dims) {
  const maps = {};
  for (const dim of dims) {
    const m = {};
    dim.values.forEach((v, i) => { m[v.id] = i; });
    maps[dim.id] = { values: dim.values, map: m };
  }
  return maps;
}

/**
 * returns the numeric index for a dimension value id.
 * throws if not found - fail loud.
 */
function dimIdx(maps, dimId, valueId) {
  const idx = maps[dimId]?.map[valueId];
  if (idx === undefined) {
    throw new Error(`Dimension ${dimId} has no value '${valueId}'. Available: ${Object.keys(maps[dimId]?.map ?? {}).join(', ')}`);
  }
  return idx;
}

// --- BOI policy rate ---

async function fetchBoiRate() {
  // Daily nominal BOI rate, last 750 days (covers ~2 years)
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(today.getFullYear() - 2);
  const startPeriod = twoYearsAgo.toISOString().slice(0, 10);
  const endPeriod = today.toISOString().slice(0, 10);

  const url = `${BASE}/BR/1.0/?format=sdmx-json&dimensionAtObservation=AllDimensions&startPeriod=${startPeriod}&endPeriod=${endPeriod}`;
  console.log(`Fetching BOI rate from ${startPeriod} to ${endPeriod}...`);

  const json = await fetchJson(url);
  const dims = json?.data?.structure?.dimensions?.observation;
  const obsRaw = json?.data?.dataSets?.[0]?.observations;

  if (!dims || !obsRaw) throw new Error('BOI rate response missing dims or observations');

  const maps = buildDimMaps(dims);

  // SERIES_CODE index 0 = MNT_RIB_BOI_D = nominal BOI rate
  const seriesNominal = 0;
  // SERIES_CODE index 0 must really be the nominal one - verify
  const firstSeries = maps['SERIES_CODE']?.values[0];
  if (!firstSeries?.id?.includes('RIB_BOI')) {
    throw new Error(`Expected SERIES_CODE[0] to be BOI nominal rate, got: ${firstSeries?.id}`);
  }

  const tpDim = maps['TIME_PERIOD'];
  if (!tpDim) throw new Error('TIME_PERIOD dimension missing from BOI rate response');

  // Collect monthly snapshots: pick last trading day of each month
  // Keys format: SERIES_CODE:FREQ:IR_FV_TYPE:TIME_PERIOD (based on observed structure)
  // Actually dims order may vary - let's find TIME_PERIOD position
  const tpPos = dims.findIndex((d) => d.id === 'TIME_PERIOD');
  const scPos = dims.findIndex((d) => d.id === 'SERIES_CODE');
  if (tpPos < 0 || scPos < 0) throw new Error('Could not find SERIES_CODE or TIME_PERIOD dims');

  // Gather all obs for the nominal BOI series
  const monthlyRates = {}; // YYYY-MM -> rate
  const allObs = Object.entries(obsRaw);

  for (const [key, val] of allObs) {
    const parts = key.split(':').map(Number);
    if (parts[scPos] !== seriesNominal) continue;
    // ה-API מחזיר את הערכים כמחרוזות ("4.5"), לא כמספרים. ימים ללא מסחר מחזירים null.
    const rate = toNumber(val[0]);
    if (rate === null) continue;

    const tpId = tpDim.values[parts[tpPos]]?.id; // e.g. "2026-09-18"
    if (!tpId) continue;
    const month = tpId.slice(0, 7); // "2026-09"
    // Keep latest day in each month
    if (!monthlyRates[month] || tpId > monthlyRates[month].date) {
      monthlyRates[month] = { date: tpId, rate };
    }
  }

  const trend = Object.entries(monthlyRates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { date, rate }]) => ({ month, date, rate }));

  if (trend.length === 0) throw new Error('BOI rate: no observations found');

  const latest = trend[trend.length - 1];
  console.log(`  BOI rate: ${latest.rate}% (latest day: ${latest.date}), ${trend.length} monthly points`);

  return {
    currentRate: latest.rate,
    latestDate: latest.date,
    latestMonth: latest.month,
    trend,
    source: 'https://www.boi.org.il/en/monetary-policy/interest-rate/',
    apiUrl: `${BASE}/BR/1.0/`,
    dataflow: 'BR',
  };
}

// --- Mortgage rates ---

async function fetchMortgageRates() {
  // Pull 30 months to ensure we catch the latest available (data lags ~6 months)
  const today = new Date();
  const start = new Date(today);
  start.setMonth(today.getMonth() - 30);
  const startPeriod = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  const endPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const url = `${BASE}/BIR_MRTG_99/1.0/?format=sdmx-json&dimensionAtObservation=AllDimensions&startPeriod=${startPeriod}&endPeriod=${endPeriod}`;
  console.log(`Fetching mortgage rates from ${startPeriod} to ${endPeriod}...`);

  const json = await fetchJson(url);
  const dims = json?.data?.structure?.dimensions?.observation;
  const obsRaw = json?.data?.dataSets?.[0]?.observations;

  if (!dims || !obsRaw) throw new Error('Mortgage rates response missing dims or observations');

  const maps = buildDimMaps(dims);
  const tpList = maps['TIME_PERIOD'].values.map((v) => v.id);

  // Safe index lookup - returns -1 if not present (some dims may be absent in small queries)
  const idx = (dimId, valueId) => {
    const v = maps[dimId]?.map[valueId];
    return v !== undefined ? v : -1;
  };

  const dtR = idx('DATA_TYPE', 'R');
  const dtRM = idx('DATA_TYPE', 'RM');
  const dtB = idx('DATA_TYPE', 'B');
  const dtN = idx('DATA_TYPE', 'N');

  const bsA2C = idx('BS_ITEM', 'A2C');
  const bsA2C5 = idx('BS_ITEM', 'A2C5');

  const covN = idx('BIR_COVERAGE', 'N');

  const idxNI = idx('INDEXATION_TYPE', 'NI');
  const idxCPI = idx('INDEXATION_TYPE', 'CPI');
  const idxTotal = idx('INDEXATION_TYPE', '_T');

  const fvA = idx('IR_FV_TYPE', 'A');
  const fvF = idx('IR_FV_TYPE', 'F');
  const fvV = idx('IR_FV_TYPE', 'V');

  const ltvIdMap = {}; // ltv code -> dim index
  for (const [code, dimIdx2] of Object.entries(maps['LTV']?.map ?? {})) {
    ltvIdMap[dimIdx2] = code;
  }

  const ptiAll = idx('PTI', 'P01');
  const pvA = idx('PROPERTY_VALUE', 'A');

  // Dim positions in key
  const pos = {};
  dims.forEach((d, i) => { pos[d.id] = i; });

  const nDims = dims.length;

  function getVal(key) {
    const p = key.split(':').map(Number);
    return p;
  }

  // --- collect average rates by track ---
  // Track = (indexation, fv_type) combination
  // For each, collect monthly time series

  const trackSeries = {}; // "NI+F" -> [{month, rate}]

  // Also collect RM (margin over benchmark) for variable tracks
  const marginSeries = {}; // "CPI+V" -> [{month, margin}]

  // Volume by LTV (B, _T, A, N, L*, P01)
  const volumeByLtv = {}; // month -> {L0:..., L1:..., ...}

  // A2C5 data (investment apartments)
  const a2c5Series = {}; // "B" -> [{month, val}]

  for (const [key, valArr] of Object.entries(obsRaw)) {
    const p = key.split(':').map(Number);
    const bsCov = p[pos['BIR_COVERAGE']];
    const bsItem = p[pos['BS_ITEM']];
    const dt = p[pos['DATA_TYPE']];
    const idxType = p[pos['INDEXATION_TYPE']];
    const fvType = p[pos['IR_FV_TYPE']];
    const ltvPos = p[pos['LTV']];
    const pti = p[pos['PTI']];
    const pv = p[pos['PROPERTY_VALUE']];
    const tpPos2 = p[pos['TIME_PERIOD']];
    const val = toNumber(valArr[0]);
    if (val === null) continue;
    const month = tpList[tpPos2];
    if (!month) continue;

    // Average interest rates for housing loans (A2C), new business (N), total PTI and property
    if (bsItem === bsA2C && bsCov === covN && pti === ptiAll && pv === pvA) {
      if (dt === dtR) {
        const itId = maps['INDEXATION_TYPE'].values[idxType]?.id ?? 'UNKNOWN';
        const fvId = maps['IR_FV_TYPE'].values[fvType]?.id ?? 'UNKNOWN';
        const trackKey = `${itId}+${fvId}`;
        if (!trackSeries[trackKey]) trackSeries[trackKey] = [];
        trackSeries[trackKey].push({ month, rate: val });
      }

      if (dt === dtRM) {
        const itId = maps['INDEXATION_TYPE'].values[idxType]?.id ?? 'UNKNOWN';
        const fvId = maps['IR_FV_TYPE'].values[fvType]?.id ?? 'UNKNOWN';
        const trackKey = `${itId}+${fvId}`;
        if (!marginSeries[trackKey]) marginSeries[trackKey] = [];
        marginSeries[trackKey].push({ month, margin: val });
      }

      // Volume by LTV (_T indexation, A fv_type)
      if (dt === dtB && idxType === idxTotal && fvType === fvA) {
        const ltvCode = ltvIdMap[ltvPos] ?? `L?${ltvPos}`;
        if (!volumeByLtv[month]) volumeByLtv[month] = {};
        volumeByLtv[month][ltvCode] = val; // thousands NIS
      }
    }

    // Investment apartment loans (A2C5)
    if (bsItem === bsA2C5 && bsCov === covN && pti === ptiAll && pv === pvA) {
      const dtId = maps['DATA_TYPE'].values[dt]?.id ?? 'UNKNOWN';
      const itId = maps['INDEXATION_TYPE'].values[idxType]?.id ?? 'UNKNOWN';
      const fvId = maps['IR_FV_TYPE'].values[fvType]?.id ?? 'UNKNOWN';
      const seriesKey = `${dtId}+${itId}+${fvId}`;
      if (!a2c5Series[seriesKey]) a2c5Series[seriesKey] = [];
      a2c5Series[seriesKey].push({ month, val });
    }
  }

  // Sort all series by month
  for (const s of Object.values(trackSeries)) s.sort((a, b) => a.month.localeCompare(b.month));
  for (const s of Object.values(marginSeries)) s.sort((a, b) => a.month.localeCompare(b.month));
  for (const s of Object.values(a2c5Series)) s.sort((a, b) => a.month.localeCompare(b.month));

  // Find latest month with R data
  const latestMonths = Object.values(trackSeries)
    .map((s) => s[s.length - 1]?.month)
    .filter(Boolean);
  const latestRateMonth = latestMonths.sort().reverse()[0] ?? null;

  // Compute latest snapshot
  const latestRates = {};
  for (const [track, series] of Object.entries(trackSeries)) {
    const last = series[series.length - 1];
    if (last) latestRates[track] = { rate: last.rate, month: last.month };
  }
  const latestMargins = {};
  for (const [track, series] of Object.entries(marginSeries)) {
    const last = series[series.length - 1];
    if (last) latestMargins[track] = { margin: last.margin, month: last.month };
  }

  // Volume by LTV for latest available month
  const latestVolumeMonth = Object.keys(volumeByLtv).sort().reverse()[0] ?? null;
  const latestVolume = latestVolumeMonth ? volumeByLtv[latestVolumeMonth] : {};

  // Validate sanity: NI+F should be between 2% and 12%
  const niFixed = latestRates['NI+F']?.rate;
  if (niFixed !== undefined && (niFixed < 1 || niFixed > 15)) {
    throw new Error(`Sanity check failed: NI+F rate = ${niFixed}%. Expected 1-15%. Stopping.`);
  }
  const cpiAll = latestRates['CPI+A']?.rate;
  if (cpiAll !== undefined && (cpiAll < 0.5 || cpiAll > 15)) {
    throw new Error(`Sanity check failed: CPI+A rate = ${cpiAll}%. Expected 0.5-15%. Stopping.`);
  }

  console.log(`  Latest rate month: ${latestRateMonth}`);
  console.log(`  NI+F (unindexed fixed): ${niFixed ?? 'N/A'}%`);
  console.log(`  CPI+A (CPI-indexed all): ${cpiAll ?? 'N/A'}%`);
  if (latestMargins['CPI+V']) {
    console.log(`  CPI+V margin: ${latestMargins['CPI+V'].margin}%`);
  }
  console.log(`  Latest volume month: ${latestVolumeMonth}`);
  if (latestVolume['L0']) console.log(`  Total new loans volume: ${latestVolume['L0'].toLocaleString()} thousand NIS`);

  return {
    latestRateMonth,
    latestRates,
    latestMargins,
    trackSeries,
    marginSeries,
    volumeByLtv,
    latestVolumeMonth,
    a2c5Series,
    ltvLabels: {
      L0: 'סה"כ',
      L1: 'עד 30%',
      L2: '30-45%',
      L3: '45-60%',
      L4: '60-75%',
      L5: '75-90%',
      L6: 'מעל 90%',
      L7: 'ללא ביטחון',
    },
    trackLabels: {
      'NI+F': 'לא צמוד - קבועה',
      'NI+V': 'לא צמוד - משתנה',
      'NI+A': 'לא צמוד - כל הסוגים',
      'CPI+F': 'צמוד מדד - קבועה',
      'CPI+V': 'צמוד מדד - משתנה',
      'CPI+A': 'צמוד מדד - כל הסוגים',
      'IFC_DFC+A': 'מטבע חוץ',
      '_T+A': 'סה"כ כל הסוגים',
    },
    source: 'https://www.boi.org.il/en/monetary-policy/interest-rate/',
    apiUrl: `${BASE}/BIR_MRTG_99/1.0/`,
    dataflow: 'BIR_MRTG_99',
  };
}

// --- Main ---

async function main() {
  console.log('--- fetch-boi.mjs ---');

  let existingSnapshot = null;
  if (existsSync(OUTPUT_PATH)) {
    try {
      existingSnapshot = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
      console.log(`Existing snapshot found (fetchedAt: ${existingSnapshot.fetchedAt})`);
    } catch {
      console.warn('Existing snapshot unreadable, will overwrite.');
    }
  }

  let boiRate, mortgageRates;

  try {
    boiRate = await fetchBoiRate();
  } catch (err) {
    if (existingSnapshot) {
      console.error(`BOI rate fetch failed: ${err.message}`);
      console.warn('Keeping existing snapshot. Run again to retry.');
      process.exit(0);
    }
    throw err;
  }

  try {
    mortgageRates = await fetchMortgageRates();
  } catch (err) {
    if (existingSnapshot) {
      console.error(`Mortgage rates fetch failed: ${err.message}`);
      console.warn('Keeping existing snapshot. Run again to retry.');
      process.exit(0);
    }
    throw err;
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    boiRate,
    mortgageRates,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`\nSnapshot saved to ${OUTPUT_PATH}`);
  console.log(`BOI rate: ${boiRate.currentRate}%, data through ${boiRate.latestDate}`);
  console.log(`Mortgage rates through: ${mortgageRates.latestRateMonth}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
