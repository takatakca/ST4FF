// ST4FF — hours and labour cost from the merchant's Clover employees and shifts (the clock-in truth stays in Clover).
//  - Employees are read from Clover (name, role); the hourly wage is entered here (Clover does not keep it).
//  - Hours per employee for a week (Monday → Sunday, Montréal time), from Clover shifts; a manager's override of the
//    in/out time wins; an open shift counts until now and is flagged (VIP: alert when open > 12 h).
//  - Premium: labour cost vs sales (Clover payments, pre-tax) and planned shifts compared with the real ones.
import crypto from 'node:crypto';
import { cloverGetAll, mpath } from '../clover/api';
import { getStore } from '../core/store';
import { localDate, localDayRange } from '../core/time';

export interface Employee { id: string; name: string; role: string | null; wageCents: number | null }
export interface ShiftRow { employeeId: string; name: string; role: string | null; hours: number; shifts: number; open: boolean; longOpen: boolean; costCents: number | null; plannedHours: number }
export interface Planned { id: string; employeeId: string; date: string; start: string; end: string }
export const WAGES = 'wages';
export const PLANNED = 'planned';

/** Monday of the week containing `date` (YYYY-MM-DD), shifted by `offset` weeks. */
export function weekOf(date: string, offset = 0): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + offset * 7);
  const from = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return { from, to: d.toISOString().slice(0, 10) };
}

export async function employees(mid: string): Promise<{ ok: true; list: Employee[] } | { ok: false; error: string }> {
  const r = await cloverGetAll<any>(mid, mpath(mid, '/employees'), { expand: 'roles' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not read Clover employees.' };
  const wages = Object.fromEntries((await getStore().list<{ employeeId: string; wageCents: number }>(WAGES, { merchantId: mid, limit: 1000 })).map((d) => [d.data.employeeId, d.data.wageCents]));
  return { ok: true, list: r.items.filter((e) => !e.deletedTime).map((e) => ({ id: String(e.id), name: String(e.name ?? e.nickname ?? e.id), role: e.roles?.elements?.[0]?.name ?? e.role ?? null, wageCents: wages[String(e.id)] ?? null })) };
}

export async function setWage(mid: string, employeeId: string, wageCents: number): Promise<{ ok: boolean; error?: string }> {
  if (!/^[A-Z0-9]{8,20}$/i.test(employeeId)) return { ok: false, error: 'Unknown employee.' };
  if (!Number.isInteger(wageCents) || wageCents < 0 || wageCents > 50_000) return { ok: false, error: 'Wage: 0 to 500 $ / hour.' };
  await getStore().put(WAGES, `${mid}:${employeeId}`, mid, { employeeId, wageCents });
  return { ok: true };
}

const shiftStart = (s: any) => Number(s.overrideInTime ?? s.inTime) || 0;
const shiftEnd = (s: any) => Number(s.overrideOutTime ?? s.outTime) || 0;

/** Hours a shift overlaps the window (open shifts count until `now`). */
export function shiftHours(s: any, start: number, end: number, now = Date.now()): number {
  const a = shiftStart(s); const b = shiftEnd(s) || now;
  if (!a || b <= a) return 0;
  return Math.max(0, Math.min(b, end) - Math.max(a, start)) / 3_600_000;
}

async function shiftsOf(mid: string, employeeId: string, start: number): Promise<any[]> {
  const path = mpath(mid, `/employees/${encodeURIComponent(employeeId)}/shifts`);
  const r = await cloverGetAll<any>(mid, path, { filter: `inTime>=${start - 86400_000}` });
  if (r.ok) return r.items;
  const all = await cloverGetAll<any>(mid, path); // the filter is not accepted everywhere: read all, keep the window
  return all.items;
}

export async function weekReport(mid: string, from: string, to: string, now = Date.now()): Promise<{ ok: true; rows: ShiftRow[]; totalHours: number; costCents: number; salesCents: number | null } | { ok: false; error: string }> {
  const e = await employees(mid);
  if (!e.ok) return e;
  const start = localDayRange(from)[0]; const end = localDayRange(to)[1];
  const planned = (await getStore().list<Planned>(PLANNED, { merchantId: mid, limit: 5000 })).map((d) => d.data).filter((p) => p.date >= from && p.date <= to);
  const rows: ShiftRow[] = [];
  for (const emp of e.list) {
    const shifts = (await shiftsOf(mid, emp.id, start)).filter((s) => shiftHours(s, start, end, now) > 0);
    const hours = shifts.reduce((t, s) => t + shiftHours(s, start, end, now), 0);
    const open = shifts.some((s) => !shiftEnd(s));
    const longOpen = shifts.some((s) => !shiftEnd(s) && now - shiftStart(s) > 12 * 3_600_000);
    const plannedHours = planned.filter((p) => p.employeeId === emp.id).reduce((t, p) => t + plannedLength(p), 0);
    if (!hours && !plannedHours) continue;
    rows.push({ employeeId: emp.id, name: emp.name, role: emp.role, hours: Math.round(hours * 100) / 100, shifts: shifts.length, open, longOpen, costCents: emp.wageCents === null ? null : Math.round(hours * emp.wageCents), plannedHours });
  }
  const pay = await cloverGetAll<any>(mid, mpath(mid, '/payments'), { filter: [`createdTime>=${start}`, `createdTime<${end}`] });
  const salesCents = pay.ok ? pay.items.filter((p) => !p.result || p.result === 'SUCCESS').reduce((t, p) => t + (Number(p.amount) || 0) - (Number(p.taxAmount) || 0), 0) : null;
  return { ok: true, rows: rows.sort((a, b) => b.hours - a.hours), totalHours: Math.round(rows.reduce((t, r) => t + r.hours, 0) * 100) / 100, costCents: rows.reduce((t, r) => t + (r.costCents ?? 0), 0), salesCents };
}

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const plannedLength = (p: Pick<Planned, 'start' | 'end'>) => { const a = toMin(p.start); let b = toMin(p.end); if (b <= a) b += 24 * 60; return (b - a) / 60; };

export async function planShift(mid: string, p: { employeeId?: unknown; date?: unknown; start?: unknown; end?: unknown }): Promise<{ ok: true; planned: Planned } | { ok: false; error: string }> {
  const employeeId = String(p.employeeId ?? ''); const date = String(p.date ?? ''); const start = String(p.start ?? ''); const end = String(p.end ?? '');
  if (!/^[A-Z0-9]{8,20}$/i.test(employeeId)) return { ok: false, error: 'Choose an employee.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < localDate(Date.now() - 31 * 86400_000)) return { ok: false, error: 'Date is not valid.' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return { ok: false, error: 'Times must be HH:MM.' };
  if (plannedLength({ start, end }) > 16) return { ok: false, error: 'A shift cannot be longer than 16 hours.' };
  const planned: Planned = { id: crypto.randomUUID(), employeeId, date, start, end };
  await getStore().put(PLANNED, planned.id, mid, planned, new Date(`${date}T12:00:00Z`).toISOString());
  return { ok: true, planned };
}
