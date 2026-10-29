import { tierAtLeast } from '@/lib/app';
import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail, ok } from '@/lib/core/http';
import { localDate } from '@/lib/core/time';
import { weekOf, weekReport } from '@/lib/domain/staff';

export const dynamic = 'force-dynamic';

// GET ?week=0 (this week) | -1 (last week)… → hours, cost and (Premium) labour % of sales.
export async function GET(req: Request) {
  const c = await requireMerchant(req);
  if (!isCtx(c)) return c;
  const offset = Math.max(-52, Math.min(0, Number(new URL(req.url).searchParams.get('week') ?? 0) || 0));
  const w = weekOf(localDate(), offset);
  const r = await weekReport(c.merchantId, w.from, w.to);
  if (!r.ok) return fail(r.error, 502);
  return ok({ ...w, ...r, salesCents: tierAtLeast(c.tier, 'premium') ? r.salesCents : null });
}
