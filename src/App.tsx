import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  where,
  limit
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { 
  UserProfile, 
  PasswordEntry, 
  ActivityLog, 
  SystemSettings,
  ContactMethod,
  PasswordTab,
  UserTab,
  AdminPermissions,
  SupportRequest,
  AppNotification
} from './types';
import { encrypt, decrypt } from './lib/crypto';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { 
  Shield, 
  LogOut, 
  Key, 
  Users, 
  History, 
  Settings, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  ExternalLink, 
  Check,
  Edit2,
  Unlock,
  ShieldCheck,
  X,
  Download, 
  Upload, 
  Lock, 
  Clock, 
  Menu, 
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Phone,
  Mail,
  Facebook,
  Send,
  MessageCircle,
  Link,
  Globe,
  FolderLock,
  FolderOpen,
  Star,
  ArchiveRestore,
  FolderKey,
  User as UserIcon,
  Monitor,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  UserCheck,
  UserX,
  Save,
  QrCode,
  Smartphone,
  Bell,
  BellOff,
  UserCog,
  PlusCircle,
  Zap,
  CheckCircle,
  XCircle,
  Filter,
  AlertCircle,
  MessageSquare,
  LifeBuoy,
  UserPlus,
  MapPin,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isAfter, isBefore, parseISO, isValid } from 'date-fns';

// --- UTILS ---
const safeParseISO = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    const parsed = parseISO(dateVal);
    return isValid(parsed) ? parsed : new Date();
  }
  if (dateVal && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  return new Date();
};

