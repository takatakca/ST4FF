import { tierAtLeast } from '@/lib/app';
import { money, pick } from '@/lib/core/i18n';
import type { PageCtx } from '@/lib/core/page';
import { getStore } from '@/lib/core/store';
import { localDate } from '@/lib/core/time';
import { employees, PLANNED, plannedLength, weekOf, weekReport, type Planned } from '@/lib/domain/staff';
import { ApiForm } from './ApiForm';
import { Icon } from './icons';
import { Badge, Banner, Bars, Card, Empty, Stat } from './ui';

// ST4FF screens (lib/domain `sections`): the week (hours, cost, labour %), employees, wages, planned schedule.
// The week comes from the address (?week=0 this week, -1 last week…).
const weekParam = (q?: Record<string, string>) => Math.max(-52, Math.min(0, Number(q?.week ?? 0) || 0));

export async function Panel({ ctx, section, query }: { ctx: PageCtx; section: string; query?: Record<string, string> }) {
  switch (section) {
    case '': return <Week ctx={ctx} offset={weekParam(query)} />;
    case 'employees': return <Employees ctx={ctx} />;
    case 'wages': return <Wages ctx={ctx} />;
    case 'schedule': return <Schedule ctx={ctx} offset={weekParam(query)} />;
    default: return null;
  }
}

function WeekNav({ lang, offset, from, to, path }: { lang: 'fr' | 'en'; offset: number; from: string; to: string; path: string }) {
  return (
    <div className="row week-nav">
      <a className="btn ghost" href={`${path}?week=${offset - 1}`} aria-label={pick(lang, 'Semaine précédente', 'Previous week')}><Icon name="chevron" size={16} className="flip" /></a>
      <strong>{from} → {to}</strong>
      {offset < 0 ? <a className="btn ghost" href={`${path}?week=${offset + 1}`} aria-label={pick(lang, 'Semaine suivante', 'Next week')}><Icon name="chevron" size={16} /></a> : <span className="muted small">{pick(lang, 'cette semaine', 'this week')}</span>}
    </div>
  );
}

async function Week({ ctx, offset }: { ctx: PageCtx; offset: number }) {
  const { lang, merchantId, tier } = ctx;
  const w = weekOf(localDate(), offset);
  const r = await weekReport(merchantId!, w.from, w.to);
  if (!r.ok) return <Banner tone="warn">{r.error}</Banner>;
  const premium = tierAtLeast(tier, 'premium');
  // No wage entered for anyone yet: the cost is unknown, not zero.
  const costKnown = r.rows.some((x) => x.costCents !== null);
  const pct = premium && costKnown && r.salesCents ? Math.round((r.costCents / r.salesCents) * 1000) / 10 : null;
  const showCost = ctx.can('staff.wages');
  return (
    <>
      <WeekNav lang={lang} offset={offset} from={w.from} to={w.to} path="/app" />
      <div className="grid">
        <Stat label={pick(lang, 'Heures', 'Hours')} value={r.totalHours.toFixed(1)} note={`${r.rows.length} ${pick(lang, 'employés', 'employees')}`} />
        {showCost && <Stat label={pick(lang, 'Coût de main-d’œuvre', 'Labour cost')} value={costKnown ? money(r.costCents, lang) : '—'} note={costKnown ? pick(lang, 'selon les taux entrés', 'from the wages entered') : <a href="/app/wages">{pick(lang, 'Entrez les taux horaires', 'Enter the hourly wages')}</a>} />}
        {premium && showCost && <Stat label={pick(lang, '% des ventes', '% of sales')} value={pct === null ? '—' : `${pct} %`} tone={pct !== null && pct > 35 ? 'warn' : undefined} note={r.salesCents === null ? '' : `${pick(lang, 'ventes', 'sales')} ${money(r.salesCents, lang)}`} />}
        <Stat label={pick(lang, 'Quarts ouverts', 'Open shifts')} value={r.rows.filter((x) => x.open).length} tone={r.rows.some((x) => x.longOpen) ? 'stop' : undefined} />
      </div>
      <Card title={pick(lang, 'Heures par employé', 'Hours per employee')} icon="chart">
        <Bars rows={r.rows.map((x) => ({ label: x.name, value: x.hours, shown: `${x.hours.toFixed(1)} h`, note: premium && x.plannedHours ? `${pick(lang, 'prévu', 'planned')} ${x.plannedHours.toFixed(1)} h` : undefined }))} empty={pick(lang, 'Aucun quart cette semaine dans Clover.', 'No shift this week in Clover.')} />
      </Card>
      {r.rows.length > 0 && (
        <Card title={pick(lang, 'Détail', 'Detail')} icon="list">
          <div className="table-wrap"><table><thead><tr><th>{pick(lang, 'Employé', 'Employee')}</th><th className="right">{pick(lang, 'Quarts', 'Shifts')}</th><th className="right">{pick(lang, 'Heures', 'Hours')}</th>{premium && <th className="right">{pick(lang, 'Prévues', 'Planned')}</th>}{showCost && <th className="right">{pick(lang, 'Coût', 'Cost')}</th>}<th /></tr></thead>
            <tbody>{r.rows.map((x) => <tr key={x.employeeId}><td>{x.name}{x.role ? <div className="muted small">{x.role}</div> : null}</td><td className="right">{x.shifts}</td><td className="right">{x.hours.toFixed(2)}</td>{premium && <td className="right">{x.plannedHours ? x.plannedHours.toFixed(2) : '—'}</td>}{showCost && <td className="right">{x.costCents === null ? <a href="/app/wages">{pick(lang, 'taux ?', 'wage?')}</a> : money(x.costCents, lang)}</td>}
              <td>{x.longOpen ? <Badge tone="stop">{pick(lang, 'Quart ouvert > 12 h', 'Shift open > 12 h')}</Badge> : x.open ? <Badge tone="ok">{pick(lang, 'En poste', 'On shift')}</Badge> : null}</td></tr>)}</tbody></table></div>
        </Card>
      )}
    </>
  );
}

