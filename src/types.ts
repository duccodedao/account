export interface AdminPermissions {
  manageUsers: boolean;
  managePasswords: boolean;
  manageTabs: boolean;
  viewLogs: boolean;
  manageSettings: boolean;
  manageUserTabs: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  isSuperAdmin?: boolean;
  permissions?: AdminPermissions;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  isLocked: boolean;
  isDisabled?: boolean;
  isUnlimited?: boolean;
  lastIp?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  firstLogin?: string;
  lastLogin?: string;
  accessKey?: string;
  numberID?: string;
  secondaryPassword?: string;
  isFirstLogin?: boolean;
  status?: 'active' | 'locked';
  shareLocation?: boolean;
  logActivity?: boolean;
}

export interface PasswordEntry {
  id?: string;
  website: string;
  username: string;
  password: string; // Encrypted
  notes?: string;
  tabId?: string; // 'general' or specific tab ID
  isPinned?: boolean; // Legacy
  pinnedBy?: string[]; // Array of user IDs who pinned this
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordTab {
  id: string;
  name: string;
  password: string; // Encrypted
  createdAt: string;
  isHidden?: boolean;
}

export interface ActivityLog {
  id?: string;
  uid: string;
  email: string;
  action: 'login' | 'copy_password' | 'access_web' | 'logout' | 'view_password';
  details: string;
  timestamp: string;
  ip?: string;
}

export interface ContactMethod {
  id: string;
  type: 'phone' | 'email' | 'facebook' | 'telegram' | 'zalo' | 'other';
  label: string;
  value: string;
}

export interface SystemSettings {
  numberID: string;
  passwordLevel2: string;
  specialPassword?: string;
  specialPasswordHint?: string;
  isMaintenance: boolean;
  blockedIps?: string[];
  contactMethods?: ContactMethod[];
}

export interface UserTab {
  id: string;
  name: string;
  ownerId: string;
  password: string; // Encrypted
  createdAt: string;
}
