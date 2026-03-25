export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
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
  status?: 'active' | 'locked';
}

export interface PasswordEntry {
  id?: string;
  website: string;
  username: string;
  password: string; // Encrypted
  notes?: string;
  tabId?: string; // 'general' or specific tab ID
  isPinned?: boolean;
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
  otp: string;
  passwordLevel2: string;
  specialPassword?: string;
  specialPasswordHint?: string;
  isMaintenance: boolean;
  blockedIps?: string[];
  contactMethods?: ContactMethod[];
}
