import {today, calculate, invoiceBalance, requiredEquipment, roundMoney} from './core.js';

// Hinweise beruhen ausschließlich auf dem gespeicherten Betriebsbestand.
export function dailyOverview(state, date = today()) {
  const active = state.jobs.filter(j => !['Angebot', 'Erledigt', 'Storniert'].includes(j.status));
  const agenda = active.filter(j => j.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const upcoming = active.filter(j => j.date >= date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const overdue = state.invoices.filter(i => invoiceBalance(i).open > 0 && i.due && i.due < date);
  const unbilled = state.jobs.filter(j => j.status === 'Erledigt' && !state.invoices.some(i => i.jobId === j.id));
  const missed = active.filter(j => j.date && j.date < date);
  const lowMargin = state.jobs.filter(j => !['Erledigt', 'Storniert'].includes(j.status) && calculate(j, state.settings).margin < (j.costSettings?.targetMargin ?? state.settings.targetMargin));
  const missing = [...new Map(agenda.flatMap(requiredEquipment).filter(eq => !state.owned.includes(eq.id)).map(eq => [eq.id, eq])).values()];
  const lastExport = state.settings.lastBackupExportAt;
  const exportTime = lastExport ? Date.parse(lastExport) : NaN;
  const backupDue = !Number.isFinite(exportTime) || Date.parse(date + 'T23:59:59') - exportTime > 7 * 86400000;
  return {agenda, upcoming, overdue, unbilled, missed, lowMargin, missing, backupDue,
    overdueTotal: roundMoney(overdue.reduce((sum, i) => sum + invoiceBalance(i).open, 0)),
    plannedHours: agenda.reduce((sum, j) => sum + (Number(j.duration) || 0), 0),
    attention: overdue.length + unbilled.length + missed.length};
}

export function contactLinks(customer) {
  const c = customer || {};
  const phone = String(c.phone || '').replace(/[^+\d*#]/g, '');
  const email = String(c.email || '').trim();
  return {
    phone: phone && /\d/.test(phone) ? 'tel:' + phone : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') : '',
    maps: c.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address) : ''
  };
}
