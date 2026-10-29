// ST4FF: weeks, shift hours (overrides, open shifts), wages, labour vs sales, planned shifts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planShift, plannedLength, setWage, shiftHours, weekOf, weekReport } from '@/lib/domain/staff';
import { localDayRange } from '@/lib/core/time';
import { connect, fakeClover, MID } from './helpers';

const [MON] = localDayRange('2026-10-26');
const H = 3_600_000;
let shifts: Record<string, any[]> = {};
beforeEach(async () => {
  shifts = {
    EMPANA000001: [{ inTime: MON + 10 * H, outTime: MON + 18 * H }, { inTime: MON + 24 * H + 10 * H, outTime: MON + 24 * H + 14 * H, overrideOutTime: MON + 24 * H + 15 * H }],
    EMPBOB000001: [{ inTime: MON + 48 * H + 8 * H }],
  };
  fakeClover([(u) => {
    if (u.pathname.endsWith('/employees')) return { elements: [{ id: 'EMPANA000001', name: 'Ana', roles: { elements: [{ name: 'Cuisine' }] } }, { id: 'EMPBOB000001', name: 'Bob' }, { id: 'EMPOLD000001', name: 'Old', deletedTime: 1 }] };
    const m = /employees\/(\w+)\/shifts/.exec(u.pathname);
    if (m) return { elements: shifts[m[1]] ?? [] };
    if (u.pathname.endsWith('/payments')) return { elements: [{ result: 'SUCCESS', amount: 115000, taxAmount: 15000 }] };
    return undefined;
  }]);
  await connect();
});
afterEach(() => vi.unstubAllGlobals());

describe('staff', () => {
  it('weeks start on Monday', () => {
    expect(weekOf('2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(weekOf('2026-10-26', -1)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('hours inside the window; override wins; open shift counts until now', () => {
    const T = MON;
    expect(shiftHours({ inTime: T, outTime: T + 10 * H }, T + 2 * H, T + 6 * H)).toBe(4);
    expect(shiftHours({ inTime: T, outTime: T + 3 * H, overrideOutTime: T + 5 * H }, T, T + 100 * H)).toBe(5);
    expect(shiftHours({ inTime: T + H }, T, T + 100 * H, T + 3 * H)).toBe(2);
    expect(plannedLength({ start: '22:00', end: '02:00' })).toBe(4);
  });

  it('week report: hours, cost from wages, open shift flags, sales pre-tax', async () => {
    await setWage(MID, 'EMPANA000001', 2000);
    const now = MON + 48 * H + 22 * H; // Wednesday 22:00, Bob in since 08:00 (14 h)
    const r = await weekReport(MID, '2026-10-26', '2026-11-01', now);
    if (!r.ok) throw new Error(r.error);
    const ana = r.rows.find((x) => x.name === 'Ana')!;
    const bob = r.rows.find((x) => x.name === 'Bob')!;
    expect(ana).toMatchObject({ hours: 13, shifts: 2, costCents: 26000, open: false, role: 'Cuisine' });
    expect(bob).toMatchObject({ hours: 14, open: true, longOpen: true, costCents: null });
    expect(r.salesCents).toBe(100000);
    expect(r.rows.some((x) => x.name === 'Old')).toBe(false);
  });

  it('wages and planned shifts are checked', async () => {
    expect(await setWage(MID, 'EMPANA000001', -1)).toMatchObject({ ok: false });
    expect(await planShift(MID, { employeeId: 'EMPANA000001', date: '2026-10-30', start: '25:00', end: '10:00' })).toMatchObject({ ok: false });
    expect(await planShift(MID, { employeeId: 'EMPANA000001', date: '2026-10-30', start: '06:00', end: '23:30' })).toMatchObject({ ok: false });
    expect(await planShift(MID, { employeeId: 'EMPANA000001', date: '2099-10-30', start: '11:00', end: '19:00' })).toMatchObject({ ok: true });
  });
});