async function Employees({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId } = ctx;
  const e = await employees(merchantId!);
  if (!e.ok) return <Banner tone="warn">{e.error}</Banner>;
  return (
    <Card title={pick(lang, 'Employés dans Clover', 'Employees in Clover')} icon="users" right={<Badge>{e.list.length}</Badge>} sub={pick(lang, 'Pour ajouter ou retirer un employé : Clover → Employés.', 'To add or remove an employee: Clover → Employees.')}>
      {e.list.length === 0 ? <Empty icon="users">{pick(lang, 'Aucun employé dans Clover.', 'No employee in Clover.')}</Empty> : (
        <div className="table-wrap"><table><thead><tr><th>{pick(lang, 'Nom', 'Name')}</th><th>{pick(lang, 'Rôle', 'Role')}</th>{ctx.can('staff.wages') && <th className="right">{pick(lang, 'Taux', 'Wage')}</th>}</tr></thead>
          <tbody>{e.list.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.role ?? '—'}</td>{ctx.can('staff.wages') && <td className="right">{x.wageCents === null ? '—' : `${money(x.wageCents, lang)}/h`}</td>}</tr>)}</tbody></table></div>
      )}
    </Card>
  );
}

async function Wages({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId } = ctx;
  const e = await employees(merchantId!);
  if (!e.ok) return <Banner tone="warn">{e.error}</Banner>;
  const missing = e.list.filter((x) => x.wageCents === null).length;
  return (
    <>
      {missing > 0 && <Banner tone="warn">{pick(lang, `${missing} employé(s) sans taux : leur coût ne compte pas encore.`, `${missing} employee(s) without a wage: their cost does not count yet.`)}</Banner>}
      <Card title={pick(lang, 'Changer un taux', 'Change a wage')} icon="money" sub={pick(lang, 'Gardé dans ST4FF seulement ; vu par les rôles autorisés.', 'Kept in ST4FF only; seen by the allowed roles.')}>
        <ApiForm action="/api/staff/wages" method="PUT" fields={[
          { name: 'employeeId', label: pick(lang, 'Employé', 'Employee'), type: 'select', options: e.list.map((s) => ({ value: s.id, label: `${s.name}${s.wageCents !== null ? ` (${money(s.wageCents, lang)})` : ''}` })) },
          { name: 'wageCents', label: pick(lang, 'Taux ($/h)', 'Wage ($/h)'), type: 'money', required: true },
        ]} submit={pick(lang, 'Enregistrer', 'Save')} done={pick(lang, 'Taux enregistré.', 'Wage saved.')} />
      </Card>
    </>
  );
}

async function Schedule({ ctx, offset }: { ctx: PageCtx; offset: number }) {
  const { lang, merchantId } = ctx;
  const w = weekOf(localDate(), offset);
  const [e, docs] = await Promise.all([employees(merchantId!), getStore().list<Planned>(PLANNED, { merchantId: merchantId!, limit: 2000 })]);
  const names = new Map((e.ok ? e.list : []).map((x) => [x.id, x.name]));
  const week = docs.map((d) => d.data).filter((p) => p.date >= w.from && p.date <= w.to).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return (
    <>
      <WeekNav lang={lang} offset={offset} from={w.from} to={w.to} path="/app/schedule" />
      <Card title={pick(lang, 'Quarts prévus', 'Planned shifts')} icon="calendar" right={<Badge>{week.reduce((s, p) => s + plannedLength(p), 0).toFixed(1)} h</Badge>}>
        {week.length === 0 ? <Empty icon="calendar">{pick(lang, 'Aucun quart prévu cette semaine.', 'No shift planned this week.')}</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>{pick(lang, 'Employé', 'Employee')}</th><th>{pick(lang, 'Heures', 'Hours')}</th><th className="right">{pick(lang, 'Durée', 'Length')}</th></tr></thead>
            <tbody>{week.map((p) => <tr key={p.id}><td className="nowrap">{p.date}</td><td>{names.get(p.employeeId) ?? p.employeeId}</td><td>{p.start} → {p.end}</td><td className="right">{plannedLength(p).toFixed(1)} h</td></tr>)}</tbody></table></div>
        )}
      </Card>
      <Card title={pick(lang, 'Planifier un quart', 'Plan a shift')} icon="plus">
        <ApiForm action="/api/staff/schedule" fields={[
          { name: 'employeeId', label: pick(lang, 'Employé', 'Employee'), type: 'select', options: (e.ok ? e.list : []).map((s) => ({ value: s.id, label: s.name })) },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'start', label: pick(lang, 'Début (HH:MM)', 'Start (HH:MM)'), required: true, placeholder: '11:00' },
          { name: 'end', label: pick(lang, 'Fin (HH:MM)', 'End (HH:MM)'), required: true, placeholder: '19:00' },
        ]} submit={pick(lang, 'Ajouter', 'Add')} done={pick(lang, 'Quart ajouté.', 'Shift added.')} />
      </Card>
    </>
  );
}
