/**
 * Multi-Account & Net Worth Manager
 * Handles multiple wallets/accounts, credit limit utilization, and account-to-account transfers.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class AccountsManager {
  constructor() {}

  render() {
    this.renderDashboardAccounts();
    this.renderAccountsPage();
  }

  // Mini account balance cards on Dashboard
  renderDashboardAccounts() {
    const container = document.getElementById('dashboardAccountsList');
    if (!container) return;

    const accounts = store.getState().accounts;
    let html = '';

    accounts.forEach(acc => {
      const isCredit = acc.type === 'credit';
      const balanceClass = isCredit 
        ? (acc.balance < 0 ? 'text-rose-400' : 'text-foreground') 
        : 'text-foreground';

      html += `
        <div class="account-pill-card p-3 rounded-xl bg-surface-elevated border border-border/50 hover:border-primary/40 transition flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background-color: ${acc.color}20; color: ${acc.color}">
              <i data-lucide="${acc.icon || 'landmark'}" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="text-sm font-semibold text-foreground">${acc.name}</div>
              <div class="text-xs text-muted">${acc.institution || acc.accountNumber || 'Account'}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold ${balanceClass}">
              ${store.formatCurrency(acc.balance)}
            </div>
            ${isCredit && acc.limit ? `<div class="text-xs text-muted">Limit: ${store.formatCurrency(acc.limit)}</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // Full Accounts Page
  renderAccountsPage() {
    const grid = document.getElementById('accountsGrid');
    const summaryStats = document.getElementById('accountsSummaryStats');
    if (!grid) return;

    const accounts = store.getState().accounts;
    const netWorth = store.getNetWorth();

    let totalLiquidAssets = 0;
    let totalInvestments = 0;
    let totalLiabilities = 0;

    accounts.forEach(acc => {
      if (acc.type === 'credit') {
        if (acc.balance < 0) totalLiabilities += Math.abs(acc.balance);
      } else if (acc.type === 'investment') {
        totalInvestments += Math.max(0, acc.balance);
      } else {
        totalLiquidAssets += Math.max(0, acc.balance);
      }
    });

    if (summaryStats) {
      summaryStats.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-icon bg-emerald-500/15 text-emerald-400">
            <i data-lucide="shield-check" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Total Net Worth</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(netWorth)}</div>
            <div class="text-xs text-emerald-400 font-medium mt-1">Across ${accounts.length} linked accounts</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon bg-blue-500/15 text-blue-400">
            <i data-lucide="droplet" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Liquid Cash & Checking</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(totalLiquidAssets)}</div>
            <div class="text-xs text-muted mt-1">Immediately accessible</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon bg-purple-500/15 text-purple-400">
            <i data-lucide="trending-up" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Investments & Crypto</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(totalInvestments)}</div>
            <div class="text-xs text-muted mt-1">Long-term growth</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon bg-rose-500/15 text-rose-400">
            <i data-lucide="credit-card" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Total Credit Card Debt</div>
            <div class="text-xl font-bold text-rose-400 mt-0.5">${store.formatCurrency(totalLiabilities)}</div>
            <div class="text-xs text-muted mt-1">Current unpaid balance</div>
          </div>
        </div>
      `;
    }

    let cardsHtml = '';
    accounts.forEach(acc => {
      const isCredit = acc.type === 'credit';
      let creditUtilizationHtml = '';

      if (isCredit && acc.limit) {
        const debt = Math.abs(Math.min(0, acc.balance));
        const utilPct = Math.min(100, Math.round((debt / acc.limit) * 100));
        const utilColor = utilPct > 50 ? '#F43F5E' : (utilPct > 30 ? '#F59E0B' : '#10B981');

        creditUtilizationHtml = `
          <div class="mt-4 pt-3 border-t border-border/40 space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="text-muted">Credit Utilization</span>
              <span class="font-semibold" style="color: ${utilColor}">${utilPct}%</span>
            </div>
            <div class="progress-bar-bg h-2">
              <div class="progress-bar-fill" style="width: ${utilPct}%; background-color: ${utilColor}"></div>
            </div>
            <div class="flex justify-between text-xs text-muted">
              <span>Used: ${store.formatCurrency(debt)}</span>
              <span>Limit: ${store.formatCurrency(acc.limit)}</span>
            </div>
          </div>
        `;
      }

      cardsHtml += `
        <div class="account-card p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 transition relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>

          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${acc.color}20; color: ${acc.color}">
                <i data-lucide="${acc.icon || 'landmark'}" class="w-6 h-6"></i>
              </div>
              <div>
                <span class="badge badge-secondary text-xs uppercase tracking-wider font-semibold">${acc.type}</span>
                <h3 class="text-base font-bold text-foreground mt-1">${acc.name}</h3>
              </div>
            </div>
          </div>

          <div class="my-4">
            <div class="text-xs text-muted font-medium">Current Balance</div>
            <div class="text-2xl font-black ${isCredit && acc.balance < 0 ? 'text-rose-400' : 'text-foreground'} mt-1">
              ${store.formatCurrency(acc.balance)}
            </div>
            <div class="text-xs text-muted mt-1 flex items-center gap-2">
              <span>${acc.institution || ''}</span>
              <span>•</span>
              <span class="font-mono">${acc.accountNumber || ''}</span>
            </div>
          </div>

          ${creditUtilizationHtml}

          <div class="flex items-center justify-between pt-4 mt-4 border-t border-border/40">
            <button class="btn btn-secondary btn-xs" onclick="window.app.openTransferModal('${acc.id}')">
              <i data-lucide="arrow-left-right" class="w-3.5 h-3.5 mr-1"></i> Transfer
            </button>
            <div class="flex items-center gap-1">
              <button class="icon-btn-sm" title="Edit" onclick="window.app.openAccountModal('${acc.id}')">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
              <button class="icon-btn-sm text-rose-500 hover:bg-rose-500/10" title="Delete" onclick="window.accountsManager.deleteAccount('${acc.id}')">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = cardsHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  deleteAccount(id) {
    if (confirm('Are you sure you want to delete this account? (Associated transactions will remain in ledger).')) {
      store.deleteAccount(id);
      audio.playDelete();
      window.app.showToast('Account deleted', 'info');
      this.render();
    }
  }
}

export const accountsManager = new AccountsManager();
window.accountsManager = accountsManager;
