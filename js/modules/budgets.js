/**
 * Budgets & Predictive Alerts Manager
 * Calculates real-time spending versus monthly limits, burn rate projection, and alerts.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class BudgetManager {
  constructor() {}

  calculateBudgetsData() {
    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - currentDay);

    const overallBudget = state.budgets.find(b => b.categoryId === 'all') || {
      limit: 0,
      alertThreshold: 85
    };

    const categoryBudgets = state.budgets
      .filter(b => b.categoryId !== 'all')
      .map(b => {
        const cat = store.getCategoryById(b.categoryId);
        const spent = stats.categorySpendMap[b.categoryId] || 0;
        const percentage = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
        const remaining = b.limit - spent;
        const dailyBurnRate = currentDay > 0 ? spent / currentDay : 0;
        const projectedSpend = spent + (dailyBurnRate * daysRemaining);
        const isOver = spent > b.limit;
        const isWarning = percentage >= (b.alertThreshold || 80) && !isOver;

        return {
          ...b,
          category: cat,
          spent,
          remaining,
          percentage,
          projectedSpend,
          dailyBurnRate,
          isOver,
          isWarning
        };
      });

    // Overall metrics
    const totalBudgetSum = categoryBudgets.reduce((acc, b) => acc + b.limit, 0) || overallBudget.limit;
    const totalSpent = stats.totalExpenses;
    const overallPercentage = totalBudgetSum > 0 ? Math.round((totalSpent / totalBudgetSum) * 100) : 0;
    const overallRemaining = totalBudgetSum - totalSpent;
    const overallBurnRate = currentDay > 0 ? totalSpent / currentDay : 0;
    const overallProjected = totalSpent + (overallBurnRate * daysRemaining);

    return {
      categoryBudgets,
      overall: {
        limit: totalBudgetSum,
        spent: totalSpent,
        remaining: overallRemaining,
        percentage: overallPercentage,
        projected: overallProjected,
        isOver: totalSpent > totalBudgetSum,
        isWarning: overallPercentage >= 85 && totalSpent <= totalBudgetSum,
        daysRemaining,
        daysInMonth,
        currentDay
      }
    };
  }

  render() {
    this.renderDashboardBudgetWidget();
    this.renderBudgetsPage();
  }

  // Mini summary widget on Dashboard
  renderDashboardBudgetWidget() {
    const container = document.getElementById('dashboardBudgetWidget');
    if (!container) return;

    const data = this.calculateBudgetsData();
    const { overall, categoryBudgets } = data;

    let statusColor = 'emerald';
    let statusText = 'On Track';
    if (overall.isOver) {
      statusColor = 'rose';
      statusText = 'Over Budget!';
    } else if (overall.isWarning) {
      statusColor = 'amber';
      statusText = 'Approaching Limit';
    }

    let topBudgetsHtml = '';
    categoryBudgets.slice(0, 3).forEach(b => {
      const barColor = b.isOver ? '#F43F5E' : (b.isWarning ? '#F59E0B' : b.category.color);
      topBudgetsHtml += `
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="font-medium text-foreground flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" style="background-color: ${b.category.color}"></span>
              ${b.category.name}
            </span>
            <span class="text-muted font-medium">
              ${store.formatCurrency(b.spent)} / <span class="text-foreground">${store.formatCurrency(b.limit)}</span>
            </span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, b.percentage)}%; background-color: ${barColor}"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-semibold text-foreground">Monthly Budget Overview</h3>
          <p class="text-xs text-muted">${overall.daysRemaining} days remaining in month</p>
        </div>
        <span class="badge badge-${statusColor} text-xs font-semibold px-2.5 py-1">
          ${statusText}
        </span>
      </div>

      <div class="p-3.5 rounded-xl bg-surface-elevated border border-border/50 mb-4">
        <div class="flex justify-between items-baseline mb-2">
          <span class="text-xs text-muted">Total Spent</span>
          <span class="text-base font-bold text-foreground">${store.formatCurrency(overall.spent)} <span class="text-xs font-normal text-muted">of ${store.formatCurrency(overall.limit)}</span></span>
        </div>
        <div class="progress-bar-bg mb-2 h-2.5">
          <div class="progress-bar-fill transition-all duration-500" style="width: ${Math.min(100, overall.percentage)}%; background-color: ${overall.isOver ? '#F43F5E' : (overall.isWarning ? '#F59E0B' : '#10B981')}"></div>
        </div>
        <div class="flex justify-between text-xs text-muted">
          <span>${overall.percentage}% utilized</span>
          <span>${overall.remaining >= 0 ? store.formatCurrency(overall.remaining) + ' remaining' : store.formatCurrency(Math.abs(overall.remaining)) + ' over'}</span>
        </div>
      </div>

      <div class="space-y-3">
        ${topBudgetsHtml}
      </div>

      <div class="mt-4 pt-3 border-t border-border/40 text-center">
        <button class="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition flex items-center justify-center gap-1 w-full" onclick="window.app.navigate('budgets')">
          Manage All Budgets <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // Full Budgets Page
  renderBudgetsPage() {
    const cardsGrid = document.getElementById('budgetCardsGrid');
    const summaryCards = document.getElementById('budgetSummaryCards');
    if (!cardsGrid) return;

    const data = this.calculateBudgetsData();
    const { overall, categoryBudgets } = data;

    // Summary Top Cards
    if (summaryCards) {
      summaryCards.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-icon bg-indigo-500/15 text-indigo-400">
            <i data-lucide="wallet" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Total Monthly Budget</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(overall.limit)}</div>
            <div class="text-xs text-muted mt-1">${categoryBudgets.length} Active Categories</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon ${overall.isOver ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}">
            <i data-lucide="pie-chart" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Total Month Spent</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(overall.spent)}</div>
            <div class="text-xs ${overall.isOver ? 'text-rose-400' : 'text-emerald-400'} font-medium mt-1">
              ${overall.percentage}% of allocated budget
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon bg-amber-500/15 text-amber-400">
            <i data-lucide="trending-up" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">Projected Month-End</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${store.formatCurrency(overall.projected)}</div>
            <div class="text-xs text-muted mt-1">Based on daily velocity</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon ${overall.remaining >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
            <i data-lucide="${overall.remaining >= 0 ? 'shield-check' : 'alert-triangle'}" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs font-medium text-muted">${overall.remaining >= 0 ? 'Remaining Cushion' : 'Over Limit By'}</div>
            <div class="text-xl font-bold ${overall.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
              ${store.formatCurrency(Math.abs(overall.remaining))}
            </div>
            <div class="text-xs text-muted mt-1">${overall.daysRemaining} days left</div>
          </div>
        </div>
      `;
    }

    if (categoryBudgets.length === 0) {
      cardsGrid.innerHTML = `
        <div class="col-span-full text-center py-12 empty-state">
          <i data-lucide="target" class="w-12 h-12 text-muted mx-auto mb-3 opacity-40"></i>
          <h3 class="text-base font-semibold text-foreground">No category budgets defined</h3>
          <p class="text-sm text-muted mt-1">Set monthly limits to keep your spending disciplined.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="window.app.openBudgetModal()">
            <i data-lucide="plus" class="w-4 h-4 mr-1"></i> Add Category Budget
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    categoryBudgets.forEach(b => {
      const cat = b.category;
      const barColor = b.isOver ? '#F43F5E' : (b.isWarning ? '#F59E0B' : cat.color);
      const statusBadge = b.isOver 
        ? `<span class="badge badge-rose text-xs"><i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>Over limit</span>`
        : (b.isWarning 
          ? `<span class="badge badge-amber text-xs"><i data-lucide="alert-triangle" class="w-3 h-3 inline mr-1"></i>Near limit</span>`
          : `<span class="badge badge-emerald text-xs"><i data-lucide="check" class="w-3 h-3 inline mr-1"></i>Healthy</span>`);

      cardsHtml += `
        <div class="budget-card p-5 rounded-2xl bg-surface border border-border hover:border-primary/40 transition">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${cat.color}20; color: ${cat.color}">
                <i data-lucide="${cat.icon || 'tag'}" class="w-6 h-6"></i>
              </div>
              <div>
                <h4 class="font-semibold text-foreground">${cat.name}</h4>
                <div class="text-xs text-muted mt-0.5">Monthly allocation</div>
              </div>
            </div>
            ${statusBadge}
          </div>

          <div class="space-y-3 mb-4">
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-2xl font-bold text-foreground">${store.formatCurrency(b.spent)}</span>
                <span class="text-xs text-muted"> / ${store.formatCurrency(b.limit)}</span>
              </div>
              <span class="text-sm font-semibold" style="color: ${barColor}">
                ${b.percentage}%
              </span>
            </div>

            <div class="progress-bar-bg h-3">
              <div class="progress-bar-fill transition-all duration-500" style="width: ${Math.min(100, b.percentage)}%; background-color: ${barColor}"></div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
              <div>
                <span class="text-muted block">Remaining</span>
                <span class="font-semibold ${b.remaining < 0 ? 'text-rose-400' : 'text-foreground'}">
                  ${b.remaining < 0 ? '-' : ''}${store.formatCurrency(Math.abs(b.remaining))}
                </span>
              </div>
              <div class="text-right">
                <span class="text-muted block">Est. Month-End</span>
                <span class="font-semibold text-foreground">
                  ${store.formatCurrency(b.projectedSpend)}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
            <button class="btn btn-secondary btn-xs" onclick="window.app.openBudgetModal('${b.categoryId}')">
              <i data-lucide="edit-2" class="w-3.5 h-3.5 mr-1"></i> Edit Limit
            </button>
            <button class="btn btn-danger-subtle btn-xs" onclick="window.budgetManager.deleteBudget('${b.categoryId}')">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    });

    cardsGrid.innerHTML = cardsHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  deleteBudget(categoryId) {
    if (confirm('Are you sure you want to remove this category budget?')) {
      store.deleteBudget(categoryId);
      audio.playDelete();
      window.app.showToast('Budget removed', 'info');
      this.render();
    }
  }
}

export const budgetManager = new BudgetManager();
window.budgetManager = budgetManager;
