import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { planShift } from '@/lib/domain/staff';

export const dynamic = 'force-dynamic';

// Premium: { employeeId, date, start "HH:MM", end "HH:MM" } → a planned shift (compared with Clover's real shifts).
export async function POST(req: Request) {
  const c = await requireMerchant(req, 'premium');
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  const r = await planShift(c.merchantId, b);
  return r.ok ? ok({ planned: r.planned }) : fail(r.error);
}
