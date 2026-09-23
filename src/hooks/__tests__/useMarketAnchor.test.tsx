/**
 * @vitest-environment jsdom
 *
 * טסטים ל-useMarketAnchor עם govmap מוחלף (mock) - אין קריאות רשת
 * אמיתיות בטסט. מה שנבדק: הזרימה משליטה בכתובת ועד תצוגת תובנות,
 * וטיפול עדין בכישלון בכל שלב (לא זורק, לא תוקע את המסך).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMarketAnchor } from '../useMarketAnchor';

vi.mock('@/services/govmap', () => ({
  autocomplete: vi.fn(),
  dealsNear: vi.fn(),
  neighborhoodDeals: vi.fn(),
  parseItmPoint: vi.fn(),
}));

import { autocomplete, dealsNear, neighborhoodDeals, parseItmPoint } from '@/services/govmap';

const mockAutocomplete = vi.mocked(autocomplete);
const mockDealsNear = vi.mocked(dealsNear);
const mockNeighborhoodDeals = vi.mocked(neighborhoodDeals);
const mockParseItm = vi.mocked(parseItmPoint);

const address = { id: 'a1', text: 'דיזנגוף 100 תל אביב', type: 'address', shape: 'POINT(180000 665000)' };

function rawDeal(pricePerSqm: number, date = '2026-01-01') {
  const sqm = 80;
  return { dealDate: date, dealAmount: pricePerSqm * sqm, sqmeter: sqm };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParseItm.mockReturnValue({ x: 180000, y: 665000 });
});

describe('useMarketAnchor', () => {
  it('בחירת כתובת עם מספיק עסקאות מציגה תובנות מוכנות', async () => {
    mockDealsNear.mockResolvedValue({
      ok: true,
      data: [{ dealscount: 10, settlementNameHeb: 'תל אביב', streetNameHeb: 'דיזנגוף', houseNum: '100', polygon_id: 'p1', objectid: 1 }],
    });
    mockNeighborhoodDeals.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 6 }, (_, i) => rawDeal(24_000 + i * 200)),
    });

    const { result } = renderHook(() => useMarketAnchor(25_000));

    act(() => result.current.select(address));

    await waitFor(() => expect(result.current.status.kind).toBe('ready'));
    if (result.current.status.kind !== 'ready') throw new Error('unreachable');
    expect(result.current.status.insights.dealCount).toBe(6);
    expect(result.current.selected?.text).toBe(address.text);
  });

  it('פחות מהמינימום מחזיר insufficient ולא חציון מטעה', async () => {
    mockDealsNear.mockResolvedValue({
      ok: true,
      data: [{ dealscount: 2, settlementNameHeb: 'x', streetNameHeb: 'y', houseNum: '1', polygon_id: 'p2', objectid: 2 }],
    });
    mockNeighborhoodDeals.mockResolvedValue({ ok: true, data: [rawDeal(24_000), rawDeal(25_000)] });

    const { result } = renderHook(() => useMarketAnchor(25_000));
    act(() => result.current.select(address));

    await waitFor(() => expect(result.current.status.kind).toBe('insufficient'));
  });

  it('כישלון ברשת מוצג כשגיאה עדינה, לא נזרק', async () => {
    mockDealsNear.mockResolvedValue({ ok: false, error: { code: 'NETWORK', message: 'x' } });

    const { result } = renderHook(() => useMarketAnchor(25_000));
    act(() => result.current.select(address));

    await waitFor(() => expect(result.current.status.kind).toBe('error'));
  });

  it('clear מחזיר למצב idle ומאפס את הבחירה', async () => {
    mockDealsNear.mockResolvedValue({
      ok: true,
      data: [{ dealscount: 10, settlementNameHeb: 'x', streetNameHeb: 'y', houseNum: '1', polygon_id: 'p3', objectid: 3 }],
    });
    mockNeighborhoodDeals.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 6 }, () => rawDeal(24_000)),
    });

    const { result } = renderHook(() => useMarketAnchor(25_000));
    act(() => result.current.select(address));
    await waitFor(() => expect(result.current.status.kind).toBe('ready'));

    act(() => result.current.clear());
    expect(result.current.status.kind).toBe('idle');
    expect(result.current.selected).toBeNull();
  });

  it('לא קורא ל-autocomplete כשלא הוקלד כלום', () => {
    renderHook(() => useMarketAnchor(0));
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });
});
