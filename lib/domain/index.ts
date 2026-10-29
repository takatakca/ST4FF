// ST4FF's side of the shared shell: hooks, menu sections, authorized actions, device kinds, what each plan adds.
// No hooks needed yet — employees and shifts are read live from Clover (webhook E kept for VIP alerts later).
import type { AppHooks } from '../hooks';
import type { AppAction, AppSection, DeviceKind, TierFeatures } from '../nav';

export const hooks: AppHooks = {};

export const sections: AppSection[] = [
  { slug: '', fr: 'Semaine', en: 'Week', icon: 'clock', view: 'staff.view', hintFr: 'Heures par employé selon les quarts Clover, et ce qu’elles coûtent.', hintEn: 'Hours per employee from Clover shifts, and what they cost.' },
  { slug: 'team', fr: 'Équipe', en: 'Team', icon: 'users', hub: true, view: 'staff.view', hintFr: 'Employés, taux horaires et horaires planifiés.', hintEn: 'Employees, hourly wages and planned schedules.' },
  { slug: 'employees', parent: 'team', fr: 'Employés', en: 'Employees', icon: 'user', view: 'staff.view', hintFr: 'Lus dans Clover : nom et rôle.', hintEn: 'Read from Clover: name and role.' },
  { slug: 'wages', parent: 'team', fr: 'Taux horaires', en: 'Hourly wages', icon: 'money', view: 'staff.wages', hintFr: 'Clover ne garde pas les salaires : entrez-les ici.', hintEn: 'Clover does not keep wages: enter them here.' },
  { slug: 'schedule', parent: 'team', fr: 'Horaires planifiés', en: 'Planned schedule', icon: 'calendar', tier: 'premium', view: 'staff.schedule', hintFr: 'Les quarts prévus, comparés aux quarts réels.', hintEn: 'Planned shifts, compared with the real ones.' },
];

export const actions: AppAction[] = [
  { key: 'staff.view', fr: 'Voir les heures et le coût de main-d’œuvre', en: 'See hours and labour cost', min: 'manager' },
  { key: 'staff.wages', fr: 'Voir et changer les taux horaires', en: 'See and change hourly wages', min: 'admin' },
  { key: 'staff.schedule', fr: 'Planifier des quarts', en: 'Plan shifts', min: 'manager' },
];

export const deviceKinds: DeviceKind[] = [];

export const tierFeatures: TierFeatures = {
  base: [
    ['Employés et rôles lus dans Clover', 'Employees and roles read from Clover'],
    ['Heures par employé selon les quarts Clover, semaine par semaine', 'Hours per employee from Clover shifts, week by week'],
    ['Coût de main-d’œuvre selon vos taux horaires', 'Labour cost from your hourly wages'],
    ['Quart ouvert depuis plus de 12 heures signalé', 'Shift open for more than 12 hours flagged'],
  ],
  premium: [
    ['Main-d’œuvre en % des ventes Clover', 'Labour as a % of Clover sales'],
    ['Horaires planifiés comparés au réel', 'Planned schedules compared with the real ones'],
  ],
  vip: [
    ['Bientôt : heures supplémentaires et pauses, export paie, alertes (retard, quart non fermé)', 'Coming: overtime and breaks, payroll export, alerts (late, shift left open)'],
  ],
};
