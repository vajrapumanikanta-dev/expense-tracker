/**
 * Central State Store for Expense Tracker
 * Handles local storage persistence, multi-user isolation, system audit logging,
 * platform-wide admin aggregations, and reactive state subscriptions.
 */

import { auth } from './auth.js';

const STORAGE_PREFIX = 'vault_expense_user_data_';
const AUDIT_LOGS_KEY = 'vault_system_audit_logs_v1';
const GLOBAL_CATEGORIES_KEY = 'vault_global_categories_v1';

// Available currencies
export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar (USD)', locale: 'en-US', rate: 1.0 },
  EUR: { symbol: '€', name: 'Euro (EUR)', locale: 'de-DE', rate: 0.92 },
  GBP: { symbol: '£', name: 'British Pound (GBP)', locale: 'en-GB', rate: 0.79 },
  INR: { symbol: '₹', name: 'Indian Rupee (INR)', locale: 'en-IN', rate: 83.5 },
  JPY: { symbol: '¥', name: 'Japanese Yen (JPY)', locale: 'ja-JP', rate: 155.0 },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar (CAD)', locale: 'en-CA', rate: 1.37 },
  AUD: { symbol: 'AU$', name: 'Australian Dollar (AUD)', locale: 'en-AU', rate: 1.52 }
};

// Default Global Categories
export const DEFAULT_CATEGORIES = [
  { id: 'cat_housing', name: 'Housing & Rent', icon: 'home', color: '#6366F1', type: 'expense' },
  { id: 'cat_food', name: 'Food & Dining', icon: 'utensils', color: '#F59E0B', type: 'expense' },
  { id: 'cat_groceries', name: 'Groceries', icon: 'shopping-cart', color: '#10B981', type: 'expense' },
  { id: 'cat_transport', name: 'Transportation', icon: 'car', color: '#3B82F6', type: 'expense' },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'zap', color: '#EC4899', type: 'expense' },
  { id: 'cat_entertainment', name: 'Entertainment & Leisure', icon: 'film', color: '#8B5CF6', type: 'expense' },
  { id: 'cat_health', name: 'Healthcare & Fitness', icon: 'activity', color: '#EF4444', type: 'expense' },
  { id: 'cat_shopping', name: 'Shopping & Electronics', icon: 'shopping-bag', color: '#F97316', type: 'expense' },
  { id: 'cat_education', name: 'Education & Courses', icon: 'book-open', color: '#14B8A6', type: 'expense' },
  { id: 'cat_personal', name: 'Personal Care', icon: 'smile', color: '#D946EF', type: 'expense' },
  { id: 'cat_salary', name: 'Salary & Wages', icon: 'briefcase', color: '#10B981', type: 'income' },
  { id: 'cat_freelance', name: 'Freelance & Consulting', icon: 'laptop', color: '#06B6D4', type: 'income' },
  { id: 'cat_investment', name: 'Investments & Dividends', icon: 'trending-up', color: '#84CC16', type: 'income' },
  { id: 'cat_other_income', name: 'Other Income', icon: 'plus-circle', color: '#22C55E', type: 'income' },
  { id: 'cat_transfer', name: 'Account Transfer', icon: 'arrow-left-right', color: '#64748B', type: 'transfer' }
];

