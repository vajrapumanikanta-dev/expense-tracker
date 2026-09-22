/**
 * Savings Goals & Financial Discipline Manager
 * Tracks savings targets, milestones, celebrations, and gamified financial discipline streaks.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class GoalsManager {
  constructor() {}

  render() {
    this.renderGoalsPage();
  }

  // Confetti burst for goal achievements
  fireConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  renderGoalsPage() {
    const grid = document.getElementById('goalsGrid');
    const disciplineEl = document.getElementById('financialDisciplineWidget');
    if (!grid) return;

    const state = store.getState();
    const goals = state.goals;

    // Financial Discipline Streaks & Badges
    if (disciplineEl) {
      disciplineEl.innerHTML = `
        <div class="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-background border border-indigo-500/30 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/20">
              🔥
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-foreground">14-Day Financial Discipline Streak!</h3>
                <span class="badge badge-amber text-xs font-bold">VIP Saver</span>
              </div>
              <p class="text-sm text-muted mt-0.5">You have consistently logged transactions and stayed within 85% of budget limits.</p>
            </div>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
              <span class="text-lg">🛡️</span>
              <div>
                <div class="text-xs font-bold text-foreground">Emergency Net</div>
                <div class="text-[10px] text-emerald-400 font-semibold">78% Funded</div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
              <span class="text-lg">🎯</span>
              <div>
                <div class="text-xs font-bold text-foreground">Goal Master</div>
                <div class="text-[10px] text-indigo-400 font-semibold">3 Active Goals</div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
              <span class="text-lg">⚡</span>
              <div>
                <div class="text-xs font-bold text-foreground">Daily Reviewer</div>
                <div class="text-[10px] text-amber-400 font-semibold">Top 5% Habit</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (goals.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 empty-state">
          <i data-lucide="target" class="w-12 h-12 text-muted mx-auto mb-3 opacity-40"></i>
          <h3 class="text-base font-semibold text-foreground">No savings goals created</h3>
          <p class="text-sm text-muted mt-1">Set a goal for an emergency fund, dream vacation, or new tech purchase.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="window.app.openGoalModal()">
            <i data-lucide="plus" class="w-4 h-4 mr-1"></i> Create Savings Goal
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    goals.forEach(g => {
      const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
      const isCompleted = g.currentAmount >= g.targetAmount;
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);

      cardsHtml += `
        <div class="goal-card p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 transition flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${g.color || '#6366F1'}20; color: ${g.color || '#6366F1'}">
                  <i data-lucide="${g.icon || 'target'}" class="w-6 h-6"></i>
                </div>
                <div>
                  <span class="badge badge-secondary text-xs uppercase font-semibold">${g.category || 'Goal'}</span>
                  <h4 class="font-bold text-foreground text-base mt-0.5">${g.name}</h4>
                </div>
              </div>
              ${isCompleted ? `<span class="badge badge-emerald text-xs font-bold">🎉 Achieved!</span>` : `<span class="badge badge-indigo text-xs font-bold">${pct}%</span>`}
            </div>

            <div class="my-4 space-y-2">
              <div class="flex justify-between items-baseline">
                <span class="text-2xl font-black text-foreground">${store.formatCurrency(g.currentAmount)}</span>
                <span class="text-xs text-muted">Target: ${store.formatCurrency(g.targetAmount)}</span>
              </div>

              <div class="progress-bar-bg h-3.5">
                <div class="progress-bar-fill transition-all duration-700" style="width: ${pct}%; background-color: ${isCompleted ? '#10B981' : (g.color || '#6366F1')}"></div>
              </div>

              <div class="flex justify-between text-xs text-muted pt-1">
                <span>${remaining > 0 ? `${store.formatCurrency(remaining)} to go` : 'Target reached!'}</span>
                <span>Target Date: ${g.targetDate || 'No date'}</span>
              </div>

              ${g.notes ? `<p class="text-xs text-muted bg-surface-elevated p-2.5 rounded-lg border border-border/40 mt-3">${g.notes}</p>` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
            <button class="btn btn-primary btn-sm" onclick="window.app.openContributeModal('${g.id}')">
              <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Add Funds
            </button>

            <div class="flex items-center gap-1">
              <button class="icon-btn-sm" title="Edit" onclick="window.app.openGoalModal('${g.id}')">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
              <button class="icon-btn-sm text-rose-500 hover:bg-rose-500/10" title="Delete" onclick="window.goalsManager.deleteGoal('${g.id}')">
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

  deleteGoal(id) {
    if (confirm('Are you sure you want to delete this savings goal?')) {
      store.deleteGoal(id);
      audio.playDelete();
      window.app.showToast('Goal deleted', 'info');
      this.render();
    }
  }

  contribute(goalId, amount, fromAccountId) {
    const goal = store.contributeToGoal(goalId, amount, fromAccountId);
    if (goal) {
      audio.playSuccess();
      if (goal.currentAmount >= goal.targetAmount) {
        this.fireConfetti();
        window.app.showToast(`🏆 Congratulations! You've achieved your goal: ${goal.name}!`, 'success');
      } else {
        window.app.showToast(`Added ${store.formatCurrency(amount)} to ${goal.name}`, 'success');
      }
      this.render();
      window.app.refreshActiveViews();
    }
  }
}

export const goalsManager = new GoalsManager();
window.goalsManager = goalsManager;
