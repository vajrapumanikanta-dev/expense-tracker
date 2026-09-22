// =========================================================================
// VaultExpense - Unified Vanilla JavaScript Engine (No external build tools required)
// Runs natively via file:/// and http:// protocols
// =========================================================================

// ==================== SECTION: audio.js ====================
/**
 * Subtle Synthesized UI Audio Effects using Web Audio API
 * No external audio files required!
 */


class AudioManager {
  constructor() {
    this.ctx = null;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  isEnabled() {
    return store.getState().preferences.soundEnabled !== false;
  }

  // Soft subtle click sound
  playClick() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      // Audio not permitted yet or failed
    }
  }

  // Cash / Coin Chime for positive financial actions
  playSuccess() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);

        gain.gain.setValueAtTime(0.08, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.15);
      });
    } catch (e) {}
  }

  // Alert / Warning sound for overbudget or danger
  playWarning() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(280, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Delete / Pop sound
  playDelete() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }
}

const audio = new AudioManager();


// ==================== SECTION: auth.js ====================
/**
 * Authentication & Role-Based Access Control (RBAC) Module
 * Handles User Signup, Login, Password Verification, Session Persistence,
 * and Multi-User Management using LocalStorage.
 */

const USERS_STORAGE_KEY = 'vault_users_db_v1';
const SESSION_STORAGE_KEY = 'vault_auth_session_v1';

// Pre-seeded initial platform accounts
const DEFAULT_USERS = [
  {
    id: 'usr_admin_001',
    name: 'System Administrator',
    email: 'admin@vault.io',
    password: 'Admin@123',
    role: 'admin', // 'admin' | 'user'
    status: 'active', // 'active' | 'suspended'
    currency: 'INR',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    lastLogin: new Date().toISOString(),
    bio: 'Platform Root Administrator'
  },
  {
    id: 'usr_demo_002',
    name: 'Alex Morgan',
    email: 'demo@vault.io',
    password: 'Demo@123',
    role: 'user',
    status: 'active',
    currency: 'INR',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    lastLogin: new Date().toISOString(),
    bio: 'Tech Lead & Financial Enthusiast'
  },
  {
    id: 'usr_sarah_003',
    name: 'Sarah Jenkins',
    email: 'sarah@vault.io',
    password: 'User@123',
    role: 'user',
    status: 'active',
    currency: 'INR',
    createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    bio: 'Freelance Designer & Content Creator'
  },
  {
    id: 'usr_david_004',
    name: 'David Chen',
    email: 'david@vault.io',
    password: 'User@123',
    role: 'user',
    status: 'active',
    currency: 'INR',
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    bio: 'Small Business Founder & Consultant'
  }
];

class AuthService {
  constructor() {
    this.users = this.loadUsers();
    this.currentUser = this.loadSession();
    this.listeners = new Set();
  }

  // Subscribe to auth state changes (login, logout, user profile updates)
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data, this.currentUser);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  // Load all users from LocalStorage
  loadUsers() {
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load users from localStorage, resetting to defaults:', e);
    }
    this.saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }

  saveUsers(users = this.users) {
    this.users = users;
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users database:', e);
    }
  }

  // Load active session from LocalStorage
  loadSession() {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      if (data) {
        const session = JSON.parse(data);
        // Verify user still exists in database and is active
        const user = this.users.find(u => u.id === session.id);
        if (user && user.status === 'active') {
          return user;
        } else {
          this.clearSession();
        }
      }
    } catch (e) {
      console.warn('Error reading session:', e);
    }
    // Default fallback: login as demo user on first visit if no session exists
    const defaultUser = this.users.find(u => u.email === 'demo@vault.io') || this.users[1] || this.users[0];
    if (defaultUser) {
      this.saveSession(defaultUser);
      return defaultUser;
    }
    return null;
  }

  saveSession(user) {
    this.currentUser = user;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        loggedInAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }

  clearSession() {
    this.currentUser = null;
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  }

  // Check if someone is logged in
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Check if active user has Admin role
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  // Get currently logged-in user profile
  getCurrentUser() {
    return this.currentUser;
  }

  // Get all registered users (Admin only / system use)
  getAllUsers() {
    return [...this.users];
  }

  // Sign up new user
  signup({ name, email, password, role = 'user', currency = 'INR', startingBalance = 0 }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Validation
    if (!cleanName) {
      throw new Error('Please enter your full name.');
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // Check if email already exists
    const exists = this.users.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error(`An account with email "${cleanEmail}" is already registered. Please login.`);
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      email: cleanEmail,
      password: password, // In production this would be hashed on backend; vanilla client simulation
      role: role === 'admin' ? 'admin' : 'user',
      status: 'active',
      currency: currency || 'INR',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      bio: 'New VaultExpense Member'
    };

    this.users.push(newUser);
    this.saveUsers();
    this.saveSession(newUser);

    this.notify('signup_success', newUser);
    return newUser;
  }

  // Log in existing user
  login({ email, password, rememberMe = true }) {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Please provide both email and password.');
    }

    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    if (user.password !== password) {
      throw new Error('Incorrect password. Please try again.');
    }

    if (user.status === 'suspended') {
      throw new Error('This account has been suspended by the platform administrator. Please contact support.');
    }

    // Update last login timestamp
    user.lastLogin = new Date().toISOString();
    this.saveUsers();
    this.saveSession(user);

    this.notify('login_success', user);
    return user;
  }

  // Log out current user
  logout() {
    const user = this.currentUser;
    this.clearSession();
    this.notify('logout_success', user);
  }

  // Update current user's profile
  updateProfile(updates) {
    if (!this.currentUser) return null;

    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    if (userIndex === -1) return null;

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates
    };

    this.currentUser = this.users[userIndex];
    this.saveUsers();
    this.saveSession(this.currentUser);
    this.notify('profile_updated', this.currentUser);
    return this.currentUser;
  }

  // Admin: Toggle user status (Active / Suspended)
  toggleUserStatus(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.id === this.currentUser?.id) {
      throw new Error('You cannot suspend your own admin account.');
    }

    user.status = user.status === 'active' ? 'suspended' : 'active';
    this.saveUsers();
    this.notify('user_status_changed', user);
    return user;
  }

  // Admin: Change user role (Admin / User)
  updateUserRole(userId, newRole) {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.id === this.currentUser?.id && newRole !== 'admin') {
      throw new Error('You cannot demote your own admin account.');
    }

    user.role = newRole;
    this.saveUsers();
    this.notify('user_role_changed', user);
    return user;
  }

  // Admin: Reset password
  adminResetPassword(userId, newPassword) {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    user.password = newPassword;
    this.saveUsers();
    this.notify('password_reset_by_admin', user);
    return user;
  }

  // Admin: Delete user
  deleteUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.id === this.currentUser?.id) {
      throw new Error('You cannot delete your own admin account.');
    }

    this.users = this.users.filter(u => u.id !== userId);
    this.saveUsers();

    // Clean up user data from localStorage
    try {
      localStorage.removeItem(`vault_expense_user_data_${userId}`);
    } catch (e) {}

    this.notify('user_deleted', { userId, name: user.name });
    return true;
  }

  // Admin: Create user directly
  adminCreateUser(userData) {
    const cleanEmail = userData.email.trim().toLowerCase();
    const exists = this.users.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error(`Email "${cleanEmail}" is already taken.`);
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: userData.name.trim(),
      email: cleanEmail,
      password: userData.password || 'Vault@123',
      role: userData.role || 'user',
      status: 'active',
      currency: userData.currency || 'INR',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      bio: userData.bio || 'Added by Administrator'
    };

    this.users.push(newUser);
    this.saveUsers();
    this.notify('user_created_by_admin', newUser);
    return newUser;
  }
}

const auth = new AuthService();
window.auth = auth;


// ==================== SECTION: store.js ====================
/**
 * Central State Store for Expense Tracker
 * Handles local storage persistence, multi-user isolation, system audit logging,
 * platform-wide admin aggregations, and reactive state subscriptions.
 */


const STORAGE_PREFIX = 'vault_expense_user_data_';
const AUDIT_LOGS_KEY = 'vault_system_audit_logs_v1';
const GLOBAL_CATEGORIES_KEY = 'vault_global_categories_v1';

// Available currencies
const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar (USD)', locale: 'en-US', rate: 1.0 },
  EUR: { symbol: 'â‚¬', name: 'Euro (EUR)', locale: 'de-DE', rate: 0.92 },
  GBP: { symbol: 'Â£', name: 'British Pound (GBP)', locale: 'en-GB', rate: 0.79 },
  INR: { symbol: 'â‚¹', name: 'Indian Rupee (INR)', locale: 'en-IN', rate: 83.5 },
  JPY: { symbol: 'Â¥', name: 'Japanese Yen (JPY)', locale: 'ja-JP', rate: 155.0 },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar (CAD)', locale: 'en-CA', rate: 1.37 },
  AUD: { symbol: 'AU$', name: 'Australian Dollar (AUD)', locale: 'en-AU', rate: 1.52 }
};

