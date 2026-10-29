import { tierAtLeast } from '@/lib/app';
import { money, pick } from '@/lib/core/i18n';
import type { PageCtx } from '@/lib/core/page';
import { localDate } from '@/lib/core/time';
import { employees, weekOf, weekReport } from '@/lib/domain/staff';
import { ApiForm } from './ApiForm';
import { Badge, Banner, Card, Stat } from './ui';

// ST4FF dashboard: this week's hours from Clover shifts, labour cost and % of sales (Premium), wages, planned shifts.
export async function Panel({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId, tier } = ctx;
  if (!merchantId) return null;
  const w = weekOf(localDate());
  const [r, e] = await Promise.all([weekReport(merchantId, w.from, w.to), employees(merchantId)]);
  if (!r.ok) return <Banner tone="warn">{r.error}</Banner>;
  const premium = tierAtLeast(tier, 'premium');
  const pct = premium && r.salesCents ? Math.round((r.costCents / r.salesCents) * 1000) / 10 : null;
  const staff = e.ok ? e.list : [];
  return (
    <>
      <div className="grid">
        <Stat label={pick(lang, `Heures (${w.from} → ${w.to})`, `Hours (${w.from} → ${w.to})`)} value={r.totalHours.toFixed(1)} />
        <Stat label={pick(lang, 'Coût de main-d’œuvre', 'Labour cost')} value={money(r.costCents, lang)} note={pick(lang, 'selon les taux entrés', 'from the wages entered')} />
        {premium && <Stat label={pick(lang, '% des ventes', '% of sales')} value={pct === null ? '—' : `${pct} %`} note={r.salesCents === null ? '' : `${pick(lang, 'ventes', 'sales')} ${money(r.salesCents, lang)}`} />}
      </div>
      <Card title={pick(lang, 'Cette semaine', 'This week')}>
        {r.rows.length === 0 ? <p className="muted">{pick(lang, 'Aucun quart cette semaine dans Clover.', 'No shift this week in Clover.')}</p> : (
          <table><thead><tr><th>{pick(lang, 'Employé', 'Employee')}</th><th>{pick(lang, 'Heures', 'Hours')}</th>{premium && <th>{pick(lang, 'Prévues', 'Planned')}</th>}<th>{pick(lang, 'Coût', 'Cost')}</th><th /></tr></thead>
            <tbody>{r.rows.map((x) => <tr key={x.employeeId}><td>{x.name}{x.role ? <span className="muted"> · {x.role}</span> : null}</td><td>{x.hours.toFixed(2)}</td>{premium && <td>{x.plannedHours ? x.plannedHours.toFixed(2) : '—'}</td>}<td>{x.costCents === null ? pick(lang, 'taux ?', 'wage?') : money(x.costCents, lang)}</td>
              <td>{x.longOpen ? <Badge tone="stop">{pick(lang, 'Quart ouvert > 12 h', 'Shift open > 12 h')}</Badge> : x.open ? <Badge tone="ok">{pick(lang, 'En poste', 'On shift')}</Badge> : null}</td></tr>)}</tbody></table>
        )}
      </Card>
      <Card title={pick(lang, 'Taux horaire', 'Hourly wage')}>
        <ApiForm action="/api/staff/wages" method="PUT" fields={[
          { name: 'employeeId', label: pick(lang, 'Employé', 'Employee'), type: 'select', options: staff.map((s) => ({ value: s.id, label: `${s.name}${s.wageCents !== null ? ` (${money(s.wageCents, lang)})` : ''}` })) },
          { name: 'wageCents', label: pick(lang, 'Taux ($/h)', 'Wage ($/h)'), type: 'money', required: true },
        ]} submit={pick(lang, 'Enregistrer', 'Save')} />
      </Card>
      {premium ? (
        <Card title={pick(lang, 'Planifier un quart', 'Plan a shift')}>
          <ApiForm action="/api/staff/schedule" fields={[
            { name: 'employeeId', label: pick(lang, 'Employé', 'Employee'), type: 'select', options: staff.map((s) => ({ value: s.id, label: s.name })) },
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'start', label: pick(lang, 'Début (HH:MM)', 'Start (HH:MM)'), required: true, placeholder: '11:00' },
            { name: 'end', label: pick(lang, 'Fin (HH:MM)', 'End (HH:MM)'), required: true, placeholder: '19:00' },
          ]} submit={pick(lang, 'Ajouter', 'Add')} />
        </Card>
      ) : <p className="muted">{pick(lang, 'Horaires planifiés et % de main-d’œuvre : forfait Premium.', 'Planned schedules and labour %: Premium plan.')}</p>}
    </>
  );
}
