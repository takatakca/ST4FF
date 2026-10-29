import { tierAtLeast } from '@/lib/app';
import { allowed, getPolicy, type AccessPolicy } from '@/lib/core/access';
import { isCtx, requireMerchant } from '@/lib/core/guard';
import type { Role } from '@/lib/core/roles';
import { fail, ok } from '@/lib/core/http';
import { localDate } from '@/lib/core/time';
import { weekOf, weekReport } from '@/lib/domain/staff';

export const dynamic = 'force-dynamic';

const allowedToSeeWages = (role: Role, policy: AccessPolicy) => allowed(policy, role, 'staff.wages');

// GET ?week=0 (this week) | -1 (last week)… → hours, cost and (Premium) labour % of sales.
export async function GET(req: Request) {
  const c = await requireMerchant(req, 'base', { action: 'staff.view' });
  if (!isCtx(c)) return c;
  const offset = Math.max(-52, Math.min(0, Number(new URL(req.url).searchParams.get('week') ?? 0) || 0));
  const w = weekOf(localDate(), offset);
  const r = await weekReport(c.merchantId, w.from, w.to);
  if (!r.ok) return fail(r.error, 502);
  // Cost and wages only for the roles allowed to see wages (staff.wages).
  const wages = allowedToSeeWages(c.role, await getPolicy(c.merchantId));
  const rows = wages ? r.rows : r.rows.map((x) => ({ ...x, costCents: null }));
  return ok({ ...w, ...r, rows, costCents: wages ? r.costCents : null, salesCents: tierAtLeast(c.tier, 'premium') && wages ? r.salesCents : null });
}
