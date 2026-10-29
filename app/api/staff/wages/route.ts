import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { setWage } from '@/lib/domain/staff';

export const dynamic = 'force-dynamic';

// { employeeId, wageCents } — hourly wage kept in ST4FF (Clover has no wage field).
export async function PUT(req: Request) {
  const c = await requireMerchant(req);
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  const r = await setWage(c.merchantId, String(b.employeeId ?? ''), Number(b.wageCents));
  return r.ok ? ok() : fail(r.error ?? 'Not saved');
}
