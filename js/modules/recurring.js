/**
 * Recurring Bills & Subscriptions Manager
 * Tracks recurring subscriptions, provides due-date alerts, and enables 1-click auto-logging.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class RecurringManager {
  constructor() {}

  getDueStatus(nextDueDateStr) {
    if (!nextDueDateStr) return { label: 'Upcoming', class: 'badge-secondary', daysDiff: 99 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(nextDueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Overdue by ${Math.abs(diffDays)}d`, class: 'badge-rose', daysDiff: diffDays, urgent: true };
    } else if (diffDays === 0) {
      return { label: 'Due Today', class: 'badge-amber', daysDiff: 0, urgent: true };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays}d`, class: 'badge-amber', daysDiff: diffDays, urgent: true };
    } else {
      return { label: `Due in ${diffDays}d`, class: 'badge-secondary', daysDiff: diffDays, urgent: false };
    }
  }

  render() {
    this.renderDashboardBanner();
    this.renderRecurringPage();
  }

  // Urgent upcoming bills banner on Dashboard
  renderDashboardBanner() {
    const banner = document.getElementById('dashboardRecurringBanner');
    if (!banner) return;

    const bills = store.getState().recurringBills.filter(b => b.active);
    const upcoming = bills
      .map(b => ({ ...b, status: this.getDueStatus(b.nextDueDate) }))
      .filter(b => b.status.daysDiff <= 5)
      .sort((a, b) => a.status.daysDiff - b.status.daysDiff);

    if (upcoming.length === 0) {
      banner.classList.add('hidden');
      return;
    }

    banner.classList.remove('hidden');
    const firstBill = upcoming[0];
    const moreCount = upcoming.length - 1;

    banner.innerHTML = `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <i data-lucide="bell-ring" class="w-5 h-5 animate-pulse"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-foreground">
              Upcoming Bill: ${firstBill.name} (${store.formatCurrency(firstBill.amount)})
              <span class="badge ${firstBill.status.class} text-xs ml-2">${firstBill.status.label}</span>
            </div>
            <div class="text-xs text-muted">
              ${moreCount > 0 ? `+ ${moreCount} other upcoming bill(s) this week.` : 'Scheduled payment reminder.'}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-primary btn-xs" onclick="window.recurringManager.payBill('${firstBill.id}')">
            <i data-lucide="check" class="w-3.5 h-3.5 mr-1"></i> Pay Now
          </button>
          <button class="btn btn-ghost btn-xs text-xs" onclick="window.app.navigate('recurring')">
            View All
          </button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // Full Recurring Page
  renderRecurringPage() {
    const listContainer = document.getElementById('recurringBillsList');
    const summaryEl = document.getElementById('recurringSummaryStats');
    if (!listContainer) return;

    const bills = store.getState().recurringBills;
    let totalMonthlyCost = 0;
    let activeCount = 0;

    bills.forEach(b => {
      if (b.active) {
        activeCount++;
        if (b.frequency === 'yearly') totalMonthlyCost += b.amount / 12;
        else if (b.frequency === 'weekly') totalMonthlyCost += b.amount * 4.33;
        else totalMonthlyCost += b.amount;
      }
    });

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-icon bg-indigo-500/15 text-indigo-400">
            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Total Monthly Subscriptions</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(totalMonthlyCost)}</div>
            <div class="text-xs text-muted mt-1">${activeCount} Active Recurring Items</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon bg-emerald-500/15 text-emerald-400">
            <i data-lucide="calendar" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Annual Projected Cost</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(totalMonthlyCost * 12)}</div>
            <div class="text-xs text-muted mt-1">Fixed yearly outflow</div>
          </div>
        </div>
      `;
    }

    if (bills.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-12 empty-state">
          <i data-lucide="repeat" class="w-12 h-12 text-muted mx-auto mb-3 opacity-40"></i>
          <h3 class="text-base font-semibold text-foreground">No recurring subscriptions added</h3>
          <p class="text-sm text-muted mt-1">Keep track of your monthly Netflix, Rent, Gym, and SaaS subscriptions.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="window.app.openRecurringModal()">
            <i data-lucide="plus" class="w-4 h-4 mr-1"></i> Add Subscription / Bill
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Sort by due date
    const sortedBills = [...bills].sort((a, b) => {
      const statA = this.getDueStatus(a.nextDueDate);
      const statB = this.getDueStatus(b.nextDueDate);
      return statA.daysDiff - statB.daysDiff;
    });

    let html = '';
    sortedBills.forEach(b => {
      const cat = store.getCategoryById(b.categoryId);
      const acc = store.getAccountById(b.accountId);
      const status = this.getDueStatus(b.nextDueDate);

      html += `
        <div class="recurring-item-card p-4 rounded-2xl bg-surface border border-border hover:border-primary/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${cat.color}20; color: ${cat.color}">
              <i data-lucide="${cat.icon || 'repeat'}" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-foreground text-base">${b.name}</h4>
                <span class="badge ${status.class} text-xs font-semibold">${status.label}</span>
                ${!b.active ? `<span class="badge badge-secondary text-xs">Paused</span>` : ''}
              </div>
              <div class="text-xs text-muted flex items-center gap-2 mt-1">
                <span>${b.frequency.toUpperCase()}</span>
                <span>•</span>
                <span>Next: <strong>${b.nextDueDate || 'N/A'}</strong></span>
                <span>•</span>
                <span>Debits from: ${acc.name}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between md:justify-end gap-4">
            <div class="text-right">
              <div class="text-lg font-bold text-foreground">${store.formatCurrency(b.amount)}</div>
              <div class="text-xs text-muted">${b.provider || cat.name}</div>
            </div>

            <div class="flex items-center gap-2">
              <button class="btn btn-primary btn-sm" title="Mark as Paid & Record Expense" onclick="window.recurringManager.payBill('${b.id}')">
                <i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> Pay & Log
              </button>
              <button class="icon-btn-sm" title="Edit" onclick="window.app.openRecurringModal('${b.id}')">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
              <button class="icon-btn-sm text-rose-500 hover:bg-rose-500/10" title="Delete" onclick="window.recurringManager.deleteBill('${b.id}')">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  payBill(id) {
    const tx = store.payRecurringBill(id);
    if (tx) {
      audio.playSuccess();
      window.app.showToast(`Logged payment: ${tx.description} (${store.formatCurrency(tx.amount)})`, 'success');
      this.render();
      window.app.refreshActiveViews();
    }
  }

  deleteBill(id) {
    if (confirm('Are you sure you want to remove this recurring bill?')) {
      store.deleteRecurringBill(id);
      audio.playDelete();
      window.app.showToast('Recurring bill removed', 'info');
      this.render();
    }
  }
}

export const recurringManager = new RecurringManager();
window.recurringManager = recurringManager;