// Helper to generate IDs
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate realistic initial seed data for demo accounts
function generateSeedData(currency = 'INR') {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const getDateStr = (dayOffset) => {
    const d = new Date(year, month, today.getDate() - dayOffset);
    return d.toISOString().split('T')[0];
  };

  const accounts = [
    {
      id: 'acc_checking',
      name: 'Main Salary Account (HDFC)',
      type: 'checking',
      balance: 45850.50,
      currency: currency,
      color: '#3B82F6',
      icon: 'landmark',
      accountNumber: '•••• 4821',
      institution: 'HDFC Bank'
    },
    {
      id: 'acc_savings',
      name: 'High-Yield Savings (SBI)',
      type: 'savings',
      balance: 184200.00,
      currency: currency,
      color: '#10B981',
      icon: 'piggy-bank',
      accountNumber: '•••• 9104',
      institution: 'State Bank of India'
    },
    {
      id: 'acc_credit',
      name: 'Sapphiro Premium Credit Card',
      type: 'credit',
      balance: -14780.40, // amount owed
      limit: 150000.00,
      currency: currency,
      color: '#F43F5E',
      icon: 'credit-card',
      accountNumber: '•••• 6032',
      institution: 'ICICI Bank'
    },
    {
      id: 'acc_cash',
      name: 'Cash Wallet',
      type: 'cash',
      balance: 3450.00,
      currency: currency,
      color: '#F59E0B',
      icon: 'wallet',
      accountNumber: 'Cash',
      institution: 'Physical Wallet'
    },
    {
      id: 'acc_crypto',
      name: 'Zerodha Mutual Funds & Stocks',
      type: 'investment',
      balance: 86500.00,
      currency: currency,
      color: '#8B5CF6',
      icon: 'coins',
      accountNumber: 'Demat Portfolio',
      institution: 'Zerodha Broking'
    }
  ];

  const transactions = [
    {
      id: generateId('tx'),
      date: getDateStr(0),
      description: 'Supermarket Grocery Run',
      amount: 3850.00,
      type: 'expense',
      categoryId: 'cat_groceries',
      accountId: 'acc_checking',
      merchant: 'Reliance Smart Supermarket',
      notes: 'Weekly pantry restocking & fresh organic produce',
      tags: ['groceries', 'household'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(1),
      description: 'Monthly Tech Salary',
      amount: 68500.00,
      type: 'income',
      categoryId: 'cat_salary',
      accountId: 'acc_checking',
      merchant: 'TechCorp India Pvt Ltd',
      notes: 'Monthly direct deposit salary credit',
      tags: ['salary', 'direct-deposit'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(2),
      description: 'Dinner with Colleagues',
      amount: 1650.00,
      type: 'expense',
      categoryId: 'cat_food',
      accountId: 'acc_credit',
      merchant: 'Barbeque Nation Grill',
      notes: 'Friday team dinner & buffet',
      tags: ['dining', 'social'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(3),
      description: 'Apartment Monthly Rent',
      amount: 18000.00,
      type: 'expense',
      categoryId: 'cat_housing',
      accountId: 'acc_checking',
      merchant: 'Skyline Luxury Residences',
      notes: 'Monthly apartment rent transfer',
      tags: ['rent', 'fixed'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(4),
      description: 'Full Tank Petrol & Fastag Tolls',
      amount: 2400.00,
      type: 'expense',
      categoryId: 'cat_transport',
      accountId: 'acc_credit',
      merchant: 'Indian Oil & Fastag Highway',
      notes: 'Fuel refill & expressway toll pass',
      tags: ['transport', 'commute'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(5),
      description: 'Cloud Infrastructure Consulting',
      amount: 24500.00,
      type: 'income',
      categoryId: 'cat_freelance',
      accountId: 'acc_checking',
      merchant: 'Fintech Startup Bangalore',
      notes: 'Microservices architecture milestone 2',
      tags: ['freelance', 'consulting'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(6),
      description: 'Fiber Broadband & 5G Mobile Plan',
      amount: 1499.00,
      type: 'expense',
      categoryId: 'cat_utilities',
      accountId: 'acc_checking',
      merchant: 'Airtel Xstream Fiber',
      notes: 'High-speed gigabit fiber & postpaid mobile',
      tags: ['utilities', 'internet'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(7),
      description: 'Routine Health & Dental Checkup',
      amount: 1850.00,
      type: 'expense',
      categoryId: 'cat_health',
      accountId: 'acc_credit',
      merchant: 'Apollo Clinic & Diagnostics',
      notes: 'Routine 6-month checkup & dental cleaning',
      tags: ['health', 'medical'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(9),
      description: 'Mechanical Keyboard & Monitor Arm',
      amount: 4999.00,
      type: 'expense',
      categoryId: 'cat_shopping',
      accountId: 'acc_credit',
      merchant: 'Keychron India Online',
      notes: 'Home office ergonomic setup',
      tags: ['gadgets', 'work-from-home'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(11),
      description: 'PVR IMAX Movie Night',
      amount: 1250.00,
      type: 'expense',
      categoryId: 'cat_entertainment',
      accountId: 'acc_credit',
      merchant: 'PVR Inox Cinemas',
      notes: 'Weekend sci-fi screening with snacks',
      tags: ['movies', 'fun'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(12),
      description: 'Transfer to Emergency Fund',
      amount: 10000.00,
      type: 'transfer',
      categoryId: 'cat_transfer',
      accountId: 'acc_checking',
      toAccountId: 'acc_savings',
      merchant: 'Internal Bank Transfer',
      notes: 'Automated monthly savings allocation',
      tags: ['savings', 'transfer'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(14),
      description: 'Filter Coffee & Breakfast',
      amount: 320.00,
      type: 'expense',
      categoryId: 'cat_food',
      accountId: 'acc_cash',
      merchant: 'Third Wave Coffee Roasters',
      notes: 'Morning coffee meeting with mentor',
      tags: ['coffee', 'casual'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(16),
      description: 'Quarterly Mutual Fund Dividend',
      amount: 3450.00,
      type: 'income',
      categoryId: 'cat_investment',
      accountId: 'acc_savings',
      merchant: 'Nifty 50 Index Fund ETF',
      notes: 'Quarterly dividend distribution',
      tags: ['dividends', 'passive'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(18),
      description: 'Electric & Utility Bill',
      amount: 1850.00,
      type: 'expense',
      categoryId: 'cat_utilities',
      accountId: 'acc_checking',
      merchant: 'State Electricity Board',
      notes: 'Monthly power consumption bill',
      tags: ['utilities', 'electricity'],
      receiptUrl: null
    },
    {
      id: generateId('tx'),
      date: getDateStr(20),
      description: 'System Design Masterclass',
      amount: 2499.00,
      type: 'expense',
      categoryId: 'cat_education',
      accountId: 'acc_checking',
      merchant: 'Coursera / Scaler Academy',
      notes: 'Distributed Systems Certification',
      tags: ['education', 'learning'],
      receiptUrl: null
    }
  ];

  const budgets = [
    {
      id: 'bud_food',
      categoryId: 'cat_food',
      limit: 6500.00,
      period: 'monthly',
      alertThreshold: 85
    },
    {
      id: 'bud_groceries',
      categoryId: 'cat_groceries',
      limit: 8500.00,
      period: 'monthly',
      alertThreshold: 80
    },
    {
      id: 'bud_housing',
      categoryId: 'cat_housing',
      limit: 22000.00,
      period: 'monthly',
      alertThreshold: 95
    },
    {
      id: 'bud_transport',
      categoryId: 'cat_transport',
      limit: 6000.00,
      period: 'monthly',
      alertThreshold: 80
    },
    {
      id: 'bud_entertainment',
      categoryId: 'cat_entertainment',
      limit: 4000.00,
      period: 'monthly',
      alertThreshold: 75
    },
    {
      id: 'bud_shopping',
      categoryId: 'cat_shopping',
      limit: 8000.00,
      period: 'monthly',
      alertThreshold: 80
    }
  ];

  const recurringBills = [
    {
      id: 'rec_netflix',
      name: 'Netflix Premium 4K UHD',
      amount: 649.00,
      categoryId: 'cat_entertainment',
      accountId: 'acc_credit',
      frequency: 'monthly',
      dueDay: 15,
      nextDueDate: `${year}-${String(month + 1).padStart(2, '0')}-15`,
      autoLog: false,
      active: true,
      provider: 'Netflix India'
    },
    {
      id: 'rec_spotify',
      name: 'Spotify Premium Individual',
      amount: 119.00,
      categoryId: 'cat_entertainment',
      accountId: 'acc_credit',
      frequency: 'monthly',
      dueDay: 28,
      nextDueDate: `${year}-${String(month + 1).padStart(2, '0')}-28`,
      autoLog: true,
      active: true,
      provider: 'Spotify'
    },
    {
      id: 'rec_internet',
      name: 'Airtel Xstream Fiber Gigabit',
      amount: 999.00,
      categoryId: 'cat_utilities',
      accountId: 'acc_checking',
      frequency: 'monthly',
      dueDay: 10,
      nextDueDate: `${year}-${String(month + 1).padStart(2, '0')}-10`,
      autoLog: false,
      active: true,
      provider: 'Airtel'
    },
    {
      id: 'rec_gym',
      name: 'Cult.fit Gym & Fitness Pass',
      amount: 1500.00,
      categoryId: 'cat_health',
      accountId: 'acc_credit',
      frequency: 'monthly',
      dueDay: 5,
      nextDueDate: `${year}-${String(month + 1).padStart(2, '0')}-05`,
      autoLog: false,
      active: true,
      provider: 'Cult.fit'
    }
  ];

  const goals = [
    {
      id: 'goal_emergency',
      name: '6-Month Emergency Safety Net',
      targetAmount: 200000.00,
      currentAmount: 145000.00,
      targetDate: `${year + 1}-03-31`,
      category: 'Security',
      color: '#10B981',
      icon: 'shield-check',
      notes: 'Covers essential living expenses for 6 months'
    },
    {
      id: 'goal_japan_trip',
      name: 'Tokyo & Kyoto Spring Tour',
      targetAmount: 150000.00,
      currentAmount: 85000.00,
      targetDate: `${year + 1}-04-15`,
      category: 'Travel',
      color: '#F59E0B',
      icon: 'plane',
      notes: 'Flight, traditional ryokans & cultural exploration'
    },
    {
      id: 'goal_macbook',
      name: 'MacBook Pro M3 Max Upgrade',
      targetAmount: 95000.00,
      currentAmount: 62000.00,
      targetDate: `${year}-11-30`,
      category: 'Tech',
      color: '#6366F1',
      icon: 'laptop',
      notes: 'High performance development workstation update'
    }
  ];

  const preferences = {
    currency: currency || 'INR',
    theme: 'dark',
    soundEnabled: true,
    hapticsEnabled: true,
    compactView: false,
    streakCount: 14,
    lastActiveDate: today.toISOString().split('T')[0]
  };

  return {
    accounts,
    transactions,
    categories: DEFAULT_CATEGORIES,
    budgets,
    recurringBills,
    goals,
    preferences
  };
}

class Store {
  constructor() {
    this.currentUserId = auth.getCurrentUser()?.id || 'usr_demo_002';
    this.listeners = new Set();
    this.state = this.loadState();
    this.initAuditLogs();

    // Listen to auth changes to switch user storage automatically
    auth.subscribe((event, data, user) => {
      if (['login_success', 'signup_success'].includes(event) && user) {
        this.setUserContext(user.id, user.currency || 'INR');
      } else if (event === 'logout_success') {
        this.setUserContext('usr_demo_002', 'INR');
      }
    });
  }

  // Switch active user data bucket
  setUserContext(userId, currency = 'INR') {
    this.currentUserId = userId;
    this.state = this.loadState(userId, currency);
    this.notify('user_context_switched', { userId });
  }

  getStorageKey(userId = this.currentUserId) {
    return `${STORAGE_PREFIX}${userId}`;
  }

  loadState(userId = this.currentUserId, preferredCurrency = 'INR') {
    const key = this.getStorageKey(userId);
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.categories || parsed.categories.length === 0) {
          parsed.categories = this.getGlobalCategories();
        }
        return parsed;
      }
    } catch (e) {
      console.warn(`Failed to load stored state for ${userId}:`, e);
    }
    const seed = generateSeedData(preferredCurrency);
    seed.categories = this.getGlobalCategories();
    this.saveState(seed, userId);
    return seed;
  }

  saveState(stateToSave = this.state, userId = this.currentUserId) {
    const key = this.getStorageKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Error writing state to localStorage:', e);
    }
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(eventType, payload) {
    this.saveState();
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, eventType, payload);
      } catch (err) {
        console.error('Error in state subscriber:', err);
      }
    });
  }

  // ==================== GLOBAL CATEGORIES ====================
  getGlobalCategories() {
    try {
      const data = localStorage.getItem(GLOBAL_CATEGORIES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    this.saveGlobalCategories(DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }

  saveGlobalCategories(categories) {
    try {
      localStorage.setItem(GLOBAL_CATEGORIES_KEY, JSON.stringify(categories));
    } catch (e) {
      console.error('Failed to save global categories:', e);
    }
  }

  addGlobalCategory(category) {
    const categories = this.getGlobalCategories();
    const newCat = {
      ...category,
      id: category.id || `cat_${Date.now()}`
    };
    categories.push(newCat);
    this.saveGlobalCategories(categories);
    this.state.categories = categories;
    this.notify('category_added', newCat);
    this.addAuditLog('ADD_CATEGORY', `Created global category "${newCat.name}"`, auth.getCurrentUser()?.name || 'Admin', 'SUCCESS');
    return newCat;
  }

  updateGlobalCategory(id, updates) {
    const categories = this.getGlobalCategories();
    const idx = categories.findIndex(c => c.id === id);
    if (idx === -1) return null;
    categories[idx] = { ...categories[idx], ...updates };
    this.saveGlobalCategories(categories);
    this.state.categories = categories;
    this.notify('category_updated', categories[idx]);
    this.addAuditLog('UPDATE_CATEGORY', `Updated global category "${categories[idx].name}"`, auth.getCurrentUser()?.name || 'Admin', 'SUCCESS');
    return categories[idx];
  }

  deleteGlobalCategory(id) {
    let categories = this.getGlobalCategories();
    const cat = categories.find(c => c.id === id);
    categories = categories.filter(c => c.id !== id);
    this.saveGlobalCategories(categories);
    this.state.categories = categories;
    this.notify('category_deleted', { id });
    this.addAuditLog('DELETE_CATEGORY', `Deleted global category "${cat?.name || id}"`, auth.getCurrentUser()?.name || 'Admin', 'WARNING');
    return true;
  }

  // ==================== SYSTEM AUDIT LOGS ====================
  initAuditLogs() {
    try {
      const logs = localStorage.getItem(AUDIT_LOGS_KEY);
      if (!logs) {
        const initialLogs = [
          {
            id: generateId('log'),
            timestamp: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
            action: 'SYSTEM_BOOT',
            details: 'VaultExpense Financial OS engine initialized with LocalStorage database',
            user: 'System',
            role: 'SYSTEM',
            status: 'SUCCESS',
            ip: '127.0.0.1'
          },
          {
            id: generateId('log'),
            timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
            action: 'ADMIN_LOGIN',
            details: 'Administrator logged into management console',
            user: 'System Administrator',
            role: 'ADMIN',
            status: 'SUCCESS',
            ip: '192.168.1.10'
          },
          {
            id: generateId('log'),
            timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
            action: 'USER_LOGIN',
            details: 'User Alex Morgan authenticated successfully',
            user: 'Alex Morgan',
            role: 'USER',
            status: 'SUCCESS',
            ip: '192.168.1.45'
          }
        ];
        localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(initialLogs));
      }
    } catch (e) {}
  }

  getAuditLogs() {
    try {
      const data = localStorage.getItem(AUDIT_LOGS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
  }

  addAuditLog(action, details, user = 'Current User', status = 'SUCCESS') {
    try {
      const logs = this.getAuditLogs();
      const newLog = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        action,
        details,
        user: user || auth.getCurrentUser()?.name || 'Guest',
        role: auth.getCurrentUser()?.role?.toUpperCase() || 'USER',
        status,
        ip: '127.0.0.1'
      };
      logs.unshift(newLog);
      // Keep last 150 logs
      if (logs.length > 150) logs.pop();
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
      return newLog;
    } catch (e) {
      console.error('Error logging audit event:', e);
    }
  }

  clearAuditLogs() {
    try {
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify([]));
      this.addAuditLog('CLEAR_LOGS', 'System audit trail purged by administrator', auth.getCurrentUser()?.name || 'Admin', 'WARNING');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ==================== PLATFORM ANALYTICS (ADMIN) ====================
  getPlatformAnalytics() {
    const allUsers = auth.getAllUsers();
    let totalPlatformTransactions = 0;
    let totalPlatformVolume = 0;
    let totalPlatformIncome = 0;
    let totalPlatformExpense = 0;
    let totalAccountsAcrossPlatform = 0;
    const categoryVolumeMap = {};

    allUsers.forEach(user => {
      try {
        const dataStr = localStorage.getItem(`${STORAGE_PREFIX}${user.id}`);
        if (dataStr) {
          const uState = JSON.parse(dataStr);
          if (uState.transactions) {
            totalPlatformTransactions += uState.transactions.length;
            uState.transactions.forEach(tx => {
              const amt = Number(tx.amount) || 0;
              totalPlatformVolume += amt;
              if (tx.type === 'income') totalPlatformIncome += amt;
              if (tx.type === 'expense') {
                totalPlatformExpense += amt;
                categoryVolumeMap[tx.categoryId] = (categoryVolumeMap[tx.categoryId] || 0) + amt;
              }
            });
          }
          if (uState.accounts) {
            totalAccountsAcrossPlatform += uState.accounts.length;
          }
        }
      } catch (e) {}
    });

    // Fallback if demo data is single store
    if (totalPlatformTransactions === 0) {
      totalPlatformTransactions = this.state.transactions.length;
      this.state.transactions.forEach(tx => {
        totalPlatformVolume += tx.amount;
        if (tx.type === 'income') totalPlatformIncome += tx.amount;
        if (tx.type === 'expense') {
          totalPlatformExpense += tx.amount;
          categoryVolumeMap[tx.categoryId] = (categoryVolumeMap[tx.categoryId] || 0) + tx.amount;
        }
      });
      totalAccountsAcrossPlatform = this.state.accounts.length;
    }

    return {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(u => u.status === 'active').length,
      suspendedUsers: allUsers.filter(u => u.status === 'suspended').length,
      totalTransactions: totalPlatformTransactions,
      totalVolume: totalPlatformVolume,
      totalIncome: totalPlatformIncome,
      totalExpense: totalPlatformExpense,
      totalAccounts: totalAccountsAcrossPlatform,
      categoryVolumeMap,
      users: allUsers
    };
  }

  // Currency formatting helper
  formatCurrency(amount, currencyCode = this.state?.preferences?.currency || 'INR') {
    const curr = CURRENCIES[currencyCode] || CURRENCIES.INR;
    const num = Number(amount) || 0;
    return `${curr.symbol}${num.toLocaleString(curr.locale || 'en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  // --- TRANSACTIONS ---
  addTransaction(tx) {
    const newTx = {
      ...tx,
      id: tx.id || generateId('tx'),
      amount: parseFloat(tx.amount) || 0,
      date: tx.date || new Date().toISOString().split('T')[0]
    };

    // Update account balances
    if (newTx.type === 'expense') {
      this.updateAccountBalance(newTx.accountId, -newTx.amount);
    } else if (newTx.type === 'income') {
      this.updateAccountBalance(newTx.accountId, newTx.amount);
    } else if (newTx.type === 'transfer') {
      this.updateAccountBalance(newTx.accountId, -newTx.amount);
      if (newTx.toAccountId) {
        this.updateAccountBalance(newTx.toAccountId, newTx.amount);
      }
    }

    this.state.transactions.unshift(newTx);
    this.notify('transaction_added', newTx);
    this.addAuditLog('ADD_TX', `Added ${newTx.type} "${newTx.description}" (${this.formatCurrency(newTx.amount)})`, auth.getCurrentUser()?.name, 'SUCCESS');
    return newTx;
  }

  updateTransaction(id, updatedFields) {
    const index = this.state.transactions.findIndex(t => t.id === id);
    if (index === -1) return null;

    const oldTx = this.state.transactions[index];
    // Revert old account balances
    if (oldTx.type === 'expense') {
      this.updateAccountBalance(oldTx.accountId, oldTx.amount);
    } else if (oldTx.type === 'income') {
      this.updateAccountBalance(oldTx.accountId, -oldTx.amount);
    } else if (oldTx.type === 'transfer') {
      this.updateAccountBalance(oldTx.accountId, oldTx.amount);
      if (oldTx.toAccountId) {
        this.updateAccountBalance(oldTx.toAccountId, -oldTx.amount);
      }
    }

    const merged = { ...oldTx, ...updatedFields, amount: parseFloat(updatedFields.amount || oldTx.amount) };

    // Apply new account balances
    if (merged.type === 'expense') {
      this.updateAccountBalance(merged.accountId, -merged.amount);
    } else if (merged.type === 'income') {
      this.updateAccountBalance(merged.accountId, merged.amount);
    } else if (merged.type === 'transfer') {
      this.updateAccountBalance(merged.accountId, -merged.amount);
      if (merged.toAccountId) {
        this.updateAccountBalance(merged.toAccountId, merged.amount);
      }
    }

    this.state.transactions[index] = merged;
    this.notify('transaction_updated', merged);
    this.addAuditLog('EDIT_TX', `Updated transaction "${merged.description}"`, auth.getCurrentUser()?.name, 'SUCCESS');
    return merged;
  }

  deleteTransaction(id) {
    const index = this.state.transactions.findIndex(t => t.id === id);
    if (index === -1) return false;

    const tx = this.state.transactions[index];
    // Revert account balance
    if (tx.type === 'expense') {
      this.updateAccountBalance(tx.accountId, tx.amount);
    } else if (tx.type === 'income') {
      this.updateAccountBalance(tx.accountId, -tx.amount);
    } else if (tx.type === 'transfer') {
      this.updateAccountBalance(tx.accountId, tx.amount);
      if (tx.toAccountId) {
        this.updateAccountBalance(tx.toAccountId, -tx.amount);
      }
    }

    this.state.transactions.splice(index, 1);
    this.notify('transaction_deleted', { id });
    this.addAuditLog('DELETE_TX', `Deleted transaction "${tx.description}" (${this.formatCurrency(tx.amount)})`, auth.getCurrentUser()?.name, 'WARNING');
    return true;
  }

  deleteMultipleTransactions(ids) {
    const idSet = new Set(ids);
    this.state.transactions = this.state.transactions.filter(tx => {
      if (idSet.has(tx.id)) {
        if (tx.type === 'expense') this.updateAccountBalance(tx.accountId, tx.amount);
        else if (tx.type === 'income') this.updateAccountBalance(tx.accountId, -tx.amount);
        else if (tx.type === 'transfer') {
          this.updateAccountBalance(tx.accountId, tx.amount);
          if (tx.toAccountId) this.updateAccountBalance(tx.toAccountId, -tx.amount);
        }
        return false;
      }
      return true;
    });
    this.notify('transactions_batch_deleted', ids);
    this.addAuditLog('BATCH_DELETE_TX', `Batch deleted ${ids.length} transactions`, auth.getCurrentUser()?.name, 'WARNING');
  }

  // --- ACCOUNTS ---
  updateAccountBalance(accountId, delta) {
    const acc = this.state.accounts.find(a => a.id === accountId);
    if (acc) {
      acc.balance = Math.round((acc.balance + delta) * 100) / 100;
    }
  }

  addAccount(account) {
    const newAcc = {
      ...account,
      id: account.id || generateId('acc'),
      balance: parseFloat(account.balance) || 0,
      limit: account.type === 'credit' ? parseFloat(account.limit) || 0 : undefined
    };
    this.state.accounts.push(newAcc);
    this.notify('account_added', newAcc);
    this.addAuditLog('ADD_ACCOUNT', `Created account "${newAcc.name}" (${newAcc.type})`, auth.getCurrentUser()?.name, 'SUCCESS');
    return newAcc;
  }

  updateAccount(id, updatedFields) {
    const acc = this.state.accounts.find(a => a.id === id);
    if (!acc) return null;
    Object.assign(acc, updatedFields);
    if (acc.balance !== undefined) acc.balance = parseFloat(acc.balance);
    if (acc.limit !== undefined) acc.limit = parseFloat(acc.limit);
    this.notify('account_updated', acc);
    return acc;
  }

  deleteAccount(id) {
    const index = this.state.accounts.findIndex(a => a.id === id);
    if (index === -1) return false;
    const acc = this.state.accounts[index];
    this.state.accounts.splice(index, 1);
    this.notify('account_deleted', { id });
    this.addAuditLog('DELETE_ACCOUNT', `Removed financial account "${acc.name}"`, auth.getCurrentUser()?.name, 'WARNING');
    return true;
  }

  // --- BUDGETS ---
  setBudget(budget) {
    const existingIndex = this.state.budgets.findIndex(b => b.categoryId === budget.categoryId);
    const updated = {
      id: budget.id || generateId('bud'),
      categoryId: budget.categoryId,
      limit: parseFloat(budget.limit) || 0,
      period: budget.period || 'monthly',
      alertThreshold: parseInt(budget.alertThreshold, 10) || 80
    };

    if (existingIndex >= 0) {
      this.state.budgets[existingIndex] = updated;
    } else {
      this.state.budgets.push(updated);
    }
    this.notify('budget_updated', updated);
    return updated;
  }

  deleteBudget(categoryId) {
    this.state.budgets = this.state.budgets.filter(b => b.categoryId !== categoryId);
    this.notify('budget_deleted', { categoryId });
  }

  // --- RECURRING BILLS ---
  addRecurringBill(bill) {
    const newBill = {
      ...bill,
      id: bill.id || generateId('rec'),
      amount: parseFloat(bill.amount) || 0,
      active: bill.active !== undefined ? bill.active : true
    };
    this.state.recurringBills.push(newBill);
    this.notify('recurring_added', newBill);
    return newBill;
  }

  updateRecurringBill(id, fields) {
    const bill = this.state.recurringBills.find(r => r.id === id);
    if (!bill) return null;
    Object.assign(bill, fields);
    if (bill.amount) bill.amount = parseFloat(bill.amount);
    this.notify('recurring_updated', bill);
    return bill;
  }

  deleteRecurringBill(id) {
    this.state.recurringBills = this.state.recurringBills.filter(r => r.id !== id);
    this.notify('recurring_deleted', { id });
  }

  // Log recurring bill as a completed transaction & bump next due date
  payRecurringBill(id) {
    const bill = this.state.recurringBills.find(r => r.id === id);
    if (!bill) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const tx = this.addTransaction({
      description: bill.name,
      amount: bill.amount,
      type: 'expense',
      categoryId: bill.categoryId,
      accountId: bill.accountId,
      merchant: bill.provider || bill.name,
      notes: `Auto-recorded recurring payment (${bill.frequency})`,
      tags: ['recurring', 'bill', bill.frequency]
    });

    // Advance next due date by 1 month or 1 week
    const currentDue = new Date(bill.nextDueDate || todayStr);
    if (bill.frequency === 'weekly') {
      currentDue.setDate(currentDue.getDate() + 7);
    } else if (bill.frequency === 'yearly') {
      currentDue.setFullYear(currentDue.getFullYear() + 1);
    } else {
      currentDue.setMonth(currentDue.getMonth() + 1);
    }
    bill.nextDueDate = currentDue.toISOString().split('T')[0];

    this.notify('recurring_paid', { bill, tx });
    return tx;
  }

  // --- SAVINGS GOALS ---
  addGoal(goal) {
    const newGoal = {
      ...goal,
      id: goal.id || generateId('goal'),
      targetAmount: parseFloat(goal.targetAmount) || 0,
      currentAmount: parseFloat(goal.currentAmount) || 0
    };
    this.state.goals.push(newGoal);
    this.notify('goal_added', newGoal);
    return newGoal;
  }

  updateGoal(id, fields) {
    const goal = this.state.goals.find(g => g.id === id);
    if (!goal) return null;
    Object.assign(goal, fields);
    if (goal.targetAmount) goal.targetAmount = parseFloat(goal.targetAmount);
    if (goal.currentAmount) goal.currentAmount = parseFloat(goal.currentAmount);
    this.notify('goal_updated', goal);
    return goal;
  }

  deleteGoal(id) {
    this.state.goals = this.state.goals.filter(g => g.id !== id);
    this.notify('goal_deleted', { id });
  }

  contributeToGoal(goalId, amount, fromAccountId = null) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return null;
    const addAmt = parseFloat(amount) || 0;
    goal.currentAmount = Math.round((goal.currentAmount + addAmt) * 100) / 100;

    if (fromAccountId) {
      this.addTransaction({
        description: `Savings Goal: ${goal.name}`,
        amount: addAmt,
        type: 'transfer',
        categoryId: 'cat_transfer',
        accountId: fromAccountId,
        notes: `Contribution toward ${goal.name}`,
        tags: ['goal-savings', 'savings']
      });
    }

    this.notify('goal_contributed', { goal, amount: addAmt });
    return goal;
  }

  // --- PREFERENCES & SYSTEM ---
  setPreference(key, value) {
    this.state.preferences[key] = value;
    this.notify('preference_changed', { key, value });
  }

  resetToDemoData() {
    this.state = generateSeedData(this.state?.preferences?.currency || 'INR');
    this.saveState();
    this.notify('data_reset', this.state);
    this.addAuditLog('RESET_DEMO_DATA', 'Demo ledger restored to initial state', auth.getCurrentUser()?.name, 'INFO');
  }

  importState(importedState) {
    if (!importedState || !importedState.transactions || !importedState.accounts) {
      throw new Error('Invalid backup data format');
    }
    this.state = importedState;
    this.saveState();
    this.notify('data_imported', this.state);
    this.addAuditLog('IMPORT_DATA', 'Imported data ledger backup file', auth.getCurrentUser()?.name, 'INFO');
  }

  // --- CALCULATIONS & STATS ---
  getNetWorth() {
    return this.state.accounts.reduce((total, acc) => {
      return total + (acc.balance || 0);
    }, 0);
  }

  getCategoryById(id) {
    return this.state.categories.find(c => c.id === id) || {
      id: 'cat_unknown',
      name: 'Uncategorized',
      icon: 'help-circle',
      color: '#94A3B8',
      type: 'expense'
    };
  }

  getAccountById(id) {
    return this.state.accounts.find(a => a.id === id) || {
      id: 'acc_unknown',
      name: 'Unknown Account',
      balance: 0,
      icon: 'help-circle',
      color: '#94A3B8'
    };
  }

  getCurrentMonthStats() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let totalIncome = 0;
    let totalExpenses = 0;
    const categorySpendMap = {};

    this.state.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          totalExpenses += tx.amount;
          categorySpendMap[tx.categoryId] = (categorySpendMap[tx.categoryId] || 0) + tx.amount;
        }
      }
    });

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      categorySpendMap
    };
  }
}

export const store = new Store();
window.store = store;
