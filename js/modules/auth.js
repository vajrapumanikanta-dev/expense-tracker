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

export const auth = new AuthService();
window.auth = auth;