const ensureString = (val: any, fallback: string = ''): string => {
  if (typeof val === 'string') return val;
  if (val && typeof val.toISOString === 'function') return val.toISOString();
  if (val && typeof val.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
};

const calculatePasswordStrength = (password: string): { score: number, label: string, color: string } => {
  let score = 0;
  if (!password) return { score: 0, label: 'Chưa nhập', color: 'bg-surface' };
  if (password.length > 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Yếu', color: 'bg-red-500' };
  if (score === 2 || score === 3) return { score, label: 'Trung bình', color: 'bg-yellow-500' };
  return { score, label: 'Mạnh', color: 'bg-green-500' };
};

// Constants
const ADMIN_EMAIL = 'sonlyhongduc@gmail.com';
const ADMIN_UID = 'VYIs9XHLR9RMStwtcdwMrOIo33w1';
const SITE_LOGO = 'https://hdd.io.vn/img/bmassloadings.png';

const generateNumberID = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateAccessKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSecondaryAuthPassed, setIsSecondaryAuthPassed] = useState(false);
  
  // App State
  const [activeTab, setActiveTab] = useState<'passwords' | 'users' | 'logs' | 'settings' | 'userTabs' | 'account' | 'adminSystem' | 'support'>('passwords');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark' | 'system') || 'dark';
  });
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [passwordTabs, setPasswordTabs] = useState<PasswordTab[]>([]);
  const [userTabs, setUserTabs] = useState<UserTab[]>([]);
  const [activePasswordTab, setActivePasswordTab] = useState<string>('general');
  const [unlockedTabs, setUnlockedTabs] = useState<string[]>([]);
  const [tabPasswordInput, setTabPasswordInput] = useState('');
  const [isTabUnlockModalOpen, setIsTabUnlockModalOpen] = useState(false);
  const [isCreateUserTabModalOpen, setIsCreateUserTabModalOpen] = useState(false);
  const [editingUserTab, setEditingUserTab] = useState<UserTab | null>(null);
  const [tabToUnlock, setTabToUnlock] = useState<PasswordTab | UserTab | null>(null);
  
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [userIp, setUserIp] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  
  // Filtered Passwords based on user role
  const filteredPasswords = useMemo(() => {
    if (profile?.role === 'admin') return passwords;
    const myTabId = userTabs.find(t => t.ownerId === user?.uid)?.id;
    return passwords.filter(p => 
      !p.tabId || 
      p.tabId === 'general' || 
      passwordTabs.some(t => t.id === p.tabId) || 
      p.tabId === myTabId
    );
  }, [passwords, profile, userTabs, passwordTabs, user]);

  const isPersonalTabOwner = useMemo(() => {
    const myTab = userTabs.find(t => t.ownerId === user?.uid);
    return myTab && activePasswordTab === myTab.id;
  }, [userTabs, user, activePasswordTab]);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  // Statistics
  const stats = useMemo(() => {
    return {
      totalGeneralPasswords: filteredPasswords.filter(p => p.tabId === 'general' || !p.tabId).length,
      totalTabPasswords: filteredPasswords.filter(p => p.tabId && p.tabId !== 'general').length,
      totalUsers: users.length,
      totalLogs: logs.length,
      activeUsers: users.filter(u => !u.isDisabled && (!u.endTime || new Date(u.endTime) > new Date())).length,
      blockedIpsCount: settings?.blockedIps?.length || 0
    };
  }, [filteredPasswords, users, logs, settings]);
  
  // Secondary Auth Inputs
  const [numberIDInput, setNumberIDInput] = useState('');
  const [pass2Input, setPass2Input] = useState('');
  const [accessKeyInput, setAccessKeyInput] = useState(localStorage.getItem('rememberedAccessKey') || '');
  const [rememberKey, setRememberKey] = useState(!!localStorage.getItem('rememberedAccessKey'));
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [userTabSearchTerm, setUserTabSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<UserProfile | null>(null);
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [specialPasswordInput, setSpecialPasswordInput] = useState('');
  const [isDeletingLogs, setIsDeletingLogs] = useState(false);
  const [showSpecialPassHint, setShowSpecialPassHint] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [secretAdminClicks, setSecretAdminClicks] = useState(0);
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  const [isChangingSpecialPass, setIsChangingSpecialPass] = useState(false);
  const [oldSpecialPassInput, setOldSpecialPassInput] = useState('');
  const [newSpecialPassInput, setNewSpecialPassInput] = useState('');
  const [isGeneralUnlocked, setIsGeneralUnlocked] = useState(false);
  const [generalPasswordInput, setGeneralPasswordInput] = useState('');
  const [isChangingGeneralPass, setIsChangingGeneralPass] = useState(false);
  const [newGeneralPassInput, setNewGeneralPassInput] = useState('');
  const [oldGeneralPassInput, setOldGeneralPassInput] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [supportIssues, setSupportIssues] = useState<string[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportOtherDetail, setSupportOtherDetail] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [autoResolvedResult, setAutoResolvedResult] = useState<{
    issue: string;
    label: string;
    value: string;
  }[] | null>(null);
  
  // Notifications
  
  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);
  const [duplicateEntries, setDuplicateEntries] = useState<{ row: any, existingId: string }[]>([]);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');





  // --- LOGGING UTILITY ---
  const logActivity = useCallback(async (action: ActivityLog['action'], details: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'logs'), {
        uid: user.uid,
        email: user.email,
        action,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Logging failed:', error);
    }
  }, [user]);

  // --- WINDOW RESIZE HANDLER ---
  useEffect(() => {
    // Check for 404
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      setIsNotFound(true);
    }

    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- GEOLOCATION & IP HANDLER ---
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        setUserIp(data.ip);
      } catch (e) {
        console.error("Failed to fetch IP:", e);
      }
    };
    fetchIp();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationStatus('granted');
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          if (user && profile) {
            updateDoc(doc(db, 'users', user.uid), {
              latitude,
              longitude,
              lastIp: userIp || ''
            }).catch(console.error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationStatus('denied');
        }
      );
    } else {
      setLocationStatus('denied');
    }
  }, [user, profile, userIp]);

  useEffect(() => {
    const rememberedKey = localStorage.getItem('rememberedAccessKey');
    if (rememberedKey) {
      setAccessKeyInput(rememberedKey);
      setRememberKey(true);
    }
  }, []);

  // --- AUTH OBSERVER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email);
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const profileRef = doc(db, 'users', firebaseUser.uid);
          const profileDoc = await getDoc(profileRef);
          
          const now = new Date().toISOString();
          
          // Get location and IP
          let lat = null;
          let lon = null;
          let currentIp = '';
          try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            currentIp = ipData.ip;
            setUserIp(currentIp);
          } catch (e) {
            console.error("IP fetch error:", e);
          }

          if ("geolocation" in navigator) {
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
              });
              lat = pos.coords.latitude;
              lon = pos.coords.longitude;
              setLocationStatus('granted');
            } catch (e) {
              console.error("Geo error:", e);
              setLocationStatus('denied');
            }
          }

          const defaultProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: (firebaseUser.email === ADMIN_EMAIL || firebaseUser.uid === ADMIN_UID) ? 'admin' : 'user',
            startTime: now,
            endTime: new Date(Date.now() + 86400000).toISOString(), // 24h later
            isLocked: false,
            createdAt: now,
            firstLogin: now,
            lastLogin: now,
            accessKey: generateAccessKey(),
            numberID: generateNumberID(), // Random NumberID for first-time login
            isFirstLogin: true,
            status: 'active',
            latitude: lat,
            longitude: lon,
            lastIp: currentIp
          };

          if (profileDoc.exists()) {
            const data = profileDoc.data();
            const updatedProfile = { 
              ...data, 
              lastLogin: now,
              status: data.isDisabled ? 'locked' : (data.status || 'active'),
              isSuperAdmin: firebaseUser.email === ADMIN_EMAIL,
              latitude: lat || data.latitude,
              longitude: lon || data.longitude,
              lastIp: currentIp || data.lastIp
            } as UserProfile;
            await updateDoc(profileRef, { 
              lastLogin: now, 
              status: updatedProfile.status,
              isSuperAdmin: updatedProfile.isSuperAdmin,
              latitude: updatedProfile.latitude,
              longitude: updatedProfile.longitude,
              lastIp: updatedProfile.lastIp
            });
            setProfile(updatedProfile);
          } else {
            const profileWithSuper = {
              ...defaultProfile,
              isSuperAdmin: firebaseUser.email === ADMIN_EMAIL
            };
            await setDoc(profileRef, profileWithSuper);
            setProfile(profileWithSuper);
          }
        } else {
          setProfile(null);
          setIsSecondaryAuthPassed(false);
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("Failed to load user profile. Please check your connection.");
      } finally {
        setIsAuthReady(true);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []); // Removed logActivity dependency to prevent loop

  // Log login only when profile and secondary auth are ready
  useEffect(() => {
    if (user && isSecondaryAuthPassed) {
      logActivity('login', 'User session fully authorized');
    }
  }, [user, isSecondaryAuthPassed, logActivity]);

  // --- SYSTEM SETTINGS OBSERVER ---
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      } else {
        console.log("Settings not found, initializing default settings...");
        // Only attempt to create if we are likely the admin
        if (user?.email === ADMIN_EMAIL) {
          const initialSettings: SystemSettings = {
            numberID: '123456',
            passwordLevel2: 'admin123',
            isMaintenance: false,
          };
          setDoc(doc(db, 'system', 'settings'), initialSettings).catch(console.error);
          setSettings(initialSettings);
        }
      }
    }, (error) => {
      console.error("Settings snapshot error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // --- DATA OBSERVERS ---
  useEffect(() => {
    if (!isSecondaryAuthPassed) return;

    const qPasswords = query(collection(db, 'passwords'), orderBy('createdAt', 'desc'));
    const unsubPasswords = onSnapshot(qPasswords, (snapshot) => {
      setPasswords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PasswordEntry)));
    }, (error) => {
      console.error("Passwords snapshot error:", error);
    });

    const qTabs = query(collection(db, 'passwordTabs'), orderBy('createdAt', 'asc'));
    const unsubTabs = onSnapshot(qTabs, (snapshot) => {
      setPasswordTabs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PasswordTab)));
    }, (error) => {
      console.error("PasswordTabs snapshot error:", error);
    });

    const qUserTabs = profile?.role === 'admin'
      ? query(collection(db, 'userTabs'), orderBy('createdAt', 'asc'))
      : query(collection(db, 'userTabs'), where('ownerId', '==', user?.uid || ''));
      
    const unsubUserTabs = onSnapshot(qUserTabs, (snapshot) => {
      setUserTabs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTab)));
    }, (error) => {
      console.error("UserTabs snapshot error:", error);
    });

    let unsubUsers = () => {};
    let unsubLogs = () => {};
    let unsubSupport = () => {};

    if (profile?.role === 'admin') {
      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });

      const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      });

      const qSupport = query(collection(db, 'support_requests'), orderBy('createdAt', 'desc'));
      unsubSupport = onSnapshot(qSupport, (snapshot) => {
        setSupportRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportRequest)));
      });
    }

    return () => {
      unsubPasswords();
      unsubTabs();
      unsubUserTabs();
      unsubUsers();
      unsubLogs();
      unsubSupport();
    };
  }, [isSecondaryAuthPassed, profile, user?.uid]);

  // --- ACCESS CHECKER ---
  useEffect(() => {
    // Removed automatic logout for locked users to allow persistent locked screen
  }, [profile]);

  // --- IP BLOCK CHECKER ---
  useEffect(() => {
    if (settings?.blockedIps?.includes(userIp) && profile?.role !== 'admin') {
      toast.error('Địa chỉ IP của bạn đã bị chặn truy cập hệ thống.');
      handleLogout();
    }
  }, [settings, userIp, profile]);

  // --- MAINTENANCE CHECKER ---
  useEffect(() => {
    if (settings?.isMaintenance && profile?.role !== 'admin') {
      toast.warning('System is under maintenance.');
      handleLogout();
    }
  }, [settings, profile]);

  // --- ANTI-SCREENSHOT ---
  useEffect(() => {
    if (!isSecondaryAuthPassed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        toast.error('Cảnh báo: Không được phép chụp màn hình!', { duration: 5000 });
        logActivity('access_web', 'Cảnh báo: Cố gắng chụp màn hình (PrintScreen)');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
        toast.error('Cảnh báo: Không được phép chụp màn hình!', { duration: 5000 });
        logActivity('access_web', 'Cảnh báo: Cố gắng chụp màn hình (Phím tắt)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSecondaryAuthPassed, logActivity]);

  // --- AUTO-LOCK (SESSION TIMEOUT) ---
  useEffect(() => {
    if (!isSecondaryAuthPassed) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // 5 minutes timeout
      timeoutId = setTimeout(() => {
        setIsSecondaryAuthPassed(false);
        toast.info('Phiên làm việc đã hết hạn do không hoạt động');
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimeout);
      });
    };
  }, [isSecondaryAuthPassed]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Google Login Successful');
    } catch (error) {
      toast.error('Login failed');
    }
  };

  const handleLogout = async () => {
    if (user) {
      await logActivity('logout', 'User logged out');
    }
    if (profile?.role === 'admin') {
      localStorage.removeItem('admin_session_passed');
    }
    await signOut(auth);
    setIsSecondaryAuthPassed(false);
    setProfile(null);
    toast.info('Logged out');
  };

  useEffect(() => {
    if (profile?.role === 'admin' && localStorage.getItem('admin_session_passed') === 'true') {
      setIsSecondaryAuthPassed(true);
    }
  }, [profile]);

  const handleSecondaryAuth = async () => {
    if (!settings || !profile) return;

    if (profile.status === 'locked') {
      toast.error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để mở lại.');
      return;
    }

    const userNumberID = profile.numberID || settings.numberID;
    const userPass2 = profile.secondaryPassword || '';
    const isPass2Required = !!userPass2;

    let isNumberIDCorrect = numberIDInput === userNumberID;
    let isPass2Correct = !isPass2Required || pass2Input === userPass2;
    const isKeyCorrect = accessKeyInput === profile.accessKey;

    // Admin master credentials logic
    if (profile.role === 'admin') {
      if (numberIDInput === settings.numberID) isNumberIDCorrect = true;
      if (pass2Input === settings.passwordLevel2) isPass2Correct = true;
    }

    if (isNumberIDCorrect && isPass2Correct && isKeyCorrect) {
      // Success - reset failed attempts
      if (profile.failedAttempts && profile.failedAttempts > 0) {
        await updateDoc(doc(db, 'users', user!.uid), { failedAttempts: 0 });
      }
      
      // Request geolocation on every successful secondary auth
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            if (user) {
              await updateDoc(doc(db, 'users', user.uid), {
                latitude,
                longitude,
                lastIp: userIp
              });
              setProfile(prev => prev ? { ...prev, latitude, longitude, lastIp: userIp, failedAttempts: 0 } : null);
            }
          },
          (error) => {
            console.error("Geolocation error during login:", error);
          }
        );
      }

      if (rememberKey) {
        localStorage.setItem('rememberedAccessKey', accessKeyInput);
      } else {
        localStorage.removeItem('rememberedAccessKey');
      }

      if (profile.role === 'admin') {
        localStorage.setItem('admin_session_passed', 'true');
      }

      if (profile.isFirstLogin) {
        // We will update isFirstLogin to false after they enter phone number in the modal
        setShowFirstLoginModal(true);
      }

      setIsSecondaryAuthPassed(true);
      toast.success('Truy cập thành công');
      logActivity('login', 'Secondary Auth Passed');
    } else {
      const currentAttempts = profile.failedAttempts || 0;
      const newAttempts = currentAttempts + 1;
      const updates: any = { failedAttempts: newAttempts };
      
      if (newAttempts >= 5) {
        updates.status = 'locked';
        toast.error('Bạn đã nhập sai 5 lần. Tài khoản đã bị khóa tự động.');
      } else {
        let errorMsg = 'Sai thông tin xác thực';
        if (!isNumberIDCorrect) errorMsg = 'Sai mã NumberID';
        else if (!isPass2Correct) errorMsg = 'Sai mật khẩu cấp 2';
        else if (!isKeyCorrect) errorMsg = 'Sai mã truy cập (Key)';
        
        toast.error(`${errorMsg}. Bạn còn ${5 - newAttempts} lần thử.`);
      }
      
      await updateDoc(doc(db, 'users', user!.uid), updates);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleCopyPassword = (entry: PasswordEntry) => {
    const realPass = decrypt(entry.password);
    navigator.clipboard.writeText(realPass);
    toast.success('Password copied to clipboard');
    logActivity('copy_password', `Đã sao chép mật khẩu cho ${entry.website} (${entry.username})`);
  };

  const handleSavePassword = async (website: string, username: string, password: string, notes: string) => {
    if (!website || !username || !password) return;

    try {
      if (editingPassword && editingPassword.id) {
        await updateDoc(doc(db, 'passwords', editingPassword.id), {
          website,
          username,
          password: encrypt(password),
          notes: notes || '',
          tabId: activePasswordTab,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Cập nhật mật khẩu thành công');
      } else {
        await addDoc(collection(db, 'passwords'), {
          website,
          username,
          password: encrypt(password),
          notes: notes || '',
          tabId: activePasswordTab,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Thêm mật khẩu thành công');
      }
      setEditingPassword(null);
      (document.getElementById('add-modal') as any)?.close();
    } catch (error) {
      toast.error('Không thể lưu mật khẩu');
    }
  };

  const handleDeletePassword = async (id: string) => {
    try {
      await updateDoc(doc(db, 'passwords', id), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      toast.success('Đã chuyển mật khẩu vào thùng rác');
    } catch (error) {
      toast.error('Xóa thất bại');
    }
  };

  const handleHardDeletePassword = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'passwords', id));
      toast.success('Đã xóa vĩnh viễn mật khẩu');
    } catch (error) {
      toast.error('Xóa thất bại');
    }
  };

  const handleSubmitSupport = async (customIssues?: string[]) => {
    const issuesToSubmit = customIssues || supportIssues;
    if (issuesToSubmit.length === 0) return;
    setIsSubmittingSupport(true);

    // Auto-resolve logic: Compare entered phone number with profile phone number
    // For new users requesting a key, we also auto-resolve
    const isNewUserRequestingKey = !profile?.phoneNumber && issuesToSubmit.includes('request_key') && issuesToSubmit.length === 1;
    const canAutoResolve = profile && !issuesToSubmit.includes('other') && (phoneNumberInput === profile.phoneNumber || isNewUserRequestingKey);
    let resolvedData: { issue: string, label: string, value: string }[] = [];
    let updatedProfileData: Partial<UserProfile> = {};

    if (canAutoResolve) {
      for (const issueId of issuesToSubmit) {
        if (issueId === 'forgot_numberid') {
          resolvedData.push({ issue: issueId, label: 'NumberID của bạn', value: profile.numberID || 'Chưa có' });
        } else if (issueId === 'forgot_pass2') {
          const newPass = Math.floor(100000 + Math.random() * 900000).toString();
          updatedProfileData.secondaryPassword = newPass;
          resolvedData.push({ issue: issueId, label: 'Mật khẩu cấp 2 mới', value: newPass });
        } else if (issueId === 'forgot_accesskey' || issueId === 'request_key') {
          const newKey = generateAccessKey();
          updatedProfileData.accessKey = newKey;
          resolvedData.push({ issue: issueId, label: 'Mã truy cập mới', value: newKey });
        } else if (issueId === 'forgot_tab_pass') {
          // Reset all user tabs passwords
          const myTabs = userTabs.filter(t => t.ownerId === profile.uid);
          for (const tab of myTabs) {
            const newTabPass = Math.floor(100000 + Math.random() * 900000).toString();
            await updateDoc(doc(db, 'user_tabs', tab.id), { password: newTabPass });
            resolvedData.push({ issue: issueId, label: `Mật khẩu Tab ${tab.name} mới`, value: newTabPass });
          }
        }
      }
    }

    try {
      const isAutoResolved = canAutoResolve && resolvedData.length > 0;
      
      if (isAutoResolved && Object.keys(updatedProfileData).length > 0) {
        await updateDoc(doc(db, 'users', profile!.uid), updatedProfileData);
      }

      const newRequest: Omit<SupportRequest, 'id'> = {
        uid: user?.uid || 'unauthenticated',
        email: user?.email || 'Guest',
        displayName: user?.displayName || 'Guest User',
        photoURL: user?.photoURL || '',
        issues: issuesToSubmit,
        otherDetail: issuesToSubmit.includes('other') ? supportOtherDetail : '',
        status: isAutoResolved ? 'auto_resolved' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        location: userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null,
        isAutoResolved: isAutoResolved
      };

      await addDoc(collection(db, 'support_requests'), newRequest);
      
      if (isAutoResolved) {
        setAutoResolvedResult(resolvedData);
        toast.success('Hệ thống đã tự động xử lý yêu cầu của bạn!');
      } else {
        toast.success('Yêu cầu hỗ trợ đã được gửi. Vui lòng chờ phản hồi từ Admin.');
        setIsSupportModalOpen(false);
      }

      setShowSupportOptions(false);
      setSupportIssues([]);
      setSupportOtherDetail('');
    } catch (error) {
      toast.error('Gửi yêu cầu thất bại. Vui lòng thử lại sau.');
      handleFirestoreError(error, OperationType.CREATE, 'support_requests');
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const handleUpdateSupportStatus = async (requestId: string, newStatus: SupportRequest['status'], message?: string) => {
    try {
      await updateDoc(doc(db, 'support_requests', requestId), {
        status: newStatus,
        adminMessage: message || '',
        updatedAt: new Date().toISOString()
      });
      toast.success('Đã cập nhật trạng thái yêu cầu');
    } catch (error) {
      console.error('Error updating support status:', error);
      toast.error('Cập nhật thất bại');
    }
  };

  const handleRestorePassword = async (id: string) => {
    try {
      await updateDoc(doc(db, 'passwords', id), {
        isDeleted: false,
        deletedAt: null
      });
      toast.success('Đã khôi phục mật khẩu');
    } catch (error) {
      toast.error('Khôi phục thất bại');
    }
  };

  const handleTogglePinPassword = async (id: string, currentPinnedBy: string[]) => {
    if (!user) return;
    try {
      const isCurrentlyPinned = currentPinnedBy.includes(user.uid);
      const newPinnedBy = isCurrentlyPinned 
        ? currentPinnedBy.filter(uid => uid !== user.uid)
        : [...currentPinnedBy, user.uid];

      await updateDoc(doc(db, 'passwords', id), {
        pinnedBy: newPinnedBy
      });
      toast.success(isCurrentlyPinned ? 'Đã bỏ ghim mật khẩu' : 'Đã ghim mật khẩu');
    } catch (error) {
      toast.error('Thao tác thất bại');
    }
  };

  const handleExportExcel = () => {
    const filteredPasswordsForExport = filteredPasswords.filter(p => {
      return activePasswordTab === 'general' ? (!p.tabId || p.tabId === 'general') : p.tabId === activePasswordTab;
    });
    const dataToExport = filteredPasswordsForExport.map(p => ({
      Website: p.website,
      Username: p.username,
      Password: decrypt(p.password),
      Notes: p.notes || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Passwords");
    XLSX.writeFile(workbook, `MatKhau_Xuat_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Đã xuất file Excel');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const duplicates: { row: any, existingId: string }[] = [];
      const validRows: any[] = [];

      for (const row of data) {
        if (row.Website && row.Username && row.Password) {
          const existing = passwords.find(p => {
            const matchesTab = activePasswordTab === 'general' ? (!p.tabId || p.tabId === 'general') : p.tabId === activePasswordTab;
            return matchesTab && 
                   p.website.toLowerCase() === row.Website.toString().toLowerCase() && 
                   p.username.toLowerCase() === row.Username.toString().toLowerCase();
          });
          
          if (existing) {
            duplicates.push({ row, existingId: existing.id! });
          } else {
            validRows.push(row);
          }
        }
      }

      if (duplicates.length > 0) {
        setPendingImportData(validRows);
        setDuplicateEntries(duplicates);
        setIsImportConfirmOpen(true);
      } else {
        // No duplicates, just import everything
        let count = 0;
        for (const row of validRows) {
          await addDoc(collection(db, 'passwords'), {
            website: row.Website,
            username: row.Username,
            password: encrypt(row.Password.toString()),
            notes: row.Notes || '',
            tabId: activePasswordTab,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          count++;
        }
        toast.success(`Đã nhập ${count} mật khẩu`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const confirmImport = async (mode: 'update' | 'create') => {
    setIsImportConfirmOpen(false);
    let count = 0;

    // First import the non-duplicates
    for (const row of pendingImportData) {
      await addDoc(collection(db, 'passwords'), {
        website: row.Website,
        username: row.Username,
        password: encrypt(row.Password.toString()),
        notes: row.Notes || '',
        tabId: activePasswordTab,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      count++;
    }

    // Then handle the duplicates
    for (const entry of duplicateEntries) {
      if (mode === 'update') {
        // Update existing (Overwrite)
        await updateDoc(doc(db, 'passwords', entry.existingId), {
          password: encrypt(entry.row.Password.toString()),
          notes: entry.row.Notes || '',
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new
        await addDoc(collection(db, 'passwords'), {
          website: entry.row.Website,
          username: entry.row.Username,
          password: encrypt(entry.row.Password.toString()),
          notes: entry.row.Notes || '',
          tabId: activePasswordTab,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      count++;
    }

    toast.success(`Đã xử lý ${count} mật khẩu`);
    setPendingImportData([]);
    setDuplicateEntries([]);
  };

  const handleUpdateUserAccess = async (uid: string, disabled: boolean, newAccessKey?: string) => {
    try {
      if (newAccessKey) {
        // Check for duplicates
        const duplicateUser = users.find(u => u.uid !== uid && u.accessKey === newAccessKey);
        if (duplicateUser) {
          toast.error('Mã truy cập này đã được sử dụng bởi người dùng khác!');
          return;
        }
      }

      const status = disabled ? 'locked' : 'active';
      const updateData: any = {
        status,
        isDisabled: disabled,
        isLocked: disabled
      };
      
      if (newAccessKey) {
        updateData.accessKey = newAccessKey;
      }

      await updateDoc(doc(db, 'users', uid), updateData);
      toast.success('Cập nhật người dùng thành công');
    } catch (error) {
      toast.error('Cập nhật thất bại');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Đã xóa người dùng');
    } catch (error) {
      toast.error('Xóa người dùng thất bại');
    }
  };

  const handleDeleteLogs = async () => {
    if (specialPasswordInput !== settings?.specialPassword) {
      toast.error('Mật khẩu đặc biệt không chính xác');
      return;
    }

    try {
      const q = query(collection(db, 'logs'));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      toast.success('Đã xóa toàn bộ nhật ký');
      setIsDeletingLogs(false);
      setSpecialPasswordInput('');
      setShowSpecialPassHint(false);
      logActivity('logout', 'Admin deleted all activity logs');
    } catch (error) {
      toast.error('Lỗi khi xóa nhật ký');
    }
  };

  const handleUpdateSettings = async (
    newNumberID: string, 
    newPass2: string, 
    maintenance: boolean, 
    blockedIps: string, 
    contactMethods: ContactMethod[], 
    specialPassword?: string, 
    specialPasswordHint?: string,
    generalPassword?: string
  ) => {
    if (!profile?.isSuperAdmin) {
      toast.error('Chỉ Admin tổng mới có quyền thay đổi cài đặt này');
      return;
    }
    try {
      const updateData: any = {
        numberID: newNumberID,
        passwordLevel2: newPass2,
        isMaintenance: maintenance,
        blockedIps: blockedIps.split(',').map(ip => ip.trim()).filter(ip => ip),
        contactMethods
      };

      if (specialPassword !== undefined) {
        updateData.specialPassword = specialPassword;
      }
      if (specialPasswordHint !== undefined) {
        updateData.specialPasswordHint = specialPasswordHint;
      }
      if (generalPassword !== undefined) {
        updateData.generalPassword = generalPassword;
      }

      await updateDoc(doc(db, 'system', 'settings'), updateData);
      toast.success('Cài đặt hệ thống đã được lưu');
    } catch (error) {
      toast.error('Lưu cài đặt thất bại');
    }
  };

  const handleUnlockTab = () => {
    if (!tabToUnlock) return;
    if (tabPasswordInput === decrypt(tabToUnlock.password)) {
      setUnlockedTabs(prev => [...prev, tabToUnlock.id]);
      setActivePasswordTab(tabToUnlock.id);
      setIsTabUnlockModalOpen(false);
      setTabPasswordInput('');
      setTabToUnlock(null);
      toast.success('Đã mở khóa tab');
    } else {
      toast.error('Mật khẩu không chính xác');
    }
  };

  // --- RENDER HELPERS ---
  const maskPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const lastTwo = phone.slice(-2);
    return `+84*******${lastTwo}`;
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-bg-main text-main">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-dim font-medium">Đang khởi tạo hệ thống...</p>
      </div>
    );
  }

  // Blocked IP Screen
  if (settings?.blockedIps?.includes(userIp) && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center border border-main">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Truy cập bị chặn</h2>
          <p className="text-dim mb-6">Địa chỉ IP ({userIp}) của bạn đã bị chặn khỏi hệ thống này.</p>
          <button onClick={() => signOut(auth)} className="btn-primary w-full py-3">Quay lại</button>
        </div>
      </div>
    );
  }

  // Location Denied Screen
  if (locationStatus === 'denied' && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center border border-main">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Yêu cầu vị trí</h2>
          <p className="text-dim mb-6">Hệ thống yêu cầu quyền truy cập vị trí để hoạt động. Vui lòng bật vị trí trong cài đặt trình duyệt và tải lại trang.</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full py-3">Tải lại trang</button>
        </div>
      </div>
    );
  }

  // User Disabled Screen
  if ((profile?.isDisabled || profile?.status === 'locked') && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main">
        <div className="max-w-md w-full glass p-10 rounded-3xl text-center shadow-2xl border border-main">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-red-500">Tài khoản bị khóa</h2>
          <p className="text-dim mb-8 leading-relaxed">
            Tài khoản của bạn đã bị vô hiệu hóa hoặc bị khóa bởi quản trị viên. 
            Vui lòng liên hệ để được hỗ trợ mở khóa.
          </p>
          
          <AdminContactInfo settings={settings} />

          <div className="mt-10 space-y-4">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-600/20"
            >
              Đăng xuất tài khoản hiện tại
            </button>
            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-main/10"></div>
              <span className="text-xs text-dim font-bold uppercase tracking-widest">Hoặc</span>
              <div className="h-px flex-1 bg-main/10"></div>
            </div>
            <button 
              onClick={() => {
                const googleProvider = new GoogleAuthProvider();
                signInWithPopup(auth, googleProvider);
              }}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-4 px-6 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Đăng nhập với Google khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 404 Screen
  if (isNotFound) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center border border-main">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-4">404</h2>
          <p className="text-dim mb-6">Trang bạn tìm kiếm không tồn tại.</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary w-full py-3">Quay lại trang chủ</button>
        </div>
      </div>
    );
  }

  // Maintenance Screen
  if (settings?.isMaintenance && profile?.role !== 'admin' && !showSecretLogin) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center border border-main">
          <Settings 
            className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-spin-slow cursor-pointer" 
            onClick={() => {
              setSecretAdminClicks(prev => prev + 1);
              if (secretAdminClicks >= 4) {
                setShowSecretLogin(true);
              }
            }}
          />
          <h2 className="text-2xl font-bold mb-4">Hệ thống bảo trì</h2>
          <p className="text-dim mb-6">Chúng tôi đang nâng cấp hệ thống. Vui lòng quay lại sau.</p>
          
          {user && (
            <div className="flex items-center justify-between p-3 bg-surface/50 rounded-xl border border-main mb-6 max-w-xs mx-auto text-left">
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                  className="w-10 h-10 rounded-full border border-main" 
                  alt="Avatar" 
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-main truncate">{user.displayName || 'Người dùng'}</span>
                  <span className="text-xs text-dim truncate">{user.email}</span>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full glass p-10 rounded-[40px] shadow-2xl border border-main relative z-10 backdrop-blur-xl flex flex-col md:flex-row gap-10"
        >
          {/* Left Side: Google Login */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-40 h-40 bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 rounded-[48px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-blue-600/30 p-2 group cursor-pointer">
              <div className="w-full h-full bg-bg-main rounded-[40px] flex items-center justify-center overflow-hidden transition-transform group-hover:scale-95">
                <img src={SITE_LOGO} className="w-24 h-24 object-contain" alt="Logo" />
              </div>
            </div>
            
            <h1 className="text-4xl font-black mb-3 tracking-tight bg-gradient-to-r from-white to-dim bg-clip-text text-transparent">Quản lý Mật khẩu</h1>
            <p className="text-dim mb-12 text-center leading-relaxed px-4 font-medium">
              Giải pháp bảo mật mật khẩu chuyên nghiệp cho doanh nghiệp và cá nhân.
            </p>

            <div className="w-full max-w-xs mx-auto space-y-6">
              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-4 bg-white text-black font-bold py-4.5 px-8 rounded-2xl hover:bg-neutral-100 transition-all active:scale-[0.98] shadow-xl shadow-black/10 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="w-6 h-6 flex items-center justify-center bg-white rounded-full shadow-sm">
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                </div>
                <span className="text-lg relative z-10">Tiếp tục với Google</span>
              </button>
            </div>
          </div>
        </motion.div>
        <Toaster position="top-center" theme={theme === 'system' ? 'dark' : theme} />
      </div>
    );
  }

  if (!isSecondaryAuthPassed) {
    return (
      <>
        <div className="h-screen w-full flex items-center justify-center p-6 bg-bg-main text-main relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full glass p-10 rounded-[40px] shadow-2xl border border-main relative z-10 backdrop-blur-xl"
          >
            {user && (
              <div className="flex items-center justify-between p-3 bg-surface/50 rounded-2xl border border-main mb-8 group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <img 
                      src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                      className="w-10 h-10 rounded-full border-2 border-blue-500/20 p-0.5 group-hover:border-blue-500/50 transition-all" 
                      alt="Avatar" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-bg-main rounded-full shadow-sm" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-main truncate">{user.displayName || 'Người dùng'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-dim truncate font-medium tracking-wide">{user.email}</span>
                      {profile?.phoneNumber && (
                        <span className="text-[10px] text-blue-400 font-bold">{maskPhoneNumber(profile.phoneNumber)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2.5 text-dim hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  title="Đăng xuất"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-black text-main tracking-tight">Xác thực bảo mật</h2>
                <p className="text-xs text-dim mt-2 font-medium">Vui lòng nhập thông tin để truy cập kho mật khẩu</p>
              </div>

              <div className="space-y-5">
                <div className="relative group">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em] mb-2 ml-1">Mã NumberID</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-blue-500 transition-all">
                      <Users className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={numberIDInput}
                      onChange={(e) => setNumberIDInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={profile?.isFirstLogin ? `Mã NumberID của bạn: ${profile?.numberID}` : "Nhập mã NumberID 6 số"}
                      className="w-full bg-surface/50 border border-main rounded-2xl pl-12 pr-4 py-4.5 text-sm text-main focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-dim/30 font-medium"
                    />
                  </div>
                  {profile?.isFirstLogin && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl"
                    >
                      <p className="text-[10px] text-blue-400 leading-relaxed font-medium">
                        Chào mừng! Mã NumberID mặc định của bạn là: <span className="font-black text-blue-300">{profile?.numberID}</span>
                      </p>
                    </motion.div>
                  )}
                </div>

                {profile?.secondaryPassword && (
                  <div className="relative group">
                    <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em] mb-2 ml-1">Mật khẩu cấp 2</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-blue-500 transition-all">
                        <Unlock className="w-5 h-5" />
                      </div>
                      <input 
                        type="password" 
                        value={pass2Input}
                        onChange={(e) => setPass2Input(e.target.value)}
                        placeholder="Nhập mật khẩu cấp 2"
                        className="w-full bg-surface/50 border border-main rounded-2xl pl-12 pr-4 py-4.5 text-sm text-main focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-dim/30 font-medium"
                      />
                    </div>
                  </div>
                )}

                <div className="relative group">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em] mb-2 ml-1">Mã truy cập (Key)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-blue-500 transition-all">
                      <Key className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      value={accessKeyInput}
                      onChange={(e) => setAccessKeyInput(e.target.value)}
                      placeholder="Nhập mã truy cập 8 ký tự"
                      className="w-full bg-surface/50 border border-main rounded-2xl pl-12 pr-4 py-4.5 text-sm text-main focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-dim/30 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4 ml-1">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        id="rememberKey" 
                        checked={rememberKey} 
                        onChange={(e) => setRememberKey(e.target.checked)}
                        className="w-5 h-5 accent-blue-500 rounded-lg border-main bg-surface cursor-pointer"
                      />
                    </div>
                    <label htmlFor="rememberKey" className="text-xs text-dim cursor-pointer font-bold hover:text-main transition-colors">Ghi nhớ mã truy cập</label>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  onClick={handleSecondaryAuth}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4.5 px-8 rounded-2xl transition-all active:scale-[0.98] shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform relative z-10" />
                  <span className="text-lg relative z-10">Xác nhận đăng nhập</span>
                </button>
              </div>

              <div className="pt-2 flex flex-col items-center gap-6">
                <button 
                  onClick={() => setIsSupportModalOpen(true)}
                  className="group relative inline-flex items-center gap-3 text-sm font-bold text-blue-400 hover:text-blue-300 transition-all px-6 py-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30 shadow-lg shadow-blue-500/5"
                >
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span>Trung tâm hỗ trợ</span>
                </button>

                <AdminContactInfo settings={settings} />
              </div>
            </div>
          </motion.div>
        </div>
        <SupportModal 
          isOpen={isSupportModalOpen}
          onClose={() => {
            setIsSupportModalOpen(false);
            setAutoResolvedResult(null);
          }}
          issues={supportIssues}
          setIssues={setSupportIssues}
          otherDetail={supportOtherDetail}
          setOtherDetail={setSupportOtherDetail}
          onSubmit={handleSubmitSupport}
          isSubmitting={isSubmittingSupport}
          settings={settings}
          autoResolvedResult={autoResolvedResult}
          onCloseResult={() => {
            setAutoResolvedResult(null);
            setIsSupportModalOpen(false);
          }}
          phoneNumber={phoneNumberInput}
          setPhoneNumber={setPhoneNumberInput}
          profile={profile}
        />

        <Toaster position="top-center" theme="dark" />
      </>
    );
  }

  const passwordRequirements = [
    { label: 'Ít nhất 1 chữ hoa', regex: /[A-Z]/ },
    { label: 'Ít nhất 1 chữ thường', regex: /[a-z]/ },
    { label: 'Ít nhất 1 chữ số', regex: /[0-9]/ },
    { label: 'Ít nhất 1 ký tự đặc biệt', regex: /[^A-Za-z0-9]/ },
    { label: 'Tối thiểu 8 ký tự', regex: /.{8,}/ }
  ];

  const checkRequirement = (regex: RegExp) => regex.test(newPassword);

  return (
    <div className={`h-screen flex relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#0a0a0a] text-white' : theme === 'light' ? 'light bg-slate-50 text-slate-900' : 'bg-[#0a0a0a] text-white'}`}>
      <div className="bg-gradient-animate" />
      {/* Watermark */}
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-[0.03] select-none">
        <div className="transform -rotate-45 text-center">
          <p className="text-6xl font-black tracking-widest uppercase">{profile?.email}</p>
          <p className="text-2xl font-bold mt-4">{profile?.lastIp || 'N/A'}</p>
          <p className="text-xl font-medium mt-2">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass border-r border-main transform transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 ${!isSidebarOpen && 'lg:w-0 lg:overflow-hidden lg:border-none'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-blue-500/10">
                <img src={SITE_LOGO} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold tracking-tight">SecurePass</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-surface rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem 
              icon={<Key className="w-5 h-5" />} 
              label="Mật khẩu" 
              active={activeTab === 'passwords'} 
              onClick={() => setActiveTab('passwords')} 
            />
            <NavItem 
              icon={<UserIcon className="w-5 h-5" />} 
              label="Tài khoản" 
              active={activeTab === 'account'} 
              onClick={() => setActiveTab('account')} 
            />
            {profile?.role === 'admin' && (
              <>
                {(profile.isSuperAdmin || profile.permissions?.manageUsers) && (
                  <NavItem 
                    icon={<Users className="w-5 h-5" />} 
                    label="Người dùng" 
                    active={activeTab === 'users'} 
                    onClick={() => setActiveTab('users')} 
                  />
                )}
                {(profile.isSuperAdmin || profile.permissions?.manageUserTabs) && (
                  <NavItem 
                    icon={<FolderKey className="w-5 h-5" />} 
                    label="Tab Mật khẩu User" 
                    active={activeTab === 'userTabs'} 
                    onClick={() => setActiveTab('userTabs')} 
                  />
                )}
                {(profile.isSuperAdmin || profile.permissions?.viewLogs) && (
                  <NavItem 
                    icon={<History className="w-5 h-5" />} 
                    label="Nhật ký" 
                    active={activeTab === 'logs'} 
                    onClick={() => setActiveTab('logs')} 
                  />
                )}
                {(profile.isSuperAdmin || profile.permissions?.manageSettings) && (
                  <NavItem 
                    icon={<ShieldAlert className="w-5 h-5" />} 
                    label="Hệ thống & Admin" 
                    active={activeTab === 'adminSystem'} 
                    onClick={() => setActiveTab('adminSystem')} 
                  />
                )}
                {(profile.isSuperAdmin || profile.permissions?.manageSettings) && (
                  <NavItem 
                    icon={<HelpCircle className="w-5 h-5" />} 
                    label="Hỗ trợ" 
                    active={activeTab === 'support'} 
                    onClick={() => setActiveTab('support')} 
                  />
                )}
              </>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-main space-y-4">
            <div className="flex items-center gap-2 p-2">
              <img src={profile?.photoURL} className="w-8 h-8 rounded-full border border-main" alt="User" />
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate">{profile?.displayName}</p>
                <p className="text-[10px] text-dim truncate">{profile?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 glass border-b border-main flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-surface rounded-lg transition-colors">
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold capitalize">
              {activeTab === 'passwords' ? 'Mật khẩu' : activeTab === 'account' ? 'Tài khoản & Bảo mật' : activeTab === 'users' ? 'Người dùng' : activeTab === 'userTabs' ? 'Tab Mật khẩu User' : activeTab === 'logs' ? 'Nhật ký' : activeTab === 'adminSystem' ? 'Hệ thống & Admin' : activeTab === 'support' ? 'Hỗ trợ' : 'Cài đặt'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2 text-[10px] text-dim">
                <Clock className="w-3 h-3" />
                <span>Lần đầu: {profile?.firstLogin ? format(parseISO(profile.firstLogin), 'HH:mm dd/MM') : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-dim">
                <History className="w-3 h-3" />
                <span>Gần nhất: {profile?.lastLogin ? format(parseISO(profile.lastLogin), 'HH:mm dd/MM') : 'N/A'}</span>
              </div>
            </div>
            

            {profile?.role === 'admin' && (
              <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-xs font-medium">
                <ShieldAlert className="w-3.5 h-3.5" />
                Quản trị viên
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'passwords' && (
              <motion.div 
                key="passwords"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Statistics Bar */}
                {profile?.role === 'admin' && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">MK Chung</p>
                      <p className="text-2xl font-bold text-blue-500">{stats.totalGeneralPasswords}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">MK Tab Con</p>
                      <p className="text-2xl font-bold text-purple-500">{stats.totalTabPasswords}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">Người dùng</p>
                      <p className="text-2xl font-bold text-green-500">{stats.totalUsers}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">Hoạt động</p>
                      <p className="text-2xl font-bold text-yellow-500">{stats.activeUsers}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">IP bị chặn</p>
                      <p className="text-2xl font-bold text-red-500">{stats.blockedIpsCount}</p>
                    </div>
                  </div>
                )}

                {/* Tabs Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                  <button
                    onClick={() => setActivePasswordTab('general')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                      activePasswordTab === 'general' 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-surface/50 text-dim hover:bg-surface hover:text-main'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Mật khẩu chung
                  </button>

                  {(profile?.role === 'admin') && passwordTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (unlockedTabs.includes(tab.id)) {
                          setActivePasswordTab(tab.id);
                        } else {
                          setTabToUnlock(tab);
                          setIsTabUnlockModalOpen(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                        activePasswordTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'bg-surface/50 text-dim hover:bg-surface hover:text-main'
                      }`}
                    >
                      {unlockedTabs.includes(tab.id) ? <FolderOpen className="w-4 h-4" /> : <FolderLock className="w-4 h-4" />}
                      {tab.name}
                      {tab.isHidden && <EyeOff className="w-3 h-3 text-neutral-500 ml-1" />}
                    </button>
                  ))}
                  {(profile?.role !== 'admin') && passwordTabs.filter(t => !t.isHidden).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (unlockedTabs.includes(tab.id)) {
                          setActivePasswordTab(tab.id);
                        } else {
                          setTabToUnlock(tab);
                          setIsTabUnlockModalOpen(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                        activePasswordTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'bg-surface/50 text-dim hover:bg-surface hover:text-main'
                      }`}
                    >
                      {unlockedTabs.includes(tab.id) ? <FolderOpen className="w-4 h-4" /> : <FolderLock className="w-4 h-4" />}
                      {tab.name}
                    </button>
                  ))}

                  {/* User Personal Tab */}
                  {userTabs.find(t => t.ownerId === user?.uid) ? (() => {
                    const myTab = userTabs.find(t => t.ownerId === user?.uid)!;
                    return (
                      <div key={myTab.id} className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (unlockedTabs.includes(myTab.id)) {
                              setActivePasswordTab(myTab.id);
                            } else {
                              setTabToUnlock(myTab);
                              setIsTabUnlockModalOpen(true);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                            activePasswordTab === myTab.id 
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                              : 'bg-surface/50 text-dim hover:bg-surface hover:text-main'
                          }`}
                        >
                          {unlockedTabs.includes(myTab.id) ? <FolderOpen className="w-4 h-4" /> : <FolderLock className="w-4 h-4" />}
                          Mật khẩu cá nhân
                        </button>
                        <button
                          onClick={() => setEditingUserTab(myTab)}
                          className="p-2 text-neutral-500 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-colors"
                          title="Cài đặt tab cá nhân"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })() : (
                    <button
                      onClick={() => setIsCreateUserTabModalOpen(true)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 bg-surface/50 text-dim hover:bg-surface hover:text-main border border-dashed border-main"
                    >
                      <Plus className="w-4 h-4" />
                      Tạo tab cá nhân
                    </button>
                  )}

                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => setActivePasswordTab('trash')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ml-auto ${
                        activePasswordTab === 'trash' 
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                          : 'bg-surface/50 text-dim hover:bg-surface hover:text-main'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Thùng rác
                    </button>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm mật khẩu..." 
                      className="w-full bg-surface border border-main rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-main"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {(profile?.role === 'admin' || isPersonalTabOwner) && activePasswordTab !== 'trash' && (
                    <div className="flex gap-2">
                      <button onClick={handleExportExcel} className="flex items-center gap-2 bg-surface hover:bg-surface/80 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-main">
                        <Download className="w-4 h-4" />
                        Xuất Excel
                      </button>
                      <label className="flex items-center gap-2 bg-surface hover:bg-surface/80 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border border-main">
                        <Upload className="w-4 h-4" />
                        Nhập Excel
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
                      </label>
                      <button 
                        onClick={() => {
                          setEditingPassword(null);
                          setPasswordInput('');
                          (document.getElementById('add-modal') as any)?.showModal();
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm mới
                      </button>
                    </div>
                  )}
                </div>

                {/* Password Table */}
                {activePasswordTab === 'general' && settings?.generalPassword && !isGeneralUnlocked && profile?.role !== 'admin' ? (
                  <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-main">Mật khẩu chung đang bị khóa</h3>
                      <p className="text-dim text-sm mt-1">Vui lòng nhập mật khẩu để xem danh sách mật khẩu chung</p>
                    </div>
                    <div className="w-full max-w-xs space-y-3">
                      <input 
                        type="password"
                        value={generalPasswordInput}
                        onChange={(e) => setGeneralPasswordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && generalPasswordInput === settings.generalPassword) {
                            setIsGeneralUnlocked(true);
                            setGeneralPasswordInput('');
                          }
                        }}
                        placeholder="Nhập mật khẩu..."
                        className="w-full bg-surface border border-main rounded-xl px-4 py-2.5 text-center focus:ring-2 focus:ring-blue-500/50 outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (generalPasswordInput === settings.generalPassword) {
                            setIsGeneralUnlocked(true);
                            setGeneralPasswordInput('');
                          } else {
                            toast.error('Mật khẩu không chính xác');
                          }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-all"
                      >
                        Mở khóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">Trang web</th>
                            <th className="px-6 py-4 font-semibold">Tên đăng nhập</th>
                            <th className="px-6 py-4 font-semibold">Mật khẩu</th>
                            <th className="px-6 py-4 font-semibold">Ghi chú</th>
                            <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                          {filteredPasswords.filter(p => {
                            if (activePasswordTab === 'trash') {
                              return p.isDeleted && (p.website.toLowerCase().includes(searchTerm.toLowerCase()) || p.username.toLowerCase().includes(searchTerm.toLowerCase()));
                            }
                            if (p.isDeleted) return false;
                            const matchesTab = activePasswordTab === 'general' ? (!p.tabId || p.tabId === 'general') : p.tabId === activePasswordTab;
                            const matchesSearch = p.website.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                  p.username.toLowerCase().includes(searchTerm.toLowerCase());
                            return matchesTab && matchesSearch;
                          }).sort((a, b) => {
                            const aPinned = a.pinnedBy?.includes(user?.uid || '') ? 1 : 0;
                            const bPinned = b.pinnedBy?.includes(user?.uid || '') ? 1 : 0;
                            return bPinned - aPinned;
                          }).map((p) => (
                            <PasswordRow 
                              key={p.id} 
                              entry={p} 
                              onCopy={() => handleCopyPassword(p)} 
                              onView={() => logActivity('view_password', `Đã xem mật khẩu cho ${p.website} (${p.username})`)}
                              onDelete={() => p.id && handleDeletePassword(p.id)}
                              onEdit={() => {
                                setEditingPassword(p);
                                setPasswordInput(decrypt(p.password));
                                (document.getElementById('add-modal') as any)?.showModal();
                              }}
                              onTogglePin={() => p.id && handleTogglePinPassword(p.id, p.pinnedBy || [])}
                              onRestore={() => p.id && handleRestorePassword(p.id)}
                              onHardDelete={() => p.id && handleHardDeletePassword(p.id)}
                              isAdmin={profile?.isSuperAdmin || (profile?.role === 'admin' && profile?.permissions?.managePasswords) || isPersonalTabOwner}
                              isTrashView={activePasswordTab === 'trash'}
                              isPinnedByUser={p.pinnedBy?.includes(user?.uid || '')}
                            />
                          ))}
                          {passwords.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                Không tìm thấy mật khẩu nào
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'users' && profile?.role === 'admin' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm người dùng..." 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Người dùng</th>
                          <th className="px-6 py-4 font-semibold">NumberID</th>
                          <th className="px-6 py-4 font-semibold">Số điện thoại</th>
                          <th className="px-6 py-4 font-semibold">Tọa độ</th>
                          <th className="px-6 py-4 font-semibold">Vai trò</th>
                          <th className="px-6 py-4 font-semibold">Truy cập</th>
                          <th className="px-6 py-4 font-semibold">Trạng thái</th>
                          <th className="px-6 py-4 font-semibold">MK Cấp 2</th>
                          <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {users.filter(u => 
                          (profile?.role === 'admin' || u.role !== 'admin') && (
                            u.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                            u.numberID?.includes(userSearchTerm)
                          )
                        ).map((u) => {
                          return (
                            <UserRow 
                              key={u.uid} 
                              user={u} 
                              onUpdate={handleUpdateUserAccess} 
                              onDelete={handleDeleteUser}
                              isSuperAdmin={profile?.isSuperAdmin}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'userTabs' && profile?.role === 'admin' && (
              <motion.div 
                key="userTabs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="glass rounded-2xl overflow-hidden p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">Quản lý Tab Mật khẩu User</h3>
                      <span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full text-xs font-medium">
                        {userTabs.length} tab
                      </span>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type="text" 
                        placeholder="Tìm kiếm tab hoặc email..." 
                        value={userTabSearchTerm}
                        onChange={(e) => setUserTabSearchTerm(e.target.value)}
                        className="w-full bg-black/50 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Tên Tab</th>
                          <th className="px-6 py-4 font-semibold">Người tạo</th>
                          <th className="px-6 py-4 font-semibold">Mật khẩu (Giải mã)</th>
                          <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {userTabs.filter(tab => {
                          const owner = users.find(u => u.uid === tab.ownerId);
                          const searchLower = userTabSearchTerm.toLowerCase();
                          return tab.name.toLowerCase().includes(searchLower) || 
                                 (owner && owner.email.toLowerCase().includes(searchLower));
                        }).map((tab) => {
                          const owner = users.find(u => u.uid === tab.ownerId);
                          return (
                            <tr key={tab.id} className="hover:bg-surface/30 transition-colors">
                              <td className="px-6 py-4 text-sm text-white font-medium">{tab.name}</td>
                              <td className="px-6 py-4 text-sm text-neutral-300">
                                {owner ? (
                                  <div className="flex items-center gap-2">
                                    <img src={owner.photoURL || `https://ui-avatars.com/api/?name=${owner.email}&background=random`} alt={owner.email} className="w-6 h-6 rounded-full" />
                                    <span>{owner.email}</span>
                                  </div>
                                ) : (
                                  <span className="text-neutral-500">Không rõ ({tab.ownerId})</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-neutral-300 font-mono">
                                {decrypt(tab.password)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingUserTab(tab)}
                                    className="p-2 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                    title="Đổi mật khẩu tab"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm('Bạn có chắc chắn muốn xóa tab này và tất cả mật khẩu bên trong?')) {
                                        try {
                                          await deleteDoc(doc(db, 'userTabs', tab.id));
                                          // Delete associated passwords
                                          const q = query(collection(db, 'passwords'), where('tabId', '==', tab.id));
                                          const snapshot = await getDocs(q);
                                          const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                                          await Promise.all(deletePromises);
                                          toast.success('Đã xóa tab user thành công');
                                        } catch (error) {
                                          toast.error('Lỗi khi xóa tab user');
                                        }
                                      }
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Xóa tab"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {userTabs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                              Chưa có tab mật khẩu user nào được tạo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && profile?.role === 'admin' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm trong nhật ký..." 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                      value={logSearchTerm}
                      onChange={(e) => setLogSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={logActionFilter}
                      onChange={(e) => setLogActionFilter(e.target.value)}
                      className="bg-surface border border-main rounded-xl px-4 py-2.5 text-sm outline-none text-main"
                    >
                      <option value="all">Tất cả hành động</option>
                      <option value="login">Đăng nhập</option>
                      <option value="logout">Đăng xuất</option>
                      <option value="copy_password">Sao chép mật khẩu</option>
                      <option value="view_password">Xem mật khẩu</option>
                      <option value="access_web">Truy cập web</option>
                    </select>
                    <button 
                      onClick={() => setIsDeletingLogs(true)}
                      className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa nhật ký
                    </button>
                  </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold whitespace-nowrap">Thời gian</th>
                          <th className="px-6 py-4 font-semibold whitespace-nowrap">Người dùng</th>
                          <th className="px-6 py-4 font-semibold whitespace-nowrap">Hành động</th>
                          <th className="px-6 py-4 font-semibold whitespace-nowrap">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {logs.filter(l => {
                          const matchesSearch = l.email.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
                                              l.details.toLowerCase().includes(logSearchTerm.toLowerCase());
                          const matchesFilter = logActionFilter === 'all' || l.action === logActionFilter;
                          return matchesSearch && matchesFilter;
                        }).map((l) => (
                          <tr key={l.id} className="text-sm hover:bg-neutral-900/30 transition-colors">
                            <td className="px-6 py-4 text-neutral-500 font-mono text-xs whitespace-nowrap">
                              {l.timestamp ? format(safeParseISO(l.timestamp), 'HH:mm:ss dd/MM') : 'N/A'}
                            </td>
                            <td className="px-6 py-4 font-medium whitespace-nowrap">{l.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                l.action === 'login' ? 'bg-green-500/10 text-green-400' :
                                l.action === 'logout' ? 'bg-orange-500/10 text-orange-400' :
                                l.action === 'copy_password' ? 'bg-blue-500/10 text-blue-400' :
                                l.action === 'view_password' ? 'bg-purple-500/10 text-purple-400' :
                                'bg-neutral-500/10 text-neutral-400'
                              }`}>
                                {l.action === 'login' ? 'Đăng nhập' : 
                                 l.action === 'logout' ? 'Đăng xuất' : 
                                 l.action === 'copy_password' ? 'Sao chép MK' : 
                                 l.action === 'view_password' ? 'Xem MK' : 
                                 l.action?.replace('_', ' ') || 'KHÔNG XÁC ĐỊNH'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-neutral-400 min-w-[300px]">{l.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'account' && (
              <motion.div 
                key="account"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <AccountSection 
                  profile={profile} 
                  theme={theme} 
                  setTheme={setTheme} 
                  setSupportIssues={setSupportIssues}
                  setIsSupportModalOpen={setIsSupportModalOpen}
                />
              </motion.div>
            )}

            {activeTab === 'adminSystem' && profile?.role === 'admin' && (
              <motion.div 
                key="adminSystem"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <AdminSystemSettings 
                  settings={settings} 
                  onUpdate={handleUpdateSettings} 
                />
              </motion.div>
            )}

            {activeTab === 'support' && profile?.role === 'admin' && (
              <motion.div 
                key="support"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-main">Yêu cầu hỗ trợ</h3>
                    <p className="text-sm text-dim mt-1">Quản lý các yêu cầu hỗ trợ từ người dùng</p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/50 px-4 py-2 rounded-xl border border-main">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-main">{supportRequests.filter(r => r.status === 'pending').length} yêu cầu chờ</span>
                  </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden border border-main">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface/50 border-b border-main">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-dim">Người dùng</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-dim">Vấn đề</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-dim">Thời gian</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-dim">Trạng thái</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-dim text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-main/50">
                        {supportRequests.map((request) => (
                          <SupportRequestRow 
                            key={request.id} 
                            request={request} 
                            onUpdate={handleUpdateSupportStatus}
                            users={users}
                          />
                        ))}
                        {supportRequests.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-3 text-dim">
                                <HelpCircle className="w-12 h-12 opacity-20" />
                                <p>Chưa có yêu cầu hỗ trợ nào</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <dialog id="add-modal" className="modal bg-black/60 backdrop-blur-sm">
        <div className="modal-box glass border border-main p-8 rounded-2xl max-w-md w-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-main">{editingPassword ? 'Chỉnh sửa mật khẩu' : 'Thêm mật khẩu mới'}</h3>
            <form method="dialog">
              <button onClick={() => setEditingPassword(null)} className="p-2 hover:bg-surface rounded-lg transition-colors"><X className="w-5 h-5 text-dim" /></button>
            </form>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSavePassword(
              formData.get('website') as string,
              formData.get('username') as string,
              formData.get('password') as string,
              formData.get('notes') as string
            );
            (e.target as HTMLFormElement).reset();
            setEditingPassword(null);
            (document.getElementById('add-modal') as any)?.close();
          }} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Trang web</label>
              <input name="website" type="text" defaultValue={editingPassword?.website} required placeholder="Ví dụ: facebook.com" className="w-full input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Tên đăng nhập</label>
              <input name="username" type="text" defaultValue={editingPassword?.username} required placeholder="Email hoặc số điện thoại" className="w-full input-field" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-neutral-400">Mật khẩu</label>
                <button 
                  type="button"
                  onClick={() => {
                    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
                    let pass = "";
                    for (let i = 0; i < 16; i++) {
                      pass += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setPasswordInput(pass);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  Tạo ngẫu nhiên
                </button>
              </div>
              <input 
                name="password" 
                type="text" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required 
                placeholder="Nhập mật khẩu" 
                className="w-full input-field" 
              />
              {passwordInput && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${calculatePasswordStrength(passwordInput).color} transition-all duration-300`}
                      style={{ width: `${(calculatePasswordStrength(passwordInput).score / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${calculatePasswordStrength(passwordInput).color.replace('bg-', 'text-')}`}>
                    {calculatePasswordStrength(passwordInput).label}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Ghi chú</label>
              <textarea name="notes" defaultValue={editingPassword?.notes} placeholder="Thêm ghi chú..." className="w-full input-field min-h-[100px] py-3" />
            </div>
            <div className="pt-4">
              <button type="submit" className="w-full btn-primary py-3">
                {editingPassword ? 'Lưu thay đổi' : 'Lưu mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
      
      {/* Excel Import Confirmation Modal */}
      {isImportConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-blue-500 flex items-center gap-3 mb-4">
              <Upload className="w-6 h-6" />
              Trùng lặp dữ liệu
            </h3>
            <p className="text-neutral-400 mb-6 leading-relaxed">
              Phát hiện <span className="text-white font-bold">{duplicateEntries.length}</span> mật khẩu đã tồn tại (trùng Website & Tên đăng nhập). 
              Bạn muốn xử lý các bản ghi này như thế nào?
            </p>
            
            <div className="max-h-[200px] overflow-y-auto mb-6 space-y-2 pr-2 custom-scrollbar">
              {duplicateEntries.map((entry, idx) => (
                <div key={idx} className="bg-surface/50 p-3 rounded-xl border border-main text-xs text-main">
                  <p className="text-blue-400 font-bold">{entry.row.Website}</p>
                  <p className="text-neutral-500">{entry.row.Username}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => confirmImport('update')}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-95"
              >
                Cập nhật dữ liệu mới (Ghi đè)
              </button>
              <button 
                onClick={() => confirmImport('create')}
                className="w-full py-3 rounded-xl bg-surface hover:bg-surface/80 text-main font-bold transition-all active:scale-95 border border-main"
              >
                Tạo dữ liệu mới (Bản sao)
              </button>
              <button 
                onClick={() => {
                  setIsImportConfirmOpen(false);
                  setPendingImportData([]);
                  setDuplicateEntries([]);
                }}
                className="w-full py-3 rounded-xl text-neutral-500 hover:text-white transition-all text-sm"
              >
                Hủy bỏ
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Toaster position="top-right" theme={theme === 'system' ? 'dark' : theme} richColors />

      {/* First Login Modal */}
      {editingPermissionsUser && (
        <PermissionEditor 
          user={editingPermissionsUser} 
          onClose={() => setEditingPermissionsUser(null)} 
        />
      )}
      <AnimatePresence>
        {showFirstLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass max-w-md w-full p-8 rounded-3xl border border-main text-center space-y-6"
            >
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-blue-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-main">Chào mừng bạn!</h2>
                <p className="text-dim">Đây là lần đăng nhập đầu tiên của bạn. Vui lòng ghi chú lại mã NumberID bảo mật của bạn ngay lập tức.</p>
              </div>
              
              <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 space-y-4">
                <div>
                  <p className="text-xs text-blue-400 uppercase font-bold tracking-widest mb-1">Mã NumberID của bạn</p>
                  <p className="text-4xl font-mono font-black text-main tracking-tighter">{profile?.numberID}</p>
                </div>
                <div className="pt-4 border-t border-blue-500/10">
                  <p className="text-xs text-blue-400 uppercase font-bold tracking-widest mb-2">Số điện thoại liên hệ</p>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                    <input 
                      type="tel"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value.replace(/[^0-9+]/g, ''))}
                      placeholder="Nhập số điện thoại (VD: +84...)"
                      className="w-full bg-surface/50 border border-main rounded-xl pl-10 pr-4 py-3 text-sm text-main focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-dim mt-2 italic">* Số điện thoại dùng để xác thực khi yêu cầu hỗ trợ tự động.</p>
                </div>
              </div>

              <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20 flex gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-200/80 leading-relaxed">
                  <span className="font-bold text-yellow-500">Lưu ý quan trọng:</span> Bạn sẽ không bao giờ có thể thay đổi mã này. Nếu quên, bạn phải liên hệ Admin để cấp lại.
                </p>
              </div>

              <button
                onClick={async () => {
                  if (!phoneNumberInput || phoneNumberInput.length < 10) {
                    toast.error('Vui lòng nhập số điện thoại hợp lệ');
                    return;
                  }
                  try {
                    await updateDoc(doc(db, 'users', user!.uid), { 
                      phoneNumber: phoneNumberInput,
                      isFirstLogin: false 
                    });
                    setProfile(prev => prev ? { ...prev, phoneNumber: phoneNumberInput, isFirstLogin: false } : null);
                    setShowFirstLoginModal(false);
                    toast.success('Đã lưu thông tin thành công');
                  } catch (error) {
                    toast.error('Lỗi khi lưu thông tin');
                  }
                }}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                Xác nhận & Bắt đầu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Logs Modal */}
      {isDeletingLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-surface border border-main rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-red-500 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" />
              Xác nhận xóa nhật ký
            </h3>
            <p className="text-dim mb-8 leading-relaxed">
              Hành động này sẽ xóa toàn bộ nhật ký hoạt động của hệ thống. 
              Bạn cần nhập <span className="text-main font-bold">Mật khẩu đặc biệt</span> để tiếp tục.
            </p>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Mật khẩu đặc biệt</label>
                <input 
                  type="password" 
                  value={specialPasswordInput}
                  onChange={(e) => setSpecialPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu đặc biệt"
                  className="w-full input-field py-4"
                />
              </div>
              {showSpecialPassHint && settings?.specialPasswordHint && (
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                  <p className="text-xs text-blue-400 leading-relaxed">
                    <span className="font-bold uppercase block mb-1">Gợi ý mật khẩu:</span>
                    {settings.specialPasswordHint}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleDeleteLogs}
                  className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Xác nhận xóa toàn bộ
                </button>
                <div className="flex justify-between items-center">
                  <button 
                    type="button"
                    onClick={() => setShowSpecialPassHint(true)}
                    className="text-xs text-neutral-500 hover:text-blue-400 underline"
                  >
                    Quên mật khẩu đặc biệt?
                  </button>
                  <button 
                    onClick={() => {
                      setIsDeletingLogs(false);
                      setSpecialPasswordInput('');
                      setShowSpecialPassHint(false);
                    }}
                    className="text-sm text-neutral-400 hover:text-white font-medium"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tab Unlock Modal */}
      {isTabUnlockModalOpen && tabToUnlock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-white flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-blue-500" />
              Mở khóa Tab: {tabToUnlock.name}
            </h3>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Vui lòng nhập mật khẩu riêng để truy cập vào tab này.
            </p>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mật khẩu</label>
                <input 
                  type="password" 
                  value={tabPasswordInput}
                  onChange={(e) => setTabPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full input-field py-4"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnlockTab();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleUnlockTab}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  Xác nhận
                </button>
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => {
                      setIsTabUnlockModalOpen(false);
                      setTabPasswordInput('');
                      setTabToUnlock(null);
                      setSupportIssues(['forgot_tab_pass']);
                      setIsSupportModalOpen(true);
                    }}
                    className="text-xs text-neutral-500 hover:text-blue-400 underline"
                  >
                    Quên mật khẩu?
                  </button>
                  <button 
                    onClick={() => {
                      setIsTabUnlockModalOpen(false);
                      setTabPasswordInput('');
                      setTabToUnlock(null);
                    }}
                    className="text-xs text-neutral-500 hover:text-white"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create User Tab Modal */}
      {isCreateUserTabModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-white flex items-center gap-3 mb-4">
              <FolderKey className="w-6 h-6 text-purple-500" />
              Tạo Tab Cá Nhân
            </h3>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Tạo một tab bảo mật riêng để lưu trữ mật khẩu cá nhân của bạn.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const name = (form.elements.namedItem('name') as HTMLInputElement).value;
              const password = (form.elements.namedItem('password') as HTMLInputElement).value;
              
              if (!name || !password) {
                toast.error('Vui lòng nhập đầy đủ thông tin');
                return;
              }

              if (userTabs.some(t => t.ownerId === user?.uid)) {
                toast.error('Bạn đã có một tab cá nhân rồi.');
                return;
              }

              try {
                await addDoc(collection(db, 'userTabs'), {
                  name,
                  password: encrypt(password),
                  ownerId: user?.uid,
                  createdAt: new Date().toISOString()
                });
                toast.success('Đã tạo tab cá nhân thành công');
                setIsCreateUserTabModalOpen(false);
              } catch (error) {
                toast.error('Lỗi khi tạo tab cá nhân');
              }
            }} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Tên Tab</label>
                <input 
                  type="text" 
                  name="name"
                  autoFocus
                  placeholder="Ví dụ: Mật khẩu cá nhân" 
                  className="w-full input-field py-4"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mật khẩu bảo vệ</label>
                <input 
                  type="password" 
                  name="password"
                  placeholder="Nhập mật khẩu..." 
                  className="w-full input-field py-4"
                />
              </div>
              <div className="flex flex-col gap-4">
                <button 
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
                >
                  Tạo Tab
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCreateUserTabModalOpen(false)}
                  className="text-sm text-neutral-400 hover:text-white font-medium"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Edit User Tab Modal */}
      {editingUserTab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-white flex items-center gap-3 mb-4">
              <Settings className="w-6 h-6 text-purple-500" />
              Cài đặt Tab Cá Nhân
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const name = (form.elements.namedItem('name') as HTMLInputElement).value;
              
              if (!name) {
                toast.error('Vui lòng nhập tên tab');
                return;
              }

              const updateData: any = { name };

              try {
                await updateDoc(doc(db, 'userTabs', editingUserTab.id), updateData);
                toast.success('Đã cập nhật tab cá nhân');
                setEditingUserTab(null);
              } catch (error) {
                toast.error('Lỗi khi cập nhật tab cá nhân');
              }
            }} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Tên Tab</label>
                <input 
                  type="text" 
                  name="name"
                  defaultValue={editingUserTab.name}
                  className="w-full input-field py-4"
                />
              </div>
              <div className="flex flex-col gap-4">
                <button 
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
                >
                  Lưu thay đổi
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingUserTab(null)}
                  className="text-sm text-neutral-400 hover:text-white font-medium"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function AdminPasswordTabsSettings({ passwordTabs, settings }: { passwordTabs: PasswordTab[], settings: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingTab, setEditingTab] = useState<PasswordTab | null>(null);

  const handleSaveTab = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;

    try {
      if (editingTab) {
        const updateData: any = { name };
        await updateDoc(doc(db, 'passwordTabs', editingTab.id), updateData);
        toast.success('Đã cập nhật tab');
      } else {
        if (!password) {
          toast.error('Vui lòng nhập mật khẩu cho tab mới');
          return;
        }
        await addDoc(collection(db, 'passwordTabs'), {
          name,
          password: encrypt(password),
          createdAt: new Date().toISOString()
        });
        toast.success('Đã thêm tab mới');
      }
      setIsAdding(false);
      setEditingTab(null);
    } catch (error) {
      toast.error('Lỗi khi lưu tab');
    }
  };

  const handleDeleteTab = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'passwordTabs', id));
      toast.success('Đã xóa tab');
    } catch (error) {
      toast.error('Lỗi khi xóa tab');
    }
  };

  return (
    <div className="glass p-8 rounded-2xl space-y-8 mt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Quản lý Tab Mật khẩu Riêng</h3>
            <p className="text-sm text-neutral-400">Thêm, sửa, xóa các tab mật khẩu được bảo vệ</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditingTab(null);
              setIsAdding(true);
            }}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Thêm Tab
          </button>
        </div>
      </div>

      {(isAdding || editingTab) && (
        <form onSubmit={handleSaveTab} className="bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 space-y-4">
          <h4 className="font-bold text-white mb-4">{editingTab ? 'Chỉnh sửa Tab' : 'Thêm Tab Mới'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Tên Tab</label>
              <input 
                name="name"
                type="text" 
                defaultValue={editingTab?.name || ''}
                required
                placeholder="VD: Mật khẩu Ngân hàng"
                className="w-full input-field py-2.5 text-sm"
              />
            </div>
            {!editingTab && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Mật khẩu bảo vệ</label>
                <input 
                  name="password"
                  type="password" 
                  placeholder="Nhập mật khẩu"
                  required
                  className="w-full input-field py-2.5 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingTab(null);
              }}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
              Lưu Tab
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {passwordTabs.map(tab => (
          <div key={tab.id} className="flex items-center justify-between p-4 bg-neutral-900/30 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-neutral-500" />
              <span className="font-medium">{tab.name}</span>
              {tab.isHidden && <span className="bg-surface text-dim px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">Đang ẩn</span>}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'passwordTabs', tab.id), {
                      isHidden: !tab.isHidden
                    });
                    toast.success(tab.isHidden ? 'Đã hiện tab' : 'Đã ẩn tab');
                  } catch (error) {
                    toast.error('Lỗi khi cập nhật trạng thái tab');
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${tab.isHidden ? 'text-dim hover:bg-surface hover:text-main' : 'text-blue-400 hover:bg-blue-500/10'}`}
                title={tab.isHidden ? "Hiện tab này" : "Ẩn tab này"}
              >
                {tab.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setEditingTab(tab)}
                className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDeleteTab(tab.id)}
                className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {passwordTabs.length === 0 && !isAdding && (
          <div className="text-center py-8 text-neutral-500 text-sm">
            Chưa có tab mật khẩu riêng nào.
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSection({ 
  profile, 
  theme, 
  setTheme,
  setSupportIssues,
  setIsSupportModalOpen
}: { 
  profile: UserProfile | null, 
  theme: 'light' | 'dark' | 'system',
  setTheme: (t: 'light' | 'dark' | 'system') => void,
  setSupportIssues: (issues: string[]) => void,
  setIsSupportModalOpen: (isOpen: boolean) => void
}) {
  const [pass2, setPass2] = useState('');
  const [oldPass2, setOldPass2] = useState('');
  const [isSettingUpPass2, setIsSettingUpPass2] = useState(false);
  const [isTurningOff, setIsTurningOff] = useState(false);
  const [confirmPass2, setConfirmPass2] = useState('');

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [oldPhoneInput, setOldPhoneInput] = useState('');
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const handleUpdatePhone = async () => {
    if (!profile) return;
    if (profile.phoneNumber && oldPhoneInput !== profile.phoneNumber) {
      toast.error('Số điện thoại cũ không chính xác');
      return;
    }
    if (!newPhoneInput || newPhoneInput.length < 10) {
      toast.error('Vui lòng nhập số điện thoại mới hợp lệ');
      return;
    }

    setIsSavingPhone(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        phoneNumber: newPhoneInput,
        updatedAt: new Date().toISOString()
      });
      toast.success('Cập nhật số điện thoại thành công');
      setIsEditingPhone(false);
      setOldPhoneInput('');
      setNewPhoneInput('');
    } catch (error) {
      console.error('Error updating phone:', error);
      toast.error('Cập nhật thất bại');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const passwordStrength = useMemo(() => {
    return {
      hasUpper: /[A-Z]/.test(pass2),
      hasLower: /[a-z]/.test(pass2),
      hasNumber: /[0-9]/.test(pass2),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pass2)
    };
  }, [pass2]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'personal' | 'security' | 'privacy' | 'settings'>('personal');

  const handleSaveSecurity = async () => {
    if (!profile) return;
    
    // If already has password, require old password
    if (profile.secondaryPassword && oldPass2 !== profile.secondaryPassword) {
      toast.error('Mật khẩu cũ không chính xác');
      return;
    }

    if (!pass2) {
      toast.error('Vui lòng nhập mật khẩu mới');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        secondaryPassword: pass2,
        isFirstLogin: false
      });
      toast.success('Cập nhật bảo mật thành công');
      setPass2('');
      setOldPass2('');
    } catch (error) {
      console.error('Error updating security settings:', error);
      toast.error('Cập nhật thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass p-8 rounded-3xl border border-neutral-800">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar for Account Section */}
          <div className="w-full md:w-64 space-y-2">
            <button 
              onClick={() => setActiveSubTab('personal')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSubTab === 'personal' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-dim hover:bg-surface'}`}
            >
              <UserIcon className="w-5 h-5" />
              <span className="font-medium">Thông tin cá nhân</span>
            </button>
            <button 
              onClick={() => setActiveSubTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSubTab === 'security' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-dim hover:bg-surface'}`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Bảo mật</span>
            </button>
            <button 
              onClick={() => setActiveSubTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSubTab === 'privacy' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-dim hover:bg-surface'}`}
            >
              <Eye className="w-5 h-5" />
              <span className="font-medium">Quyền riêng tư</span>
            </button>
            <button 
              onClick={() => setActiveSubTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSubTab === 'settings' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-dim hover:bg-surface'}`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Cài đặt</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 w-full min-h-[400px]">
            {activeSubTab === 'personal' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
                  <img src={profile?.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-blue-500/20" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs font-bold text-main truncate">{profile?.displayName}</h2>
                    <p className="text-[10px] text-dim truncate">{profile?.email}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-bold uppercase tracking-wider rounded-full border border-blue-500/20">
                    {profile?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-surface/30 rounded-xl border border-main relative group">
                    <p className="text-[10px] text-dim uppercase font-bold mb-1">Mã NumberID</p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-mono text-main">{profile?.numberID}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(profile?.numberID || '');
                          toast.success('Đã sao chép NumberID');
                        }}
                        className="p-1.5 text-dim hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-surface/30 rounded-xl border border-main relative group">
                    <p className="text-[10px] text-dim uppercase font-bold mb-1">Mã Truy cập (Key)</p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-mono text-blue-400">{profile?.accessKey}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(profile?.accessKey || '');
                          toast.success('Đã sao chép mã truy cập');
                        }}
                        className="p-1.5 text-dim hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-surface/30 rounded-xl border border-main space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-dim uppercase font-bold mb-1">Số điện thoại liên hệ</p>
                      <p className="text-lg font-mono text-main">
                        {profile?.phoneNumber ? `********${profile.phoneNumber.slice(-2)}` : 'Chưa cập nhật'}
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsEditingPhone(!isEditingPhone)}
                      className="px-4 py-2 rounded-xl transition-all text-sm font-bold border border-main text-dim hover:text-blue-400 hover:border-blue-500/50"
                    >
                      {isEditingPhone ? 'Hủy' : 'Thay đổi'}
                    </button>
                  </div>
                  
                  {isEditingPhone && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 border-t border-main"
                    >
                      {profile?.phoneNumber && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-dim">Số điện thoại cũ</label>
                          <input 
                            type="tel"
                            value={oldPhoneInput}
                            onChange={(e) => setOldPhoneInput(e.target.value)}
                            placeholder="Nhập số điện thoại hiện tại..."
                            className="w-full bg-surface/50 border border-main rounded-xl px-4 py-2.5 text-sm text-main focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-dim">Số điện thoại mới</label>
                        <input 
                          type="tel"
                          value={newPhoneInput}
                          onChange={(e) => setNewPhoneInput(e.target.value)}
                          placeholder="Nhập số điện thoại mới..."
                          className="w-full bg-surface/50 border border-main rounded-xl px-4 py-2.5 text-sm text-main focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleUpdatePhone}
                        disabled={isSavingPhone || (!!profile?.phoneNumber && !oldPhoneInput) || !newPhoneInput}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                      >
                        {isSavingPhone ? 'Đang cập nhật...' : 'Cập nhật số điện thoại'}
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {activeSubTab === 'security' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-main">Xác thực 2 lớp</h3>
                  <div className="p-6 bg-surface/50 rounded-2xl border border-main space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-dim">Trạng thái</label>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${profile?.secondaryPassword ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm font-bold text-main">
                            {profile?.secondaryPassword ? 'Đã cài đặt' : 'Chưa cài đặt'}
                          </span>
                        </div>
                      </div>
                      {!isSettingUpPass2 && !isTurningOff && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setSupportIssues(['forgot_pass2']);
                              setIsSupportModalOpen(true);
                            }}
                            className="px-4 py-2 rounded-xl transition-all text-sm font-bold border border-main text-dim hover:text-blue-400 hover:border-blue-500/50"
                          >
                            Quên mật khẩu?
                          </button>
                          <button 
                            onClick={() => {
                              if (profile?.secondaryPassword) {
                                setIsTurningOff(true);
                              } else {
                                setIsSettingUpPass2(true);
                              }
                            }}
                            className={`px-4 py-2 rounded-xl transition-all text-sm font-bold border ${
                              profile?.secondaryPassword 
                                ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white' 
                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500 hover:text-white'
                            }`}
                          >
                            {profile?.secondaryPassword ? 'Tắt xác thực' : 'Thiết lập'}
                          </button>
                        </div>
                      )}
                      {(isSettingUpPass2 || isTurningOff) && (
                        <button 
                          onClick={() => {
                            setIsSettingUpPass2(false);
                            setIsTurningOff(false);
                            setPass2('');
                            setConfirmPass2('');
                            setOldPass2('');
                          }}
                          className="px-4 py-2 rounded-xl transition-all text-sm font-bold border bg-neutral-500/10 text-dim border-neutral-500/20 hover:bg-neutral-500/20"
                        >
                          Hủy
                        </button>
                      )}
                    </div>

                    {isTurningOff && (
                      <div className="space-y-4 pt-4 border-t border-main/10">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-dim">Xác nhận mật khẩu hiện tại</label>
                          <input 
                            type="password"
                            value={oldPass2}
                            onChange={(e) => setOldPass2(e.target.value)}
                            placeholder="Nhập mật khẩu cấp 2 hiện tại"
                            className="w-full bg-surface/50 border border-main rounded-xl px-4 py-2.5 text-sm text-main focus:border-red-500 outline-none transition-all"
                          />
                        </div>
                        <button 
                          onClick={async () => {
                            if (!oldPass2) {
                              toast.error('Vui lòng nhập mật khẩu hiện tại');
                              return;
                            }
                            if (oldPass2 !== profile?.secondaryPassword) {
                              toast.error('Mật khẩu không chính xác');
                              return;
                            }
                            
                            setIsSaving(true);
                            try {
                              await updateDoc(doc(db, 'users', profile!.uid), {
                                secondaryPassword: null
                              });
                              setOldPass2('');
                              setIsTurningOff(false);
                              toast.success('Đã tắt xác thực 2 lớp');
                            } catch (e) {
                              toast.error('Lỗi khi tắt xác thực 2 lớp');
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving}
                          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                          {isSaving ? 'Đang tắt...' : 'Xác nhận tắt'}
                        </button>
                      </div>
                    )}

                    {isSettingUpPass2 && (
                      <div className="space-y-4 pt-4 border-t border-main/10">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-dim">Mật khẩu mới</label>
                          <input 
                            type="password"
                            value={pass2}
                            onChange={(e) => setPass2(e.target.value)}
                            placeholder="Nhập mật khẩu mới"
                            className="w-full bg-surface/50 border border-main rounded-xl px-4 py-2.5 text-sm text-main focus:border-blue-500 outline-none transition-all"
                          />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold ${passwordStrength.hasUpper ? 'text-green-500' : 'text-red-500'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${passwordStrength.hasUpper ? 'bg-green-500' : 'bg-red-500'}`} />
                              Chữ hoa
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold ${passwordStrength.hasLower ? 'text-green-500' : 'text-red-500'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${passwordStrength.hasLower ? 'bg-green-500' : 'bg-red-500'}`} />
                              Chữ thường
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold ${passwordStrength.hasNumber ? 'text-green-500' : 'text-red-500'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${passwordStrength.hasNumber ? 'bg-green-500' : 'bg-red-500'}`} />
                              Số
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold ${passwordStrength.hasSpecial ? 'text-green-500' : 'text-red-500'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${passwordStrength.hasSpecial ? 'bg-green-500' : 'bg-red-500'}`} />
                              Ký tự đặc biệt
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-dim">Xác nhận mật khẩu</label>
                          <input 
                            type="password"
                            value={confirmPass2}
                            onChange={(e) => setConfirmPass2(e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            className="w-full bg-surface/50 border border-main rounded-xl px-4 py-2.5 text-sm text-main focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                        <button 
                          onClick={async () => {
                            if (!pass2 || !confirmPass2) {
                              toast.error('Vui lòng nhập đầy đủ thông tin');
                              return;
                            }
                            if (pass2 !== confirmPass2) {
                              toast.error('Mật khẩu xác nhận không khớp');
                              return;
                            }
                            if (!passwordStrength.hasUpper || !passwordStrength.hasLower || !passwordStrength.hasNumber || !passwordStrength.hasSpecial) {
                              toast.error('Mật khẩu chưa đủ mạnh');
                              return;
                            }
                            
                            setIsSaving(true);
                            try {
                              await updateDoc(doc(db, 'users', profile!.uid), {
                                secondaryPassword: pass2
                              });
                              setPass2('');
                              setConfirmPass2('');
                              setIsSettingUpPass2(false);
                              toast.success('Cài đặt mật khẩu thành công');
                            } catch (e) {
                              toast.error('Lỗi khi cài đặt mật khẩu');
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                        >
                          {isSaving ? 'Đang lưu...' : 'Xác nhận cài đặt'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'privacy' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="p-6 bg-surface/50 rounded-2xl border border-main space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-main">Chia sẻ vị trí</p>
                      <p className="text-xs text-dim">Bắt buộc để truy cập trang web</p>
                    </div>
                    <button 
                      disabled
                      className="w-12 h-6 rounded-full relative bg-blue-500 opacity-50 cursor-not-allowed"
                    >
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-main">Nhật ký hoạt động</p>
                      <p className="text-xs text-dim">Bắt buộc để bảo mật tài khoản</p>
                    </div>
                    <button 
                      disabled
                      className="w-12 h-6 rounded-full relative bg-blue-500 opacity-50 cursor-not-allowed"
                    >
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'settings' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-main">Giao diện</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <button 
                      disabled
                      onClick={() => setTheme('light')}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 opacity-50 cursor-not-allowed ${theme === 'light' ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-surface/50 border-main text-dim'}`}
                    >
                      <Sun className="w-6 h-6" />
                      <span className="text-xs font-bold">Sáng</span>
                    </button>
                    <button 
                      disabled
                      onClick={() => setTheme('dark')}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 opacity-50 cursor-not-allowed ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-surface/50 border-main text-dim'}`}
                    >
                      <Moon className="w-6 h-6" />
                      <span className="text-xs font-bold">Tối</span>
                    </button>
                    <button 
                      onClick={() => setTheme('system')}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${theme === 'system' ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-surface/50 border-main text-dim hover:border-blue-500/50'}`}
                    >
                      <Monitor className="w-6 h-6" />
                      <span className="text-xs font-bold">Hệ thống</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminContactInfo({ settings }: { settings: SystemSettings | null }) {
  if (!settings?.contactMethods || settings.contactMethods.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3 w-full">
      <p className="text-[10px] font-bold text-dim uppercase tracking-[0.2em]">Liên hệ Admin</p>
      <div className="flex items-center justify-center gap-3 flex-wrap max-w-full px-2">
        {settings.contactMethods.map((method) => (
          <a 
            key={method.id}
            href={method.type === 'phone' ? `tel:${method.value}` : method.type === 'email' ? `mailto:${method.value}` : method.value}
            target="_blank"
            rel="noreferrer"
            title={method.label}
            className="w-9 h-9 bg-surface/50 hover:bg-blue-500/10 rounded-full border border-main hover:border-blue-500/30 flex items-center justify-center transition-all group shrink-0"
          >
            {method.type === 'phone' && <Phone className="w-4 h-4 text-dim group-hover:text-blue-400" />}
            {method.type === 'email' && <Mail className="w-4 h-4 text-dim group-hover:text-blue-400" />}
            {method.type === 'facebook' && <Facebook className="w-4 h-4 text-dim group-hover:text-blue-400" />}
            {method.type === 'telegram' && <Send className="w-4 h-4 text-dim group-hover:text-blue-400" />}
            {method.type === 'zalo' && <MessageCircle className="w-4 h-4 text-dim group-hover:text-blue-400" />}
            {method.type === 'other' && <Link className="w-4 h-4 text-dim group-hover:text-blue-400" />}
          </a>
        ))}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
          : 'text-dim hover:bg-surface hover:text-main'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

const PasswordRow: React.FC<{ 
  entry: PasswordEntry, 
  onCopy: () => void, 
  onView: () => void, 
  onDelete: () => void, 
  onEdit: () => void, 
  onTogglePin: () => void,
  onRestore?: () => void,
  onHardDelete?: () => void,
  isAdmin: boolean,
  isTrashView?: boolean,
  isPinnedByUser?: boolean
}> = ({ entry, onCopy, onView, onDelete, onEdit, onTogglePin, onRestore, onHardDelete, isAdmin, isTrashView, isPinnedByUser }) => {
  const [showPass, setShowPass] = useState(false);
  const favicon = `https://www.google.com/s2/favicons?domain=${entry.website}&sz=64`;

  const handleShowPassStart = () => {
    onView();
    setShowPass(true);
  };

  const handleShowPassEnd = () => {
    setShowPass(false);
  };

  return (
    <tr className={`text-sm hover:bg-surface/30 transition-colors group ${isPinnedByUser ? 'bg-blue-900/10' : ''}`}>
      <td className="px-6 py-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-all ${isPinnedByUser ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-dim hover:text-yellow-500 hover:bg-yellow-500/10 opacity-0 group-hover:opacity-100'}`}
          >
            <Star className="w-4 h-4" fill={isPinnedByUser ? "currentColor" : "none"} />
          </button>
          <img 
            src={favicon} 
            className="w-8 h-8 rounded-lg bg-surface p-1.5 border border-main" 
            alt="icon" 
            referrerPolicy="no-referrer"
            onError={(e) => (e.currentTarget.src = 'https://www.google.com/favicon.ico')}
          />
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[150px] text-main">{entry.website}</span>
            <a href={entry.website} target="_blank" rel="noreferrer" className="text-[10px] text-dim hover:text-blue-400 flex items-center gap-1">
              Truy cập <ExternalLink className="w-2 h-2" />
            </a>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex items-center gap-2">
          <span className="text-dim truncate max-w-[120px]">{entry.username}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(entry.username);
              toast.success('Đã sao chép tên đăng nhập');
            }}
            className="p-1 text-dim hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-dim select-none">
            {showPass ? decrypt(entry.password) : '••••••••'}
          </span>
          <button 
            onMouseDown={handleShowPassStart}
            onMouseUp={handleShowPassEnd}
            onMouseLeave={handleShowPassEnd}
            onTouchStart={handleShowPassStart}
            onTouchEnd={handleShowPassEnd}
            className="p-1 text-dim hover:text-main active:text-blue-400 cursor-pointer"
            title="Chạm và giữ để xem"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <span className="text-dim text-xs italic truncate max-w-[150px] block">
          {entry.notes || 'Không có ghi chú'}
        </span>
      </td>
      <td className="px-6 py-4 text-right min-w-[150px]">
        <div className="flex items-center justify-end gap-2">
          {!isTrashView ? (
            <>
              <button 
                onClick={onCopy}
                className="flex items-center gap-2 bg-surface hover:bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-main text-main hover:text-white"
              >
                <Copy className="w-3.5 h-3.5" />
                Sao chép
              </button>
              {isAdmin && (
                <>
                  <button 
                    onClick={onEdit}
                    className="p-2 text-dim hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={onDelete}
                    className="p-2 text-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {isAdmin && (
                <>
                  <button 
                    onClick={onRestore}
                    className="flex items-center gap-2 bg-surface hover:bg-green-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-main border border-main"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    Khôi phục
                  </button>
                  <button 
                    onClick={onHardDelete}
                    className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    title="Xóa vĩnh viễn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

const UserRow: React.FC<{ 
  user: UserProfile, 
  onUpdate: (uid: string, disabled: boolean, newAccessKey?: string) => void, 
  onDelete: (uid: string) => void,
  isSuperAdmin?: boolean
}> = ({ user, onUpdate, onDelete, isSuperAdmin }) => {
  const disabled = !!user.isDisabled;
  const status = user.isDisabled ? 'locked' : (user.status || 'active');

  return (
    <tr className="text-sm hover:bg-surface/30 transition-colors group">
      <td className="px-6 py-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`} 
            className="w-10 h-10 rounded-full border border-main" 
            alt="Avatar" 
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-main truncate">{user.displayName || 'Người dùng'}</span>
            <div className="flex items-center gap-1 group/email">
              <span className="text-[10px] text-dim truncate">{user.email}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(user.email);
                  toast.success('Đã sao chép email');
                }}
                className="opacity-0 group-hover/email:opacity-100 p-1 hover:bg-surface rounded transition-all"
                title="Sao chép"
              >
                <Copy className="w-3 h-3 text-dim hover:text-main" />
              </button>
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 group/id">
          <span className="font-mono text-xs text-main">{user.numberID || '---'}</span>
          {user.numberID && (
            <button 
              onClick={() => {
                navigator.clipboard.writeText(user.numberID!);
                toast.success('Đã sao chép NumberID');
              }}
              className="opacity-0 group-hover/id:opacity-100 p-1 hover:bg-surface rounded transition-all"
              title="Sao chép"
            >
              <Copy className="w-3 h-3 text-dim hover:text-main" />
            </button>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 group/phone">
          <span className="font-mono text-xs text-main">{user.phoneNumber || '---'}</span>
          {user.phoneNumber && (
            <button 
              onClick={() => {
                navigator.clipboard.writeText(user.phoneNumber!);
                toast.success('Đã sao chép số điện thoại');
              }}
              className="opacity-0 group-hover/phone:opacity-100 p-1 hover:bg-surface rounded transition-all"
              title="Sao chép"
            >
              <Copy className="w-3 h-3 text-dim hover:text-main" />
            </button>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          {user.latitude && user.longitude ? (
            <a 
              href={`https://www.google.com/maps?q=${user.latitude},${user.longitude}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-blue-400 hover:underline flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              Xem vị trí ({user.latitude.toFixed(2)}, {user.longitude.toFixed(2)})
            </a>
          ) : (
            <span className="text-[10px] font-mono text-dim">---</span>
          )}
          {user.lastIp && <span className="text-[8px] text-dim/50">{user.lastIp}</span>}
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
          user.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
        }`}>
          {user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 group/key">
          <span className="font-mono text-xs text-blue-400">{user.accessKey || '---'}</span>
          {user.accessKey && (
            <button 
              onClick={() => {
                navigator.clipboard.writeText(user.accessKey!);
                toast.success('Đã sao chép Access Key');
              }}
              className="opacity-0 group-hover/key:opacity-100 p-1 hover:bg-surface rounded transition-all"
              title="Sao chép"
            >
              <Copy className="w-3 h-3 text-dim hover:text-main" />
            </button>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className={`flex items-center gap-1.5 ${
          status === 'active' ? 'text-green-500' : 
          status === 'locked' ? 'text-red-500' : 'text-neutral-500'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 
            status === 'locked' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-neutral-500'
          }`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {status === 'active' ? 'Hoạt động' : 
             status === 'locked' ? 'Đã khóa' : 'Ngoại tuyến'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs font-medium ${user.secondaryPassword ? 'text-main' : 'text-dim'}`}>
          {user.secondaryPassword || '---'}
        </span>
      </td>
      <td className="px-6 py-4 text-right min-w-[150px]">
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => onUpdate(user.uid, !disabled)}
            className={`p-2 rounded-lg transition-all ${
              disabled ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-dim hover:text-red-400 hover:bg-red-400/10'
            }`}
            title={disabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
          >
            {disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
          {isSuperAdmin && !user.isSuperAdmin && (
            <button 
              onClick={() => onDelete(user.uid)}
              className="p-2 text-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              title="Xóa người dùng"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SupportModal({ 
  isOpen, 
  onClose, 
  issues, 
  setIssues, 
  otherDetail,
  setOtherDetail,
  onSubmit, 
  isSubmitting,
  settings,
  autoResolvedResult,
  onCloseResult,
  phoneNumber,
  setPhoneNumber,
  profile
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  issues: string[], 
  setIssues: React.Dispatch<React.SetStateAction<string[]>>,
  otherDetail: string,
  setOtherDetail: (val: string) => void,
  onSubmit: () => void,
  isSubmitting: boolean,
  settings: SystemSettings | null,
  autoResolvedResult: { issue: string, label: string, value: string }[] | null,
  onCloseResult: () => void,
  phoneNumber: string,
  setPhoneNumber: (val: string) => void,
  profile: UserProfile | null
}) {
  const [step, setStep] = useState(1);

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPhoneNumber('');
      setIssues([]);
      setOtherDetail('');
    }
  }, [isOpen]);

  const isNewUser = !profile?.phoneNumber;

  const availableIssues = isNewUser ? [
    { id: 'request_key', label: 'Yêu cầu cung cấp Key (Mã truy cập)' },
    { id: 'other', label: 'Khác' }
  ] : [
    { id: 'forgot_numberid', label: 'Quên NumberID' },
    { id: 'forgot_pass2', label: 'Quên Mật khẩu cấp 2' },
    { id: 'forgot_accesskey', label: 'Quên mã truy cập' },
    { id: 'forgot_tab_pass', label: 'Quên mật khẩu Tab cá nhân' },
    { id: 'other', label: 'Khác' }
  ];

  const toggleIssue = (id: string) => {
    if (issues.includes(id)) {
      setIssues(issues.filter(i => i !== id));
    } else {
      setIssues([...issues, id]);
    }
  };

  if (!isOpen) return null;

  if (autoResolvedResult) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-bg-main border border-main w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-main bg-blue-600/10 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-main">Xử lý thành công</h3>
              <p className="text-xs text-dim">Hệ thống đã tự động giải quyết vấn đề</p>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="bg-surface/50 border border-main p-5 rounded-2xl space-y-4">
              {autoResolvedResult.map((res, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dim">{res.label}</label>
                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-main group">
                    <code className="text-blue-400 font-mono font-bold text-lg">{res.value}</code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(res.value);
                        toast.success(`Đã sao chép ${res.label}`);
                      }}
                      className="p-2 hover:bg-surface rounded-lg transition-colors text-dim hover:text-main"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-200/80 leading-relaxed">
                <span className="font-bold text-yellow-500 block mb-1">Lưu ý quan trọng:</span>
                Vui lòng lưu lại thông tin mới này cẩn thận. Bạn sẽ cần nó cho lần đăng nhập tiếp theo.
              </p>
            </div>
          </div>
          
          <div className="p-6 bg-surface/30 border-t border-main">
            <button 
              onClick={onCloseResult}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
            >
              Tôi đã lưu thông tin
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-main border border-main w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-main flex items-center justify-between bg-surface/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-main">Hỗ trợ người dùng</h3>
              <p className="text-xs text-dim">Chọn vấn đề bạn đang gặp phải</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg transition-colors">
            <X className="w-5 h-5 text-dim" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Manual Contact Info Section */}
          <div className="bg-surface/50 border border-main p-4 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-main flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-blue-500" />
              Thông tin liên hệ trực tiếp
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {settings?.contactMethods?.map((method: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-surface rounded-lg transition-all group">
                  <div className="flex items-center gap-2">
                    {method.type === 'email' ? <Mail className="w-3.5 h-3.5 text-dim" /> : 
                     method.type === 'phone' ? <Phone className="w-3.5 h-3.5 text-dim" /> : 
                     <Globe className="w-3.5 h-3.5 text-dim" />}
                    <span className="text-xs text-dim capitalize">{method.type}:</span>
                  </div>
                  <span className="text-xs font-medium text-main group-hover:text-blue-400 transition-colors">{method.value}</span>
                </div>
              ))}
              {!settings?.contactMethods?.length && (
                <p className="text-xs text-dim italic">Chưa có thông tin liên hệ thủ công.</p>
              )}
            </div>
          </div>

          {step === 1 && !isNewUser ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-dim uppercase tracking-wider">Xác minh số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                  <input 
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Nhập số điện thoại đã đăng ký..."
                    className="w-full bg-surface/50 border border-main rounded-xl pl-10 pr-4 py-2.5 text-sm text-main focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-dim italic">* Vui lòng nhập đúng số điện thoại để tiếp tục yêu cầu hỗ trợ.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-dim uppercase tracking-wider">Chọn vấn đề cần hỗ trợ</label>
                <div className="space-y-2">
                  {availableIssues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => toggleIssue(issue.id)}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between group ${
                        issues.includes(issue.id)
                          ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                          : 'bg-surface/50 border-main text-dim hover:border-dim'
                      }`}
                    >
                      <span className="font-medium">{issue.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        issues.includes(issue.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-dim group-hover:border-main'
                      }`}>
                        {issues.includes(issue.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {issues.includes('other') && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <label className="text-xs font-bold text-dim uppercase tracking-wider">Chi tiết yêu cầu</label>
                  <textarea
                    value={otherDetail}
                    onChange={(e) => setOtherDetail(e.target.value)}
                    placeholder="Vui lòng nhập chi tiết yêu cầu của bạn..."
                    className="w-full bg-surface/50 border border-main rounded-xl p-4 text-sm text-main focus:border-blue-500 transition-all outline-none min-h-[100px] resize-none"
                  />
                </motion.div>
              )}

              <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
                <p className="text-[10px] text-blue-400 leading-relaxed">
                  Lưu ý: Bạn có thể liên hệ trực tiếp qua thông tin trên hoặc gửi yêu cầu vào hệ thống. Admin sẽ phản hồi sớm nhất có thể.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-surface/30 border-t border-main flex gap-3 shrink-0">
          {step === 2 && !isNewUser && (
            <button 
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-main hover:bg-surface transition-all text-dim"
            >
              Quay lại
            </button>
          )}
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-main hover:bg-surface transition-all text-dim"
          >
            Hủy bỏ
          </button>
          {step === 1 && !isNewUser ? (
            <button 
              onClick={() => {
                if (!phoneNumber.trim()) {
                  toast.error('Vui lòng nhập số điện thoại để xác minh.');
                  return;
                }
                if (phoneNumber !== profile?.phoneNumber) {
                  toast.error('Số điện thoại không khớp với hồ sơ của bạn. Từ chối hỗ trợ.');
                  return;
                }
                setStep(2);
              }}
              className="flex-[2] px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-all text-white flex items-center justify-center gap-2"
            >
              Tiếp tục
            </button>
          ) : (
            <button 
              onClick={() => {
                if (issues.includes('other') && !otherDetail.trim()) {
                  toast.error('Vui lòng nhập chi tiết yêu cầu của bạn.');
                  return;
                }
                onSubmit();
              }}
              disabled={issues.length === 0 || isSubmitting}
              className="flex-[2] px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Gửi yêu cầu hệ thống
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AdminSystemSettings({ 
  settings, 
  onUpdate 
}: { 
  settings: SystemSettings | null, 
  onUpdate: (
    newNumberID: string, 
    newPass2: string, 
    maintenance: boolean, 
    blockedIps: string, 
    contactMethods: ContactMethod[], 
    specialPassword?: string, 
    specialPasswordHint?: string,
    generalPassword?: string
  ) => void 
}) {
  const [numberID, setNumberID] = useState(settings?.numberID || '');
  const [pass2, setPass2] = useState(settings?.passwordLevel2 || '');
  const [maintenance, setMaintenance] = useState(settings?.isMaintenance || false);
  const [blockedIps, setBlockedIps] = useState(settings?.blockedIps?.join(', ') || '');
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>(settings?.contactMethods || []);
  const [specialPassword, setSpecialPassword] = useState(settings?.specialPassword || '');
  const [specialPasswordHint, setSpecialPasswordHint] = useState(settings?.specialPasswordHint || '');
  const [generalPassword, setGeneralPassword] = useState(settings?.generalPassword || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setNumberID(settings.numberID);
      setPass2(settings.passwordLevel2);
      setMaintenance(settings.isMaintenance);
      setBlockedIps(settings.blockedIps?.join(', ') || '');
      setContactMethods(settings.contactMethods || []);
      setSpecialPassword(settings.specialPassword || '');
      setSpecialPasswordHint(settings.specialPasswordHint || '');
      setGeneralPassword(settings.generalPassword || '');
    }
  }, [settings]);

  const handleAddContact = () => {
    const newContact: ContactMethod = {
      id: Date.now().toString(),
      type: 'other',
      label: 'Mới',
      value: ''
    };
    setContactMethods([...contactMethods, newContact]);
  };

  const handleRemoveContact = (id: string) => {
    setContactMethods(contactMethods.filter(c => c.id !== id));
  };

  const handleUpdateContact = (id: string, updates: Partial<ContactMethod>) => {
    setContactMethods(contactMethods.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(
      numberID, 
      pass2, 
      maintenance, 
      blockedIps, 
      contactMethods, 
      specialPassword, 
      specialPasswordHint,
      generalPassword
    );
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-main">Cài đặt hệ thống</h3>
          <p className="text-sm text-dim mt-1">Quản lý cấu hình và bảo mật toàn hệ thống</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Lưu thay đổi
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <div className="glass p-6 rounded-2xl border border-main space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
              <Settings className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-main">Cấu hình cơ bản</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Mã NumberID mặc định</label>
              <input 
                type="text" 
                value={numberID}
                onChange={(e) => setNumberID(e.target.value)}
                placeholder="Nhập NumberID mặc định"
                className="w-full input-field"
              />
              <p className="text-[10px] text-dim mt-1.5 italic">* Dùng để cấp cho người dùng mới</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Mật khẩu cấp 2 mặc định</label>
              <input 
                type="text" 
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="Nhập MK cấp 2 mặc định"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Mật khẩu chung (General)</label>
              <input 
                type="text" 
                value={generalPassword}
                onChange={(e) => setGeneralPassword(e.target.value)}
                placeholder="Nhập mật khẩu chung"
                className="w-full input-field"
              />
              <p className="text-[10px] text-dim mt-1.5 italic">* Mật khẩu dự phòng cho các trường hợp khẩn cấp</p>
            </div>
          </div>
        </div>

        {/* Security & Maintenance */}
        <div className="glass p-6 rounded-2xl border border-main space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-main">Bảo mật & Bảo trì</h4>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface/50 rounded-xl border border-main">
              <div>
                <p className="text-sm font-bold text-main">Chế độ bảo trì</p>
                <p className="text-[10px] text-dim">Chặn truy cập từ người dùng thông thường</p>
              </div>
              <button 
                onClick={() => setMaintenance(!maintenance)}
                className={`w-12 h-6 rounded-full transition-all relative ${maintenance ? 'bg-red-500' : 'bg-surface border border-main'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${maintenance ? 'right-1 bg-white' : 'left-1 bg-dim'}`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Chặn địa chỉ IP</label>
              <textarea 
                value={blockedIps}
                onChange={(e) => setBlockedIps(e.target.value)}
                placeholder="Nhập các IP cách nhau bằng dấu phẩy..."
                className="w-full input-field min-h-[100px] py-3 resize-none"
              />
              <p className="text-[10px] text-dim mt-1.5 italic">* Ví dụ: 1.1.1.1, 2.2.2.2</p>
            </div>
          </div>
        </div>

        {/* Special Password */}
        <div className="glass p-6 rounded-2xl border border-main space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-500">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-main">Mật khẩu đặc biệt</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Mật khẩu đặc biệt</label>
              <input 
                type="password" 
                value={specialPassword}
                onChange={(e) => setSpecialPassword(e.target.value)}
                placeholder="Nhập mật khẩu đặc biệt"
                className="w-full input-field"
              />
              <p className="text-[10px] text-dim mt-1.5 italic">* Dùng để thực hiện các thao tác nguy hiểm (xóa nhật ký...)</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-dim uppercase tracking-widest mb-2">Gợi ý mật khẩu</label>
              <input 
                type="text" 
                value={specialPasswordHint}
                onChange={(e) => setSpecialPasswordHint(e.target.value)}
                placeholder="Nhập gợi ý mật khẩu"
                className="w-full input-field"
              />
            </div>
          </div>
        </div>

        {/* Contact Methods */}
        <div className="glass p-6 rounded-2xl border border-main space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500">
                <MessageCircle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-main">Thông tin liên hệ</h4>
            </div>
            <button 
              onClick={handleAddContact}
              className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
              title="Thêm phương thức liên hệ"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {contactMethods.map((method) => (
              <div key={method.id} className="p-4 bg-surface/30 rounded-xl border border-main space-y-3 relative group">
                <button 
                  onClick={() => handleRemoveContact(method.id)}
                  className="absolute top-2 right-2 p-1.5 text-dim hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase mb-1">Loại</label>
                    <select 
                      value={method.type}
                      onChange={(e) => handleUpdateContact(method.id, { type: e.target.value as any })}
                      className="w-full bg-surface border border-main rounded-lg px-3 py-1.5 text-xs text-main outline-none"
                    >
                      <option value="phone">Số điện thoại</option>
                      <option value="email">Email</option>
                      <option value="facebook">Facebook</option>
                      <option value="telegram">Telegram</option>
                      <option value="zalo">Zalo</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase mb-1">Nhãn</label>
                    <input 
                      type="text"
                      value={method.label}
                      onChange={(e) => handleUpdateContact(method.id, { label: e.target.value })}
                      placeholder="Ví dụ: Hotline"
                      className="w-full bg-surface border border-main rounded-lg px-3 py-1.5 text-xs text-main outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase mb-1">Giá trị / Link</label>
                  <input 
                    type="text"
                    value={method.value}
                    onChange={(e) => handleUpdateContact(method.id, { value: e.target.value })}
                    placeholder="Nhập số điện thoại hoặc link..."
                    className="w-full bg-surface border border-main rounded-lg px-3 py-1.5 text-xs text-main outline-none"
                  />
                </div>
              </div>
            ))}
            {contactMethods.length === 0 && (
              <div className="text-center py-8 text-dim text-xs italic">
                Chưa có thông tin liên hệ nào
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportRequestRow({ 
  request, 
  onUpdate,
  users
}: { 
  request: SupportRequest, 
  onUpdate: (id: string, status: SupportRequest['status'], message?: string) => void,
  users: UserProfile[],
  key?: string
}) {
  const targetUser = users.find(u => u.uid === request.uid);

  const getIssueLabel = (id: string) => {
    switch (id) {
      case 'forgot_numberid': return 'Quên NumberID';
      case 'forgot_pass2': return 'Quên Mật khẩu cấp 2';
      case 'forgot_accesskey': return 'Quên mã Key';
      case 'forgot_tab_pass': return 'Quên MK Tab cá nhân';
      case 'request_key': return 'Cấp mã Key';
      case 'other': return 'Vấn đề khác';
      default: return id;
    }
  };

  const handleResolve = () => {
    // Update status in Firestore
    onUpdate(request.id!, 'resolved', 'Đã giải quyết');
  };

  const handleReject = () => {
    onUpdate(request.id!, 'rejected', 'Từ chối hỗ trợ');
  };

  return (
    <>
      <tr className="text-sm hover:bg-surface/30 transition-colors">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <img 
              src={request.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.displayName)}`} 
              className="w-10 h-10 rounded-full border border-main" 
              alt="" 
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="font-medium text-main">{request.displayName}</p>
              <p className="text-[10px] text-dim">{request.email}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {request.issues.map(issue => (
              <span key={issue} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20">
                {getIssueLabel(issue)}
              </span>
            ))}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="text-xs text-dim">
              {format(parseISO(request.createdAt), 'HH:mm dd/MM/yyyy')}
            </span>
            {request.location ? (
              <a 
                href={`https://www.google.com/maps?q=${request.location.latitude},${request.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-blue-400 hover:underline flex items-center gap-1 mt-1"
              >
                <MapPin className="w-2.5 h-2.5" />
                Xem vị trí ({request.location.latitude.toFixed(2)}, {request.location.longitude.toFixed(2)})
              </a>
            ) : (
              <span className="text-[9px] text-dim/50 mt-1 italic">Không có vị trí</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {request.status === 'pending' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase border border-yellow-500/20">
                  <Clock className="w-3 h-3" />
                  Chờ xử lý
                </span>
              )}
              {request.status === 'resolved' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase border border-green-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã giải quyết
                </span>
              )}
              {request.status === 'auto_resolved' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase border border-blue-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Tự động
                </span>
              )}
              {request.status === 'rejected' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase border border-red-500/20">
                  <X className="w-3 h-3" />
                  Từ chối
                </span>
              )}
            </div>
            {request.status === 'auto_resolved' && (
              <span className="text-[9px] text-blue-400 font-medium italic flex items-center gap-1">
                <Zap className="w-3 h-3" /> Hệ thống tự xử lý
              </span>
            )}
            {request.status === 'resolved' && (
              <span className="text-[9px] text-green-400 font-medium italic flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Admin xử lý thủ công
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          {request.status === 'pending' && (
            <div className="flex items-center justify-end gap-2">
              {request.issues.includes('other') && (
                <button 
                  onClick={handleResolve}
                  className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                  title="Đánh dấu đã giải quyết"
                >
                  <UserCheck className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={handleReject}
                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                title="Từ chối"
              >
                <UserX className="w-4 h-4" />
              </button>
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

function PermissionEditor({ user, onClose }: { user: UserProfile, onClose: () => void }) {
  const [permissions, setPermissions] = useState<AdminPermissions>(user.permissions || {
    manageUsers: false,
    managePasswords: false,
    manageTabs: false,
    viewLogs: false,
    manageSettings: false,
    manageUserTabs: false
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: keyof AdminPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { permissions });
      toast.success('Đã cập nhật quyền hạn');
      onClose();
    } catch (error) {
      toast.error('Lỗi khi lưu quyền hạn');
    } finally {
      setIsSaving(false);
    }
  };

  const permissionLabels: Record<keyof AdminPermissions, string> = {
    manageUsers: 'Quản lý người dùng',
    managePasswords: 'Quản lý mật khẩu',
    manageTabs: 'Quản lý Tab hệ thống',
    viewLogs: 'Xem nhật ký hệ thống',
    manageSettings: 'Quản lý cài đặt hệ thống',
    manageUserTabs: 'Quản lý Tab người dùng'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-blue-500/30"
      >
        <div className="p-6 border-b border-main flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-xl font-bold text-main">Quyền hạn Admin</h3>
              <p className="text-xs text-dim">{user.displayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
            <X className="w-5 h-5 text-dim" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {Object.entries(permissionLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-surface/50 rounded-2xl border border-main">
              <span className="text-sm font-medium text-main">{label}</span>
              <button 
                onClick={() => handleToggle(key as keyof AdminPermissions)}
                className={`w-12 h-6 rounded-full relative transition-colors ${permissions[key as keyof AdminPermissions] ? 'bg-blue-500' : 'bg-dim/30'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${permissions[key as keyof AdminPermissions] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-6 bg-surface/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-surface hover:bg-surface/80 text-main rounded-xl font-bold transition-all border border-main"
          >
            Hủy
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu quyền hạn'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