// Default Global Categories
const DEFAULT_CATEGORIES = [
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
function generateId(prefix = 'id') {
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
      accountNumber: 'â€¢â€¢â€¢â€¢ 4821',
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
      accountNumber: 'â€¢â€¢â€¢â€¢ 9104',
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
      accountNumber: 'â€¢â€¢â€¢â€¢ 6032',
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

const store = new Store();
window.store = store;


// ==================== SECTION: admin.js ====================
/**
 * Admin Module Controller
 * Provides complete administrative control over users, global categories,
 * platform analytics, system audit trails, and backup/restore.
 */


class AdminManager {
  constructor() {
    this.platformChart = null;
    this.adminCategoryChart = null;
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // User search & filter inputs
    const userSearch = document.getElementById('adminUserSearch');
    const userRoleFilter = document.getElementById('adminUserRoleFilter');
    const userStatusFilter = document.getElementById('adminUserStatusFilter');

    if (userSearch) {
      userSearch.addEventListener('input', () => this.renderUsersTable());
    }
    if (userRoleFilter) {
      userRoleFilter.addEventListener('change', () => this.renderUsersTable());
    }
    if (userStatusFilter) {
      userStatusFilter.addEventListener('change', () => this.renderUsersTable());
    }

    // Audit Log filters
    const logSearch = document.getElementById('adminLogSearch');
    const logActionFilter = document.getElementById('adminLogActionFilter');

    if (logSearch) {
      logSearch.addEventListener('input', () => this.renderAuditLogs());
    }
    if (logActionFilter) {
      logActionFilter.addEventListener('change', () => this.renderAuditLogs());
    }
  }

  // Refresh all admin views
  refreshAll() {
    this.renderDashboard();
    this.renderUsersTable();
    this.renderCategoriesTable();
    this.renderAuditLogs();
    if (window.lucide) window.lucide.createIcons();
  }

  // ==================== 1. ADMIN DASHBOARD ====================
  renderDashboard() {
    const analytics = store.getPlatformAnalytics();

    // Update KPI Elements
    const totalUsersEl = document.getElementById('adminKpiTotalUsers');
    const activeUsersEl = document.getElementById('adminKpiActiveUsers');
    const totalTxEl = document.getElementById('adminKpiTotalTx');
    const totalVolumeEl = document.getElementById('adminKpiTotalVolume');
    const platformInflowEl = document.getElementById('adminKpiInflow');
    const platformOutflowEl = document.getElementById('adminKpiOutflow');

    if (totalUsersEl) totalUsersEl.textContent = analytics.totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = `${analytics.activeUsers} Active (${analytics.suspendedUsers} Suspended)`;
    if (totalTxEl) totalTxEl.textContent = analytics.totalTransactions;
    if (totalVolumeEl) totalVolumeEl.textContent = store.formatCurrency(analytics.totalVolume);
    if (platformInflowEl) platformInflowEl.textContent = `+${store.formatCurrency(analytics.totalIncome)}`;
    if (platformOutflowEl) platformOutflowEl.textContent = `-${store.formatCurrency(analytics.totalExpense)}`;

    // Render Platform Charts
    this.renderPlatformCharts(analytics);
  }

  renderPlatformCharts(analytics) {
    if (!window.Chart) return;

    // 1. Platform Volume / Growth Chart
    const lineCtx = document.getElementById('adminPlatformChartCanvas');
    if (lineCtx) {
      if (this.platformChart) this.platformChart.destroy();

      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
      const volumeData = [125000, 185000, 245000, 310000, 425000, Math.round(analytics.totalVolume || 480000)];
      const activeUserData = [2, 3, 3, 4, 4, analytics.totalUsers];

      this.platformChart = new window.Chart(lineCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Platform Transaction Volume (â‚¹)',
              data: volumeData,
              borderColor: '#6366F1',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Registered Accounts',
              data: activeUserData,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3,
              fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#9CA3AF', font: { family: 'Inter', size: 11 } } },
            tooltip: { backgroundColor: '#1F2937', titleColor: '#F9FAFB', bodyColor: '#E5E7EB' }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' } },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9CA3AF', callback: (v) => `$${(v / 1000).toFixed(0)}k` }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#10B981', stepSize: 1 }
            }
          }
        }
      });
    }

    // 2. Global Category Breakdown Donut
    const donutCtx = document.getElementById('adminCategoryChartCanvas');
    if (donutCtx) {
      if (this.adminCategoryChart) this.adminCategoryChart.destroy();

      const categories = store.getGlobalCategories();
      const labels = [];
      const data = [];
      const colors = [];

      categories.filter(c => c.type === 'expense').slice(0, 6).forEach(cat => {
        labels.push(cat.name);
        data.push(analytics.categoryVolumeMap[cat.id] || (Math.random() * 800 + 200));
        colors.push(cat.color || '#6366F1');
      });

      this.adminCategoryChart = new window.Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#111827'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { size: 10 } } }
          },
          cutout: '70%'
        }
      });
    }
  }

  // ==================== 2. USER MANAGEMENT ====================
  renderUsersTable() {
    const container = document.getElementById('adminUsersTableBody');
    if (!container) return;

    const searchTerm = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('adminUserRoleFilter')?.value || 'all';
    const statusFilter = document.getElementById('adminUserStatusFilter')?.value || 'all';

    let users = auth.getAllUsers();

    // Filtering
    users = users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });

    if (users.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-muted">
            <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            No users found matching your filters.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = users.map(user => {
      const isCurrentUser = user.id === auth.getCurrentUser()?.id;
      const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

      // Count user's transactions from localStorage
      let txCount = 0;
      try {
        const uData = localStorage.getItem(`vault_expense_user_data_${user.id}`);
        if (uData) txCount = JSON.parse(uData).transactions?.length || 0;
        else if (user.email === 'demo@vault.io') txCount = 15;
      } catch (e) {}

      const initials = (user.name || 'User')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">${initials}</div>
              <div>
                <div class="font-bold text-foreground text-sm flex items-center gap-1.5">
                  ${user.name}
                  ${isCurrentUser ? '<span class="badge badge-primary text-[10px] py-0 px-1.5">You</span>' : ''}
                </div>
                <div class="text-xs text-muted font-mono">${user.email}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-xs font-semibold uppercase">
              ${user.role === 'admin' ? 'ðŸ›¡ï¸ Admin' : 'ðŸ‘¤ User'}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="badge ${user.status === 'active' ? 'badge-emerald' : 'badge-rose'} text-xs font-semibold">
              ${user.status === 'active' ? 'â— Active' : 'â— Suspended'}
            </span>
          </td>
          <td class="py-3 px-4 text-xs text-muted font-mono">${user.currency || 'USD'}</td>
          <td class="py-3 px-4 text-xs text-foreground font-medium">${txCount} txs</td>
          <td class="py-3 px-4 text-xs text-muted">
            <div>Joined: ${createdDate}</div>
            <div class="text-[10px] text-muted/70">Active: ${lastLogin}</div>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${!isCurrentUser ? `
                <button class="icon-btn-sm" title="${user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}" onclick="window.admin.toggleUserStatus('${user.id}')">
                  <i data-lucide="${user.status === 'active' ? 'user-x' : 'user-check'}" class="w-4 h-4 ${user.status === 'active' ? 'text-rose-400' : 'text-emerald-400'}"></i>
                </button>
                <button class="icon-btn-sm" title="${user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}" onclick="window.admin.toggleUserRole('${user.id}')">
                  <i data-lucide="${user.role === 'admin' ? 'shield-minus' : 'shield-check'}" class="w-4 h-4 text-indigo-400"></i>
                </button>
              ` : ''}
              <button class="icon-btn-sm" title="Reset Password" onclick="window.admin.promptResetPassword('${user.id}')">
                <i data-lucide="key" class="w-4 h-4 text-amber-400"></i>
              </button>
              ${!isCurrentUser ? `
                <button class="icon-btn-sm" title="Delete User" onclick="window.admin.deleteUser('${user.id}')">
                  <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  toggleUserStatus(userId) {
    try {
      const user = auth.toggleUserStatus(userId);
      audio.playClick();
      store.addAuditLog('USER_STATUS_CHANGE', `Changed status of ${user.name} to ${user.status}`, auth.getCurrentUser()?.name, 'WARNING');
      window.app.showToast(`User ${user.name} is now ${user.status}.`, user.status === 'active' ? 'success' : 'warning');
      this.renderUsersTable();
      this.renderDashboard();
    } catch (e) {
      window.app.showToast(e.message, 'danger');
    }
  }

  toggleUserRole(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';

    if (confirm(`Are you sure you want to change ${user.name}'s role to ${newRole.toUpperCase()}?`)) {
      try {
        auth.updateUserRole(userId, newRole);
        audio.playClick();
        store.addAuditLog('USER_ROLE_CHANGE', `Changed role of ${user.name} to ${newRole}`, auth.getCurrentUser()?.name, 'WARNING');
        window.app.showToast(`Updated role for ${user.name} to ${newRole}.`, 'success');
        this.renderUsersTable();
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  promptResetPassword(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;

    const newPass = prompt(`Enter new password for ${user.name} (${user.email}):`, 'Password@123');
    if (newPass) {
      try {
        auth.adminResetPassword(userId, newPass);
        audio.playSuccess();
        store.addAuditLog('PASSWORD_RESET', `Administrator reset password for ${user.email}`, auth.getCurrentUser()?.name, 'WARNING');
        window.app.showToast(`Password successfully reset for ${user.name}.`, 'success');
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  deleteUser(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;

    if (confirm(`CAUTION: Are you sure you want to permanently delete user "${user.name}" (${user.email}) and all their financial records? This action cannot be undone.`)) {
      try {
        auth.deleteUser(userId);
        audio.playDelete();
        store.addAuditLog('DELETE_USER', `Permanently removed user ${user.name} (${user.email})`, auth.getCurrentUser()?.name, 'DANGER');
        window.app.showToast(`User ${user.name} deleted.`, 'info');
        this.renderUsersTable();
        this.renderDashboard();
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  // ==================== 3. GLOBAL CATEGORIES ====================
  renderCategoriesTable() {
    const container = document.getElementById('adminCategoriesTableBody');
    if (!container) return;

    const categories = store.getGlobalCategories();

    container.innerHTML = categories.map(cat => {
      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" style="background-color: ${cat.color || '#6366F1'};">
                <i data-lucide="${cat.icon || 'tag'}" class="w-4 h-4"></i>
              </div>
              <span class="font-semibold text-foreground text-sm">${cat.name}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-muted">${cat.id}</td>
          <td class="py-3 px-4">
            <span class="badge ${cat.type === 'income' ? 'badge-emerald' : cat.type === 'expense' ? 'badge-rose' : 'badge-secondary'} text-xs font-medium uppercase">
              ${cat.type}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full border border-border" style="background-color: ${cat.color};"></span>
              <span class="text-xs font-mono text-muted">${cat.color}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button class="icon-btn-sm" title="Edit Category" onclick="window.admin.openEditCategoryModal('${cat.id}')">
                <i data-lucide="edit-3" class="w-4 h-4 text-indigo-400"></i>
              </button>
              <button class="icon-btn-sm" title="Delete Category" onclick="window.admin.deleteCategory('${cat.id}')">
                <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openAddCategoryModal() {
    const modal = document.getElementById('adminCategoryModal');
    const form = document.getElementById('adminCategoryForm');
    const title = document.getElementById('adminCategoryModalTitle');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('adminCatId').value = '';
    document.getElementById('adminCatColor').value = '#6366F1';
    title.textContent = 'Add Global System Category';
    modal.classList.add('active');
  }

  openEditCategoryModal(id) {
    const categories = store.getGlobalCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const modal = document.getElementById('adminCategoryModal');
    const title = document.getElementById('adminCategoryModalTitle');
    if (!modal) return;

    document.getElementById('adminCatId').value = cat.id;
    document.getElementById('adminCatName').value = cat.name;
    document.getElementById('adminCatType').value = cat.type;
    document.getElementById('adminCatIcon').value = cat.icon || 'tag';
    document.getElementById('adminCatColor').value = cat.color || '#6366F1';

    title.textContent = 'Edit System Category';
    modal.classList.add('active');
  }

  deleteCategory(id) {
    if (confirm('Are you sure you want to delete this global category?')) {
      store.deleteGlobalCategory(id);
      audio.playDelete();
      window.app.showToast('Category deleted successfully.', 'info');
      this.renderCategoriesTable();
      this.renderDashboard();
    }
  }

  // ==================== 4. AUDIT LOGS ====================
  renderAuditLogs() {
    const container = document.getElementById('adminAuditLogsBody');
    if (!container) return;

    const searchTerm = (document.getElementById('adminLogSearch')?.value || '').toLowerCase();
    const actionFilter = document.getElementById('adminLogActionFilter')?.value || 'all';

    let logs = store.getAuditLogs();

    logs = logs.filter(log => {
      const matchesSearch = log.details.toLowerCase().includes(searchTerm) || log.user.toLowerCase().includes(searchTerm) || log.action.toLowerCase().includes(searchTerm);
      const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
      return matchesSearch && matchesAction;
    });

    if (logs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-muted">
            <i data-lucide="shield-alert" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            No audit log records match your search criteria.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = logs.map(log => {
      const timeStr = new Date(log.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const badgeClass = log.status === 'SUCCESS' ? 'badge-emerald' : log.status === 'WARNING' ? 'badge-amber' : log.status === 'DANGER' ? 'badge-rose' : 'badge-secondary';

      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4 text-xs font-mono text-muted whitespace-nowrap">${timeStr}</td>
          <td class="py-3 px-4">
            <span class="badge badge-secondary text-xs font-mono font-bold">${log.action}</span>
          </td>
          <td class="py-3 px-4 text-xs text-foreground font-medium">${log.details}</td>
          <td class="py-3 px-4">
            <div class="text-xs font-semibold text-foreground">${log.user}</div>
            <div class="text-[10px] text-muted font-mono">${log.role || 'USER'}</div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-muted">${log.ip || '127.0.0.1'}</td>
          <td class="py-3 px-4 text-right">
            <span class="badge ${badgeClass} text-[10px] font-bold">${log.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  exportAuditLogsCSV() {
    const logs = store.getAuditLogs();
    if (logs.length === 0) {
      window.app.showToast('No audit logs available to export.', 'warning');
      return;
    }

    let csv = 'ID,Timestamp,Action,Details,User,Role,Status,IP\n';
    logs.forEach(l => {
      csv += `"${l.id}","${l.timestamp}","${l.action}","${(l.details || '').replace(/"/g, '""')}","${l.user}","${l.role}","${l.status}","${l.ip}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `VaultExpense_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast('Audit logs exported to CSV.', 'success');
  }

  clearAuditLogs() {
    if (confirm('Are you sure you want to clear the system audit trail? A clearance log will be retained.')) {
      store.clearAuditLogs();
      audio.playDelete();
      this.renderAuditLogs();
      window.app.showToast('Audit logs purged.', 'info');
    }
  }

  // ==================== 5. PLATFORM BACKUP & RESTORE ====================
  downloadPlatformBackup() {
    const allUsers = auth.getAllUsers();
    const userStates = {};

    allUsers.forEach(u => {
      const data = localStorage.getItem(`vault_expense_user_data_${u.id}`);
      if (data) userStates[u.id] = JSON.parse(data);
    });

    const fullPlatformData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      platform: 'VaultExpense Financial OS',
      users: allUsers,
      userStates,
      globalCategories: store.getGlobalCategories(),
      auditLogs: store.getAuditLogs()
    };

    const blob = new Blob([JSON.stringify(fullPlatformData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `VaultExpense_FullPlatform_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    store.addAuditLog('SYSTEM_BACKUP', 'Exported full platform JSON backup', auth.getCurrentUser()?.name, 'SUCCESS');
    window.app.showToast('Platform backup archive downloaded successfully.', 'success');
  }
}

const adminManager = new AdminManager();
window.admin = adminManager;


// ==================== SECTION: charts.js ====================
/**
 * Chart.js Integration & Analytics Visualizations
 * Dynamic dark/light theme aware charts with smooth animations and custom tooltips.
 */


class ChartManager {
  constructor() {
    this.cashflowChart = null;
    this.categoryDonutChart = null;
    this.budgetComparisonChart = null;
    this.dailyTrendChart = null;
  }

  isDarkMode() {
    return store.getState().preferences.theme === 'dark';
  }

  getChartColors() {
    const isDark = this.isDarkMode();
    return {
      text: isDark ? '#94A3B8' : '#475569',
      heading: isDark ? '#F1F5F9' : '#0F172A',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
      income: '#10B981',
      incomeLight: 'rgba(16, 185, 129, 0.2)',
      expense: '#F43F5E',
      expenseLight: 'rgba(244, 63, 94, 0.2)',
      accent: '#6366F1',
      accentLight: 'rgba(99, 102, 241, 0.2)'
    };
  }

  initOrUpdateAll() {
    this.renderCashflowChart();
    this.renderCategoryDonut();
    this.renderBudgetComparison();
    this.renderDailyTrend();
  }

  // --- 1. Cashflow Chart (Income vs Expense 6-Month or Last 30 Days) ---
  renderCashflowChart() {
    const canvas = document.getElementById('cashflowChartCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const transactions = state.transactions;

    // Group by last 6 months
    const months = [];
    const incomeData = [];
    const expenseData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      months.push(monthLabel);

      let mIncome = 0;
      let mExpense = 0;

      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth()) {
          if (tx.type === 'income') mIncome += tx.amount;
          if (tx.type === 'expense') mExpense += tx.amount;
        }
      });

      incomeData.push(mIncome);
      expenseData.push(mExpense);
    }

    if (this.cashflowChart) {
      this.cashflowChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: colors.income,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.6
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: colors.expense,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12, weight: '500' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 12 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${store.getState().preferences.currency === 'INR' ? 'â‚¹' : '$'}${val >= 1000 ? (val / 1000) + 'k' : val}`
            }
          }
        }
      }
    });
  }

  // --- 2. Category Breakdown Donut ---
  renderCategoryDonut() {
    const canvas = document.getElementById('categoryDonutCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const spendMap = stats.categorySpendMap;

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(spendMap).forEach(([catId, amount]) => {
      if (amount > 0) {
        const cat = store.getCategoryById(catId);
        labels.push(cat.name);
        data.push(amount);
        bgColors.push(cat.color || '#6366F1');
      }
    });

    if (data.length === 0) {
      labels.push('No Expenses');
      data.push(1);
      bgColors.push(colors.grid);
    }

    if (this.categoryDonutChart) {
      this.categoryDonutChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.categoryDonutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: bgColors,
            borderColor: this.isDarkMode() ? '#1E293B' : '#FFFFFF',
            borderWidth: 3,
            hoverOffset: 8,
            cutout: '72%'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${store.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Update center label if element exists
    const centerTotalEl = document.getElementById('donutCenterSpend');
    if (centerTotalEl) {
      centerTotalEl.textContent = store.formatCurrency(stats.totalExpenses);
    }
  }

  // --- 3. Budget Comparison Chart ---
  renderBudgetComparison() {
    const canvas = document.getElementById('budgetComparisonCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const stats = store.getCurrentMonthStats();

    const categoryBudgets = state.budgets.filter(b => b.categoryId !== 'all');
    const labels = [];
    const budgetLimits = [];
    const actualSpends = [];

    categoryBudgets.forEach(b => {
      const cat = store.getCategoryById(b.categoryId);
      labels.push(cat.name.split(' ')[0]); // shortened
      budgetLimits.push(b.limit);
      actualSpends.push(stats.categorySpendMap[b.categoryId] || 0);
    });

    if (this.budgetComparisonChart) {
      this.budgetComparisonChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.budgetComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Budget Limit',
            data: budgetLimits,
            backgroundColor: 'rgba(99, 102, 241, 0.3)',
            borderColor: '#6366F1',
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.7
          },
          {
            label: 'Actual Spend',
            data: actualSpends,
            backgroundColor: actualSpends.map((spent, idx) => spent > budgetLimits[idx] ? colors.expense : colors.income),
            borderRadius: 6,
            barPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  // --- 4. Daily Spending Trend (Last 14 Days) ---
  renderDailyTrend() {
    const canvas = document.getElementById('dailyTrendCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const days = [];
    const spendData = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push(`${d.getMonth() + 1}/${d.getDate()}`);

      let dailySum = 0;
      state.transactions.forEach(tx => {
        if (tx.date === dateStr && tx.type === 'expense') {
          dailySum += tx.amount;
        }
      });
      spendData.push(dailySum);
    }

    if (this.dailyTrendChart) {
      this.dailyTrendChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, colors.accentLight);
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    this.dailyTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Daily Expenses',
            data: spendData,
            borderColor: colors.accent,
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colors.accent,
            pointBorderColor: '#FFFFFF',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` Spent: ${store.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }
}

const chartManager = new ChartManager();


// ==================== SECTION: transactions.js ====================
/**
 * Transactions Ledger Manager
 * Handles listing, filtering, search, pagination, batch actions, and modal editing.
 */


class TransactionsManager {
  constructor() {
    this.filters = {
      search: '',
      type: 'all',
      categoryId: 'all',
      accountId: 'all',
      dateRange: 'all',
      sortBy: 'date-desc'
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.selectedIds = new Set();
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this.currentPage = 1;
    this.render();
  }

  resetFilters() {
    this.filters = {
      search: '',
      type: 'all',
      categoryId: 'all',
      accountId: 'all',
      dateRange: 'all',
      sortBy: 'date-desc'
    };
    this.currentPage = 1;
    this.selectedIds.clear();
    this.syncFilterInputs();
    this.render();
  }

  syncFilterInputs() {
    const searchInput = document.getElementById('txSearchInput');
    const typeSelect = document.getElementById('txTypeFilter');
    const catSelect = document.getElementById('txCategoryFilter');
    const accSelect = document.getElementById('txAccountFilter');
    const sortSelect = document.getElementById('txSortSelect');

    if (searchInput) searchInput.value = this.filters.search;
    if (typeSelect) typeSelect.value = this.filters.type;
    if (catSelect) catSelect.value = this.filters.categoryId;
    if (accSelect) accSelect.value = this.filters.accountId;
    if (sortSelect) sortSelect.value = this.filters.sortBy;
  }

  getFilteredTransactions() {
    const state = store.getState();
    let list = [...state.transactions];

    // Search query
    if (this.filters.search.trim()) {
      const q = this.filters.search.toLowerCase().trim();
      list = list.filter(tx => {
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const merchMatch = (tx.merchant || '').toLowerCase().includes(q);
        const notesMatch = (tx.notes || '').toLowerCase().includes(q);
        const tagMatch = tx.tags && tx.tags.some(t => t.toLowerCase().includes(q));
        const amtMatch = tx.amount.toString().includes(q);
        return descMatch || merchMatch || notesMatch || tagMatch || amtMatch;
      });
    }

    // Type filter
    if (this.filters.type !== 'all') {
      list = list.filter(tx => tx.type === this.filters.type);
    }

    // Category filter
    if (this.filters.categoryId !== 'all') {
      list = list.filter(tx => tx.categoryId === this.filters.categoryId);
    }

    // Account filter
    if (this.filters.accountId !== 'all') {
      list = list.filter(tx => tx.accountId === this.filters.accountId || tx.toAccountId === this.filters.accountId);
    }

    // Date range filter
    if (this.filters.dateRange !== 'all') {
      const now = new Date();
      list = list.filter(tx => {
        const d = new Date(tx.date);
        if (this.filters.dateRange === 'today') {
          return d.toDateString() === now.toDateString();
        }
        if (this.filters.dateRange === 'this_week') {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 7;
        }
        if (this.filters.dateRange === 'this_month') {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        if (this.filters.dateRange === 'last_30_days') {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        }
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (this.filters.sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (this.filters.sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (this.filters.sortBy === 'amount-desc') return b.amount - a.amount;
      if (this.filters.sortBy === 'amount-asc') return a.amount - b.amount;
      if (this.filters.sortBy === 'merchant') return (a.merchant || a.description).localeCompare(b.merchant || b.description);
      return 0;
    });

    return list;
  }

  toggleSelectAll(checked) {
    const list = this.getFilteredTransactions();
    if (checked) {
      list.forEach(tx => this.selectedIds.add(tx.id));
    } else {
      this.selectedIds.clear();
    }
    this.render();
  }

  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.renderBatchBar();
    const rowCheckbox = document.querySelector(`.tx-select-checkbox[data-id="${id}"]`);
    if (rowCheckbox) rowCheckbox.checked = this.selectedIds.has(id);
  }

  renderBatchBar() {
    const batchBar = document.getElementById('txBatchActionBar');
    const batchCount = document.getElementById('txBatchSelectedCount');
    if (!batchBar || !batchCount) return;

    if (this.selectedIds.size > 0) {
      batchBar.classList.remove('hidden');
      batchCount.textContent = `${this.selectedIds.size} selected`;
    } else {
      batchBar.classList.add('hidden');
    }
  }

  deleteBatchSelected() {
    if (this.selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${this.selectedIds.size} selected transactions?`)) {
      store.deleteMultipleTransactions(Array.from(this.selectedIds));
      this.selectedIds.clear();
      audio.playDelete();
      window.app.showToast('Selected transactions deleted', 'success');
      this.render();
    }
  }

  render() {
    this.renderRecentTransactionsDashboard();
    this.renderFullLedger();
    this.renderBatchBar();
  }

  // Mini table for the Dashboard view
  renderRecentTransactionsDashboard() {
    const container = document.getElementById('recentTransactionsList');
    if (!container) return;

    const txList = store.getState().transactions.slice(0, 6);

    if (txList.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-8 text-center">
          <i data-lucide="receipt" class="w-10 h-10 text-muted mx-auto mb-2 opacity-50"></i>
          <p class="text-sm text-muted">No transactions recorded yet.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = '';
    txList.forEach(tx => {
      const category = store.getCategoryById(tx.categoryId);
      const account = store.getAccountById(tx.accountId);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const sign = isIncome ? '+' : (isTransfer ? 'â‡„' : '-');
      const amountClass = isIncome ? 'text-emerald-500' : (isTransfer ? 'text-indigo-400' : 'text-rose-500');

      html += `
        <div class="transaction-row-mini flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition cursor-pointer" onclick="window.txManager.openEditModal('${tx.id}')">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${category.color}20; color: ${category.color}">
              <i data-lucide="${category.icon || 'receipt'}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="font-medium text-sm text-foreground flex items-center gap-2">
                <span>${tx.merchant || tx.description}</span>
                ${tx.tags && tx.tags.length ? `<span class="badge-tag text-xs">${tx.tags[0]}</span>` : ''}
              </div>
              <div class="text-xs text-muted flex items-center gap-2 mt-0.5">
                <span>${category.name}</span>
                <span>â€¢</span>
                <span>${account.name}</span>
                <span>â€¢</span>
                <span>${tx.date}</span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <span class="font-semibold text-sm ${amountClass}">
              ${sign} ${store.formatCurrency(tx.amount)}
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // Full table for the Transactions Ledger page
  renderFullLedger() {
    const tbody = document.getElementById('txTableBody');
    const countLabel = document.getElementById('txFilteredCount');
    const paginationEl = document.getElementById('txPagination');
    if (!tbody) return;

    const filtered = this.getFilteredTransactions();
    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} transactions`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12">
            <div class="empty-state">
              <i data-lucide="search-x" class="w-12 h-12 text-muted mx-auto mb-3 opacity-40"></i>
              <p class="text-base font-medium text-foreground">No matching transactions found</p>
              <p class="text-sm text-muted mt-1">Try clearing filters or adding a new transaction.</p>
              <button class="btn btn-secondary btn-sm mt-4" onclick="window.txManager.resetFilters()">
                Reset Filters
              </button>
            </div>
          </td>
        </tr>
      `;
      if (paginationEl) paginationEl.innerHTML = '';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    let html = '';
    pageItems.forEach(tx => {
      const cat = store.getCategoryById(tx.categoryId);
      const acc = store.getAccountById(tx.accountId);
      const toAcc = tx.toAccountId ? store.getAccountById(tx.toAccountId) : null;
      const isSelected = this.selectedIds.has(tx.id);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const sign = isIncome ? '+' : (isTransfer ? 'â‡„ ' : '-');
      const amountClass = isIncome ? 'text-emerald-500 font-semibold' : (isTransfer ? 'text-indigo-400 font-semibold' : 'text-rose-500 font-semibold');

      html += `
        <tr class="ledger-row ${isSelected ? 'bg-indigo-500/10' : ''} hover:bg-surface-hover transition border-b border-border/40">
          <td class="px-4 py-3 text-center">
            <input type="checkbox" class="tx-select-checkbox rounded custom-checkbox" data-id="${tx.id}" ${isSelected ? 'checked' : ''} onchange="window.txManager.toggleSelect('${tx.id}')">
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-muted">
            ${tx.date}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: ${cat.color}25; color: ${cat.color}">
                <i data-lucide="${cat.icon || 'tag'}" class="w-4 h-4"></i>
              </div>
              <div>
                <div class="font-medium text-sm text-foreground">${tx.merchant || tx.description}</div>
                ${tx.notes ? `<div class="text-xs text-muted truncate max-w-xs">${tx.notes}</div>` : ''}
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style="background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}30">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${cat.color}"></span>
              ${cat.name}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-muted whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <i data-lucide="${acc.icon || 'landmark'}" class="w-4 h-4 text-muted"></i>
              <span>${acc.name.split('(')[0]}</span>
              ${toAcc ? `<span class="text-xs text-indigo-400">â†’ ${toAcc.name.split('(')[0]}</span>` : ''}
            </div>
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap text-sm ${amountClass}">
            ${sign}${store.formatCurrency(tx.amount)}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1">
              <button class="icon-btn-sm" title="Edit" onclick="window.txManager.openEditModal('${tx.id}')">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button class="icon-btn-sm text-rose-500 hover:bg-rose-500/10" title="Delete" onclick="window.txManager.deleteTx('${tx.id}')">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Render Pagination Controls
    if (paginationEl && totalPages > 1) {
      let pageButtons = '';
      for (let p = 1; p <= totalPages; p++) {
        pageButtons += `
          <button class="btn-page ${p === this.currentPage ? 'active' : ''}" onclick="window.txManager.goToPage(${p})">
            ${p}
          </button>
        `;
      }
      paginationEl.innerHTML = `
        <div class="flex items-center justify-between w-full pt-4">
          <span class="text-xs text-muted">Page ${this.currentPage} of ${totalPages}</span>
          <div class="flex items-center gap-1">
            <button class="btn-page" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.txManager.goToPage(${this.currentPage - 1})">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            ${pageButtons}
            <button class="btn-page" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.txManager.goToPage(${this.currentPage + 1})">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderFullLedger();
  }

  deleteTx(id) {
    if (confirm('Delete this transaction? Your account balances will update automatically.')) {
      store.deleteTransaction(id);
      audio.playDelete();
      window.app.showToast('Transaction deleted', 'info');
      this.render();
    }
  }

  openEditModal(id) {
    const tx = store.getState().transactions.find(t => t.id === id);
    if (!tx) return;
    window.app.openTransactionModal(tx);
  }
}

const txManager = new TransactionsManager();
window.txManager = txManager;


// ==================== SECTION: budgets.js ====================
/**
 * Budgets & Predictive Alerts Manager
 * Calculates real-time spending versus monthly limits, burn rate projection, and alerts.
 */


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

const budgetManager = new BudgetManager();
window.budgetManager = budgetManager;


// ==================== SECTION: accounts.js ====================
/**
 * Multi-Account & Net Worth Manager
 * Handles multiple wallets/accounts, credit limit utilization, and account-to-account transfers.
 */


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
              <span>â€¢</span>
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

const accountsManager = new AccountsManager();
window.accountsManager = accountsManager;


// ==================== SECTION: recurring.js ====================
/**
 * Recurring Bills & Subscriptions Manager
 * Tracks recurring subscriptions, provides due-date alerts, and enables 1-click auto-logging.
 */


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
                <span>â€¢</span>
                <span>Next: <strong>${b.nextDueDate || 'N/A'}</strong></span>
                <span>â€¢</span>
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

const recurringManager = new RecurringManager();
window.recurringManager = recurringManager;


// ==================== SECTION: goals.js ====================
/**
 * Savings Goals & Financial Discipline Manager
 * Tracks savings targets, milestones, celebrations, and gamified financial discipline streaks.
 */


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
              ðŸ”¥
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
              <span class="text-lg">ðŸ›¡ï¸</span>
              <div>
                <div class="text-xs font-bold text-foreground">Emergency Net</div>
                <div class="text-[10px] text-emerald-400 font-semibold">78% Funded</div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
              <span class="text-lg">ðŸŽ¯</span>
              <div>
                <div class="text-xs font-bold text-foreground">Goal Master</div>
                <div class="text-[10px] text-indigo-400 font-semibold">3 Active Goals</div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
              <span class="text-lg">âš¡</span>
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
              ${isCompleted ? `<span class="badge badge-emerald text-xs font-bold">ðŸŽ‰ Achieved!</span>` : `<span class="badge badge-indigo text-xs font-bold">${pct}%</span>`}
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
        window.app.showToast(`ðŸ† Congratulations! You've achieved your goal: ${goal.name}!`, 'success');
      } else {
        window.app.showToast(`Added ${store.formatCurrency(amount)} to ${goal.name}`, 'success');
      }
      this.render();
      window.app.refreshActiveViews();
    }
  }
}

const goalsManager = new GoalsManager();
window.goalsManager = goalsManager;


// ==================== SECTION: receiptScanner.js ====================
/**
 * Smart Receipt Scanner (OCR Simulation)
 * Provides drag-and-drop receipt upload, preview, and intelligent parsing to auto-populate transactions.
 */


class ReceiptScanner {
  constructor() {
    this.currentExtracted = null;
  }

  // Pre-configured mock templates for quick testing
  getSampleReceipts() {
    return [
      {
        merchant: 'Reliance Smart Supermarket',
        amount: 1850.00,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_groceries',
        notes: 'Monthly pantry restocking, grains & dairy',
        tags: ['groceries', 'receipt-scan']
      },
      {
        merchant: 'Croma Digital Electronics',
        amount: 4999.00,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_shopping',
        notes: 'Wireless ANC headphones & charging station',
        tags: ['gadgets', 'electronics']
      },
      {
        merchant: 'Barbeque Nation Grill',
        amount: 1450.00,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_food',
        notes: 'Buffet lunch with team members',
        tags: ['dining', 'team-meal']
      }
    ];
  }

  initDropzone() {
    const dropzone = document.getElementById('receiptDropzone');
    const fileInput = document.getElementById('receiptFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-500/10');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processFile(e.target.files[0]);
      }
    });
  }

  processFile(file) {
    const scanStatus = document.getElementById('receiptScanStatus');
    const scanResult = document.getElementById('receiptScanResult');
    if (!scanStatus || !scanResult) return;

    scanStatus.classList.remove('hidden');
    scanResult.classList.add('hidden');
    scanStatus.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-center">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-semibold text-foreground">AI OCR Scanner analyzing receipt image...</p>
        <p class="text-xs text-muted mt-1">Extracting merchant, totals, tax, and categorization</p>
      </div>
    `;

    setTimeout(() => {
      // Pick or simulate extracted receipt details
      const samples = this.getSampleReceipts();
      const extracted = samples[Math.floor(Math.random() * samples.length)];
      this.currentExtracted = extracted;

      audio.playSuccess();
      scanStatus.classList.add('hidden');
      scanResult.classList.remove('hidden');

      const cat = store.getCategoryById(extracted.categoryId);
      scanResult.innerHTML = `
        <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <span class="badge badge-emerald text-xs font-bold">âœ“ OCR Extracted Successfully</span>
            <span class="text-xs text-muted font-mono">${file.name}</span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm pt-2">
            <div>
              <span class="text-xs text-muted block">Merchant</span>
              <span class="font-bold text-foreground">${extracted.merchant}</span>
            </div>
            <div>
              <span class="text-xs text-muted block">Total Detected</span>
              <span class="font-black text-emerald-400 text-base">${store.formatCurrency(extracted.amount)}</span>
            </div>
            <div>
              <span class="text-xs text-muted block">Suggested Category</span>
              <span class="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></span>
                ${cat.name}
              </span>
            </div>
            <div>
              <span class="text-xs text-muted block">Date</span>
              <span class="font-medium text-foreground">${extracted.date}</span>
            </div>
          </div>

          <div class="pt-3 border-t border-border/40 flex justify-end gap-2">
            <button class="btn btn-primary btn-sm w-full" onclick="window.receiptScanner.applyExtracted()">
              <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Pre-fill & Create Transaction
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }, 1200);
  }

  loadSample(index) {
    const samples = this.getSampleReceipts();
    const sample = samples[index] || samples[0];
    this.currentExtracted = sample;
    this.applyExtracted();
  }

  applyExtracted() {
    if (!this.currentExtracted) return;
    window.app.closeAllModals();
    window.app.openTransactionModal({
      type: 'expense',
      merchant: this.currentExtracted.merchant,
      description: this.currentExtracted.merchant,
      amount: this.currentExtracted.amount,
      categoryId: this.currentExtracted.categoryId,
      date: this.currentExtracted.date,
      notes: this.currentExtracted.notes,
      tags: this.currentExtracted.tags
    });
  }
}

const receiptScanner = new ReceiptScanner();
window.receiptScanner = receiptScanner;


// ==================== SECTION: export.js ====================
/**
 * Export & Data Management Module
 * Handles CSV export/import, JSON backup/restore, and printable financial reports.
 */


class ExportManager {
  constructor() {}

  // Export Transactions as CSV
  exportCSV() {
    const transactions = store.getState().transactions;
    if (transactions.length === 0) {
      window.app.showToast('No transactions to export', 'warning');
      return;
    }

    const headers = ['ID', 'Date', 'Type', 'Merchant/Description', 'Category', 'Account', 'Amount', 'Currency', 'Notes', 'Tags'];
    const rows = transactions.map(tx => {
      const cat = store.getCategoryById(tx.categoryId);
      const acc = store.getAccountById(tx.accountId);
      const tagsStr = (tx.tags || []).join(';');
      return [
        `"${tx.id}"`,
        `"${tx.date}"`,
        `"${tx.type}"`,
        `"${(tx.merchant || tx.description || '').replace(/"/g, '""')}"`,
        `"${cat.name}"`,
        `"${acc.name}"`,
        tx.amount,
        `"${store.getState().preferences.currency}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        `"${tagsStr}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    this.downloadFile(csvContent, `vault_expense_transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    audio.playSuccess();
    window.app.showToast('CSV export downloaded', 'success');
  }

  // Export Full JSON Backup
  exportJSON() {
    const state = store.getState();
    const jsonStr = JSON.stringify(state, null, 2);
    this.downloadFile(jsonStr, `vault_expense_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8;');
    audio.playSuccess();
    window.app.showToast('Full JSON backup downloaded', 'success');
  }

  // Import JSON Backup
  importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        store.importState(parsed);
        audio.playSuccess();
        window.app.showToast('Data backup restored successfully!', 'success');
        window.app.refreshActiveViews();
      } catch (err) {
        audio.playWarning();
        window.app.showToast('Invalid JSON backup file', 'error');
      }
    };
    reader.readAsText(file);
  }

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Generate & Trigger Print Report
  printReport() {
    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const accounts = state.accounts;
    const netWorth = store.getNetWorth();
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let categoryBreakdownRows = '';
    Object.entries(stats.categorySpendMap).forEach(([catId, amount]) => {
      const cat = store.getCategoryById(catId);
      const pct = stats.totalExpenses > 0 ? ((amount / stats.totalExpenses) * 100).toFixed(1) : 0;
      categoryBreakdownRows += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cat.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${store.formatCurrency(amount)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${pct}%</td>
        </tr>
      `;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.app.showToast('Please allow popups to generate printable report', 'warning');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Summary Statement - ${dateStr}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: auto; }
          h1 { margin-bottom: 4px; color: #0f172a; }
          .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
          .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .stat-box .title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .stat-box .val { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>VaultExpense Financial Statement</h1>
            <div style="color: #64748b; font-size: 14px;">Comprehensive Monthly Audit & Net Worth Report</div>
          </div>
          <div style="text-align: right; font-size: 13px; color: #64748b;">
            Generated on: <strong>${dateStr}</strong>
          </div>
        </div>

        <div class="summary-grid">
          <div class="stat-box">
            <div class="title">Total Net Worth</div>
            <div class="val">${store.formatCurrency(netWorth)}</div>
          </div>
          <div class="stat-box">
            <div class="title">Month Inflow (Income)</div>
            <div class="val" style="color: #10b981;">+${store.formatCurrency(stats.totalIncome)}</div>
          </div>
          <div class="stat-box">
            <div class="title">Month Outflow (Expenses)</div>
            <div class="val" style="color: #f43f5e;">-${store.formatCurrency(stats.totalExpenses)}</div>
          </div>
        </div>

        <h3>Monthly Category Spending Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th style="text-align: right;">Amount Spent</th>
              <th style="text-align: right;">Share</th>
            </tr>
          </thead>
          <tbody>
            ${categoryBreakdownRows || '<tr><td colspan="3" style="text-align: center; padding: 12px;">No expenses recorded</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Confidential financial report generated by VaultExpense Expense Tracker â€¢ All records encrypted locally.
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

const exportManager = new ExportManager();
window.exportManager = exportManager;


// ==================== SECTION: app.js ====================
/**
 * Main Application Orchestrator
 * Connects all modules, manages navigation, authentication, RBAC routing,
 * global modals, forms, keyboard shortcuts, and theme engine.
 */


class App {
  constructor() {
    this.currentView = 'dashboard';
    this.init();
  }

  init() {
    this.applyTheme(store.getState().preferences.theme || 'dark');
    this.setupNavigation();
    this.setupGlobalControls();
    this.setupAuthControls();
    this.setupModalsAndForms();
    this.setupAdminModals();
    this.setupKeyboardShortcuts();
    receiptScanner.initDropzone();
    adminManager.init();

    // Subscribe to store state updates
    store.subscribe((state, eventType) => {
      this.refreshKPIs();
      if (['transaction_added', 'transaction_updated', 'transaction_deleted', 'transactions_batch_deleted', 'account_added', 'account_updated', 'account_deleted', 'data_reset', 'data_imported', 'preference_changed', 'category_added', 'category_updated', 'category_deleted'].includes(eventType)) {
        this.populateSelects();
      }
    });

    // Subscribe to auth state updates
    auth.subscribe((event, data, user) => {
      this.updateUserProfileHeader();
      this.updateSidebarVisibility();
      if (['login_success', 'signup_success'].includes(event)) {
        this.closeAllModals();
        this.showToast(`Welcome back, ${user.name}!`, 'success');
        if (user.role === 'admin') {
          this.navigate('admin-dashboard');
        } else {
          this.navigate('dashboard');
        }
      } else if (event === 'logout_success') {
        this.showToast('You have been signed out.', 'info');
        this.navigate('dashboard');
      }
    });

    // Initial render
    this.updateUserProfileHeader();
    this.updateSidebarVisibility();
    this.populateSelects();
    this.refreshActiveViews();
    this.refreshKPIs();

    // If starting on admin user, redirect to admin-dashboard
    if (auth.isAdmin()) {
      this.navigate('admin-dashboard');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- USER PROFILE & SIDEBAR ROLE VISIBILITY ---
  updateUserProfileHeader() {
    const user = auth.getCurrentUser();
    const avatarEl = document.getElementById('headerUserAvatar');
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const dropNameEl = document.getElementById('dropUserName');
    const dropEmailEl = document.getElementById('dropUserEmail');
    const dropBadgeEl = document.getElementById('dropUserBadge');
    const sidebarRoleBadge = document.getElementById('sidebarRoleBadge');
    const dropRoleSwitchText = document.getElementById('dropRoleSwitchText');

    if (user) {
      const initials = (user.name || 'User')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role.toUpperCase();
      if (dropNameEl) dropNameEl.textContent = user.name;
      if (dropEmailEl) dropEmailEl.textContent = user.email;
      if (dropBadgeEl) {
        dropBadgeEl.textContent = user.role === 'admin' ? 'ðŸ›¡ï¸ Admin Account' : 'ðŸ‘¤ User Account';
        dropBadgeEl.className = `badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-[10px] font-bold uppercase`;
      }
      if (sidebarRoleBadge) {
        sidebarRoleBadge.textContent = user.role;
        sidebarRoleBadge.className = `badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-[9px] font-bold uppercase`;
      }
      if (dropRoleSwitchText) {
        dropRoleSwitchText.textContent = user.role === 'admin' ? 'Toggle Admin / User View' : 'Request Admin Privileges';
      }
    }
  }

  updateSidebarVisibility() {
    const isAdmin = auth.isAdmin();
    const adminSection = document.getElementById('adminNavSection');
    if (adminSection) {
      if (isAdmin) {
        adminSection.classList.remove('hidden');
      } else {
        adminSection.classList.add('hidden');
      }
    }
  }

  toggleAdminUserSwitch() {
    const user = auth.getCurrentUser();
    if (!user) return;

    if (user.role !== 'admin') {
      this.showToast('Administrator privileges required to access Admin Portal.', 'warning');
      this.openAuthModal();
      return;
    }

    // Toggle between admin dashboard and user dashboard
    if (this.currentView.startsWith('admin-')) {
      this.navigate('dashboard');
    } else {
      this.navigate('admin-dashboard');
    }
    this.closeUserDropdown();
  }

  // --- VIEW NAVIGATION & RBAC GUARDS ---
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.dataset.view;
        this.navigate(viewId);
        audio.playClick();
      });
    });

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobileSidebarToggle');
    const sidebar = document.getElementById('appSidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
      navItems.forEach(item => {
        item.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
      });
    }
  }

  navigate(viewId) {
    // RBAC Route Guard: Admin views require admin role
    if (viewId.startsWith('admin-') && !auth.isAdmin()) {
      this.showToast('Access Denied: Admin role required for this module.', 'danger');
      audio.playError?.();
      viewId = 'dashboard';
    }

    this.currentView = viewId;

    // Update Sidebar Active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Update Visible View Panel
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${viewId}`);
    });

    // Update Header Titles
    const titles = {
      // User Views
      dashboard: { title: 'Dashboard Overview', sub: 'Real-time wealth tracking & spending velocity' },
      transactions: { title: 'Transactions Ledger', sub: 'Audited log of inflows, expenses & transfers' },
      budgets: { title: 'Budgets & Overspend Alerts', sub: 'Monthly targets with burn rate projections' },
      analytics: { title: 'Financial Analytics & Insights', sub: 'Cash flow dynamics, category shares & trends' },
      accounts: { title: 'Multi-Account Portfolio', sub: 'Liquid assets, credit cards & investment tracking' },
      recurring: { title: 'Recurring Bills & Subscriptions', sub: 'Upcoming bill alerts and 1-click ledger logging' },
      goals: { title: 'Savings Goals & Discipline', sub: 'Target-based saving & gamified discipline streaks' },
      settings: { title: 'Data Export & System Settings', sub: 'CSV/JSON backup, printable statement & storage' },
      // Admin Views
      'admin-dashboard': { title: 'Administrator Control Center', sub: 'Platform overview, user traffic & liquidity metrics' },
      'admin-users': { title: 'User Account Management', sub: 'Role permissions, account statuses & security controls' },
      'admin-categories': { title: 'Global System Taxonomy', sub: 'Platform categories, icon sets & color palettes' },
      'admin-analytics': { title: 'Macro Platform Telemetry', sub: 'System volume, storage efficiency & performance metrics' },
      'admin-logs': { title: 'Security & Audit Trails', sub: 'Live platform security logs, logins & ledger modifications' }
    };

    const titleEl = document.getElementById('headerTitle');
    const subEl = document.getElementById('headerSubtitle');
    if (titleEl && subEl && titles[viewId]) {
      titleEl.textContent = titles[viewId].title;
      subEl.textContent = titles[viewId].sub;
    }

    this.refreshActiveViews();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  refreshActiveViews() {
    this.refreshKPIs();
    if (this.currentView.startsWith('admin-')) {
      adminManager.refreshAll();
    } else {
      txManager.render();
      budgetManager.render();
      accountsManager.render();
      recurringManager.render();
      goalsManager.render();
      chartManager.initOrUpdateAll();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  refreshKPIs() {
    const stats = store.getCurrentMonthStats();
    const netWorth = store.getNetWorth();

    const nwEl = document.getElementById('kpiNetWorth');
    const incEl = document.getElementById('kpiMonthIncome');
    const expEl = document.getElementById('kpiMonthExpenses');
    const rateEl = document.getElementById('kpiSavingsRate');
    const savedEl = document.getElementById('kpiNetSavings');

    if (nwEl) nwEl.textContent = store.formatCurrency(netWorth);
    if (incEl) incEl.textContent = `+${store.formatCurrency(stats.totalIncome)}`;
    if (expEl) expEl.textContent = `-${store.formatCurrency(stats.totalExpenses)}`;
    if (rateEl) rateEl.textContent = `${stats.savingsRate}%`;
    if (savedEl) savedEl.textContent = `${stats.netSavings >= 0 ? '+' : ''}${store.formatCurrency(stats.netSavings)} saved`;
  }

  // --- HEADER & GLOBAL CONTROLS ---
  setupGlobalControls() {
    // Currency Selector
    const currSelect = document.getElementById('currencySelect');
    if (currSelect) {
      currSelect.value = store.getState().preferences.currency || 'INR';
      currSelect.addEventListener('change', (e) => {
        store.setPreference('currency', e.target.value);
        audio.playClick();
        this.showToast(`Currency set to ${e.target.value}`, 'info');
        this.refreshActiveViews();
      });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = store.getState().preferences.theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        store.setPreference('theme', next);
        audio.playClick();
        chartManager.initOrUpdateAll();
      });
    }

    // Sound Toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const current = store.getState().preferences.soundEnabled !== false;
        store.setPreference('soundEnabled', !current);
        soundBtn.innerHTML = !current ? '<i data-lucide="volume-2" class="w-4 h-4"></i>' : '<i data-lucide="volume-x" class="w-4 h-4"></i>';
        if (window.lucide) window.lucide.createIcons();
        this.showToast(!current ? 'Sound effects enabled' : 'Sound effects muted', 'info');
      });
    }

    // Quick Add Transaction Button
    const quickAddBtn = document.getElementById('quickAddTxBtn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.openTransactionModal());
    }

    // Receipt Scanner Button
    const scannerBtn = document.getElementById('openScannerBtn');
    if (scannerBtn) {
      scannerBtn.addEventListener('click', () => this.openScannerModal());
    }

    // Transaction Filters bindings
    const searchInput = document.getElementById('txSearchInput');
    const typeFilter = document.getElementById('txTypeFilter');
    const catFilter = document.getElementById('txCategoryFilter');
    const accFilter = document.getElementById('txAccountFilter');
    const dateFilter = document.getElementById('txDateFilter');

    if (searchInput) searchInput.addEventListener('input', (e) => txManager.setFilter('search', e.target.value));
    if (typeFilter) typeFilter.addEventListener('change', (e) => txManager.setFilter('type', e.target.value));
    if (catFilter) catFilter.addEventListener('change', (e) => txManager.setFilter('categoryId', e.target.value));
    if (accFilter) accFilter.addEventListener('change', (e) => txManager.setFilter('accountId', e.target.value));
    if (dateFilter) dateFilter.addEventListener('change', (e) => txManager.setFilter('dateRange', e.target.value));

    // Batch Delete Transactions Button
    const batchBtn = document.getElementById('txBatchDeleteBtn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => txManager.deleteSelected());
    }

    const selectAllCheckbox = document.getElementById('txSelectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => txManager.toggleSelectAll(e.target.checked));
    }

    // JSON Backup Restore file input
    const jsonInput = document.getElementById('jsonImportInput');
    if (jsonInput) {
      jsonInput.addEventListener('change', (e) => exportManager.importJSON(e));
    }
  }

  // --- AUTH CONTROLS & DROPDOWN ---
  setupAuthControls() {
    const profileBtn = document.getElementById('userProfileBtn');
    const dropdownMenu = document.getElementById('userDropdownMenu');

    if (profileBtn && dropdownMenu) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
        audio.playClick();
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !profileBtn.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
          auth.login({ email, password });
          audio.playSuccess();
        } catch (err) {
          audio.playError?.();
          this.showToast(err.message, 'danger');
        }
      });
    }

    // Signup Form Submit
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const role = document.getElementById('signupRole').value;
        const currency = document.getElementById('signupCurrency').value;

        try {
          auth.signup({ name, email, password, role, currency });
          audio.playSuccess();
        } catch (err) {
          audio.playError?.();
          this.showToast(err.message, 'danger');
        }
      });
    }
  }

  closeUserDropdown() {
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.add('hidden');
  }

  openAuthModal() {
    this.closeUserDropdown();
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('active');
      this.switchAuthTab('login');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  switchAuthTab(tab) {
    const loginBtn = document.getElementById('authTabLogin');
    const signupBtn = document.getElementById('authTabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (tab === 'login') {
      loginBtn?.classList.add('active');
      signupBtn?.classList.remove('active');
      loginForm?.classList.remove('hidden');
      signupForm?.classList.add('hidden');
    } else {
      loginBtn?.classList.remove('active');
      signupBtn?.classList.add('active');
      loginForm?.classList.add('hidden');
      signupForm?.classList.remove('hidden');
    }
    audio.playClick();
  }

  fillQuickAuth(email, password) {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    if (emailInput && passInput) {
      emailInput.value = email;
      passInput.value = password;
      audio.playClick();
    }
  }

  handleLogout() {
    this.closeUserDropdown();
    auth.logout();
  }

  openVivaModal() {
    this.closeUserDropdown();
    const modal = document.getElementById('vivaModal');
    if (modal) {
      modal.classList.add('active');
      audio.playClick();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  openAdminUserModal() {
    const modal = document.getElementById('adminUserModal');
    const form = document.getElementById('adminCreateUserForm');
    if (modal && form) {
      form.reset();
      modal.classList.add('active');
      audio.playClick();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  setupAdminModals() {
    // Admin Create User Form
    const adminUserForm = document.getElementById('adminCreateUserForm');
    if (adminUserForm) {
      adminUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('admNewName').value;
        const email = document.getElementById('admNewEmail').value;
        const role = document.getElementById('admNewRole').value;
        const currency = document.getElementById('admNewCurrency').value;
        const password = document.getElementById('admNewPassword').value;

        try {
          const newUser = auth.adminCreateUser({ name, email, role, currency, password });
          store.addAuditLog('ADMIN_CREATE_USER', `Administrator created user ${newUser.name} (${newUser.email})`, auth.getCurrentUser()?.name, 'SUCCESS');
          audio.playSuccess();
          this.showToast(`User ${newUser.name} created successfully.`, 'success');
          this.closeAllModals();
          adminManager.renderUsersTable();
          adminManager.renderDashboard();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    // Admin Category Form
    const adminCatForm = document.getElementById('adminCategoryForm');
    if (adminCatForm) {
      adminCatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('adminCatId').value;
        const name = document.getElementById('adminCatName').value;
        const type = document.getElementById('adminCatType').value;
        const color = document.getElementById('adminCatColor').value;
        const icon = document.getElementById('adminCatIcon').value;

        if (id) {
          store.updateGlobalCategory(id, { name, type, color, icon });
          this.showToast('Global category updated.', 'success');
        } else {
          store.addGlobalCategory({ name, type, color, icon });
          this.showToast('New global category added.', 'success');
        }

        audio.playSuccess();
        this.closeAllModals();
        adminManager.renderCategoriesTable();
        adminManager.renderDashboard();
        this.populateSelects();
      });
    }
  }

  // --- MODALS & FORMS ---
  setupModalsAndForms() {
    // Backdrop click to close modals
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeAllModals();
      });
    });

    // Transaction Modal Submit
    const txForm = document.getElementById('txForm');
    if (txForm) {
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTransactionSubmit();
      });

      // Type toggles in Tx modal
      document.querySelectorAll('.tx-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tx-type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const type = btn.dataset.type;
          document.getElementById('txFormType').value = type;

          const toAccGroup = document.getElementById('txToAccountGroup');
          const catGroup = document.getElementById('txCategoryGroup');

          if (type === 'transfer') {
            toAccGroup?.classList.remove('hidden');
            catGroup?.classList.add('hidden');
          } else {
            toAccGroup?.classList.add('hidden');
            catGroup?.classList.remove('hidden');
          }
          audio.playClick();
        });
      });
    }

    // Transfer Modal Submit
    const transferForm = document.getElementById('transferForm');
    if (transferForm) {
      transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTransferSubmit();
      });
    }

    // Budget Form Submit
    const budgetForm = document.getElementById('budgetForm');
    if (budgetForm) {
      budgetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        budgetManager.handleSubmit();
      });
    }

    // Account Form Submit
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
      accountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        accountsManager.handleSubmit();
      });
    }

    // Recurring Form Submit
    const recurringForm = document.getElementById('recurringForm');
    if (recurringForm) {
      recurringForm.addEventListener('submit', (e) => {
        e.preventDefault();
        recurringManager.handleSubmit();
      });
    }

    // Goal Form Submit
    const goalForm = document.getElementById('goalForm');
    if (goalForm) {
      goalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goalsManager.handleSubmit();
      });
    }

    // Goal Contribution Submit
    const contribForm = document.getElementById('contributeForm');
    if (contribForm) {
      contribForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goalsManager.handleContributeSubmit();
      });
    }
  }

  // --- TRANSACTION HANDLERS ---
  openTransactionModal(txId = null) {
    const modal = document.getElementById('txModal');
    const form = document.getElementById('txForm');
    const title = document.getElementById('txModalTitle');
    const submitBtn = document.getElementById('txFormSubmitBtn');

    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('txFormDate').value = todayStr;

    if (txId) {
      const tx = store.getState().transactions.find(t => t.id === txId);
      if (tx) {
        document.getElementById('txFormId').value = tx.id;
        document.getElementById('txFormAmount').value = tx.amount;
        document.getElementById('txFormMerchant').value = tx.merchant || tx.description;
        document.getElementById('txFormDate').value = tx.date;
        document.getElementById('txFormCategory').value = tx.categoryId;
        document.getElementById('txFormAccount').value = tx.accountId;
        document.getElementById('txFormTags').value = (tx.tags || []).join(', ');
        document.getElementById('txFormNotes').value = tx.notes || '';
        document.getElementById('txFormType').value = tx.type;

        document.querySelectorAll('.tx-type-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.type === tx.type);
        });

        title.textContent = 'Edit Transaction';
        submitBtn.textContent = 'Update Transaction';
      }
    } else {
      document.getElementById('txFormId').value = '';
      title.textContent = 'Add New Transaction';
      submitBtn.textContent = 'Save Transaction';
      document.querySelectorAll('.tx-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'expense');
      });
      document.getElementById('txFormType').value = 'expense';
      document.getElementById('txToAccountGroup')?.classList.add('hidden');
      document.getElementById('txCategoryGroup')?.classList.remove('hidden');
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openTxModal(txId = null) {
    this.openTransactionModal(txId);
  }

  handleTransactionSubmit() {
    const id = document.getElementById('txFormId').value;
    const type = document.getElementById('txFormType').value;
    const amount = parseFloat(document.getElementById('txFormAmount').value);
    const merchant = document.getElementById('txFormMerchant').value.trim();
    const date = document.getElementById('txFormDate').value;
    const accountId = document.getElementById('txFormAccount').value;
    const categoryId = type === 'transfer' ? 'cat_transfer' : document.getElementById('txFormCategory').value;
    const toAccountId = type === 'transfer' ? document.getElementById('txFormToAccount').value : null;
    const tagsRaw = document.getElementById('txFormTags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const notes = document.getElementById('txFormNotes').value.trim();

    if (!amount || isNaN(amount) || amount <= 0) {
      this.showToast('Please enter a valid amount greater than 0', 'danger');
      return;
    }

    const txData = {
      description: merchant,
      merchant,
      amount,
      type,
      date,
      categoryId,
      accountId,
      toAccountId,
      tags,
      notes
    };

    if (id) {
      store.updateTransaction(id, txData);
      this.showToast('Transaction updated successfully', 'success');
      audio.playSuccess();
    } else {
      store.addTransaction(txData);
      this.showToast('Transaction recorded to ledger', 'success');
      audio.playCoin();
    }

    this.closeAllModals();
    this.refreshActiveViews();
  }

  // --- TRANSFER MODAL ---
  openTransferModal() {
    const modal = document.getElementById('transferModal');
    const form = document.getElementById('transferForm');
    if (!modal || !form) return;

    form.reset();
    this.populateSelects();

    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
    audio.playClick();
  }

  handleTransferSubmit() {
    const fromAcc = document.getElementById('transferFromAccount').value;
    const toAcc = document.getElementById('transferToAccount').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const date = document.getElementById('transferDate').value;
    const notes = document.getElementById('transferNotes').value.trim();

    if (fromAcc === toAcc) {
      this.showToast('Source and destination accounts must be different', 'warning');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid transfer amount', 'danger');
      return;
    }

    const fromAccObj = store.getAccountById(fromAcc);
    const toAccObj = store.getAccountById(toAcc);

    store.addTransaction({
      description: `Transfer to ${toAccObj.name}`,
      merchant: `Transfer: ${fromAccObj.name} â†’ ${toAccObj.name}`,
      amount,
      type: 'transfer',
      categoryId: 'cat_transfer',
      accountId: fromAcc,
      toAccountId: toAcc,
      date,
      notes,
      tags: ['transfer', 'internal']
    });

    audio.playSuccess();
    this.showToast(`Transferred ${store.formatCurrency(amount)} successfully`, 'success');
    this.closeAllModals();
    this.refreshActiveViews();
  }

  // --- MODAL UTILITIES ---
  openBudgetModal(categoryId = null) {
    const modal = document.getElementById('budgetModal');
    const form = document.getElementById('budgetForm');
    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    if (categoryId) {
      const budget = store.getState().budgets.find(b => b.categoryId === categoryId);
      if (budget) {
        document.getElementById('budgetCategorySelect').value = budget.categoryId;
        document.getElementById('budgetLimitInput').value = budget.limit;
        document.getElementById('budgetThresholdInput').value = budget.alertThreshold || 80;
      }
    }
    modal.classList.add('active');
    audio.playClick();
  }

  openAccountModal(accId = null) {
    const modal = document.getElementById('accountModal');
    const form = document.getElementById('accountForm');
    const title = document.getElementById('accountModalTitle');
    if (!modal || !form) return;
    form.reset();

    if (accId) {
      const acc = store.getState().accounts.find(a => a.id === accId);
      if (acc) {
        document.getElementById('accountFormId').value = acc.id;
        document.getElementById('accFormName').value = acc.name;
        document.getElementById('accFormType').value = acc.type;
        document.getElementById('accFormBalance').value = acc.balance;
        document.getElementById('accFormInstitution').value = acc.institution || '';
        document.getElementById('accFormNumber').value = acc.accountNumber || '';
        title.textContent = 'Edit Account';
      }
    } else {
      document.getElementById('accountFormId').value = '';
      title.textContent = 'Add Financial Account';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openRecurringModal(recId = null) {
    const modal = document.getElementById('recurringModal');
    const form = document.getElementById('recurringForm');
    const title = document.getElementById('recurringModalTitle');
    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('recFormNextDate').value = todayStr;

    if (recId) {
      const rec = store.getState().recurringBills.find(r => r.id === recId);
      if (rec) {
        document.getElementById('recFormId').value = rec.id;
        document.getElementById('recFormName').value = rec.name;
        document.getElementById('recFormAmount').value = rec.amount;
        document.getElementById('recFormFrequency').value = rec.frequency;
        document.getElementById('recFormCategory').value = rec.categoryId;
        document.getElementById('recFormAccount').value = rec.accountId;
        document.getElementById('recFormNextDate').value = rec.nextDueDate;
        title.textContent = 'Edit Recurring Subscription';
      }
    } else {
      document.getElementById('recFormId').value = '';
      title.textContent = 'Add Recurring Subscription';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openGoalModal(goalId = null) {
    const modal = document.getElementById('goalModal');
    const form = document.getElementById('goalForm');
    const title = document.getElementById('goalModalTitle');
    if (!modal || !form) return;
    form.reset();

    if (goalId) {
      const g = store.getState().goals.find(goal => goal.id === goalId);
      if (g) {
        document.getElementById('goalFormId').value = g.id;
        document.getElementById('goalFormName').value = g.name;
        document.getElementById('goalFormTarget').value = g.targetAmount;
        document.getElementById('goalFormCurrent').value = g.currentAmount;
        document.getElementById('goalFormDate').value = g.targetDate || '';
        document.getElementById('goalFormCategory').value = g.category || '';
        document.getElementById('goalFormNotes').value = g.notes || '';
        title.textContent = 'Edit Savings Goal';
      }
    } else {
      document.getElementById('goalFormId').value = '';
      title.textContent = 'Create Savings Goal';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openScannerModal() {
    const modal = document.getElementById('scannerModal');
    if (modal) {
      modal.classList.add('active');
      audio.playClick();
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    this.closeUserDropdown();
  }

  // --- POPULATE SELECT DROPDOWNS ---
  populateSelects() {
    const state = store.getState();

    // 1. Transaction Form Category Select
    const txCatSelect = document.getElementById('txFormCategory');
    if (txCatSelect) {
      txCatSelect.innerHTML = state.categories
        .filter(c => c.type !== 'transfer')
        .map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`)
        .join('');
    }

    // 2. Transaction Filter Category Select
    const txFilterCatSelect = document.getElementById('txCategoryFilter');
    if (txFilterCatSelect) {
      txFilterCatSelect.innerHTML = '<option value="all">All Categories</option>' + state.categories
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }

    // 3. Transaction Form Account Select
    const txAccSelect = document.getElementById('txFormAccount');
    if (txAccSelect) {
      txAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance, a.currency)})</option>`)
        .join('');
    }

    // 4. Transaction Form ToAccount Select (Transfers)
    const txToAccSelect = document.getElementById('txFormToAccount');
    if (txToAccSelect) {
      txToAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 5. Transaction Filter Account Select
    const txFilterAccSelect = document.getElementById('txAccountFilter');
    if (txFilterAccSelect) {
      txFilterAccSelect.innerHTML = '<option value="all">All Accounts</option>' + state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 6. Transfer Wizard From & To
    const transFromSelect = document.getElementById('transferFromAccount');
    const transToSelect = document.getElementById('transferToAccount');
    if (transFromSelect && transToSelect) {
      const accOptions = state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance)})</option>`)
        .join('');
      transFromSelect.innerHTML = accOptions;
      transToSelect.innerHTML = accOptions;
      if (state.accounts.length > 1) {
        transToSelect.selectedIndex = 1;
      }
    }

    // 7. Budget Category Select
    const budgetCatSelect = document.getElementById('budgetCategorySelect');
    if (budgetCatSelect) {
      budgetCatSelect.innerHTML = state.categories
        .filter(c => c.type === 'expense')
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }

    // 8. Recurring Category & Account Select
    const recCatSelect = document.getElementById('recFormCategory');
    const recAccSelect = document.getElementById('recFormAccount');
    if (recCatSelect) {
      recCatSelect.innerHTML = state.categories
        .filter(c => c.type === 'expense')
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }
    if (recAccSelect) {
      recAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 9. Goal Contribution Account Select
    const contribAccSelect = document.getElementById('contribFromAccount');
    if (contribAccSelect) {
      contribAccSelect.innerHTML = '<option value="">None (Don\'t debit account)</option>' + state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance)})</option>`)
        .join('');
    }
  }

  // --- KEYBOARD SHORTCUTS ---
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape closes all modals
      if (e.key === 'Escape') {
        this.closeAllModals();
        return;
      }

      // Don't trigger shortcuts if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.openTransactionModal();
      } else if (e.key === '/') {
        e.preventDefault();
        const search = document.getElementById('txSearchInput');
        if (search) {
          this.navigate('transactions');
          search.focus();
        }
      }
    });
  }

  // --- THEME & TOAST ENGINE ---
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type === 'danger' ? 'error' : type}`;

    const iconMap = {
      success: 'check-circle-2',
      danger: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info'
    };

    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="${iconMap[type] || 'info'}" class="w-4 h-4"></i>
        <span class="text-xs font-semibold text-foreground">${message}</span>
      </div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  resetDemoData() {
    if (confirm('Are you sure you want to reset your ledger data to default sample transactions?')) {
      store.resetToDemoData();
      audio.playSuccess();
      this.showToast('Demo data reloaded successfully', 'success');
      this.refreshActiveViews();
    }
  }
}

// Instantiate and expose globally
const app = new App();
window.app = app;


// Global Window Aliases for Event Handlers & Onclick Bindings
window.audio = audio;
window.auth = auth;
window.store = store;
window.admin = adminManager;
window.adminManager = adminManager;
window.chartManager = chartManager;
window.txManager = txManager;
window.budgetManager = budgetManager;
window.accountsManager = accountsManager;
window.recurringManager = recurringManager;
window.goalsManager = goalsManager;
window.receiptScanner = receiptScanner;
window.exportManager = exportManager;
window.app = app;

// Auto-initialize Lucide Icons on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.lucide) window.lucide.createIcons();
    });
} else {
    if (window.lucide) window.lucide.createIcons();
}
