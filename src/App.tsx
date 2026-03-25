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
  UserTab
} from './types';
import { encrypt, decrypt } from './lib/crypto';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
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
  Download, 
  Upload, 
  Lock, 
  Clock, 
  Menu, 
  X, 
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
  FolderLock,
  FolderOpen,
  Star,
  ArchiveRestore,
  FolderKey
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
  if (!password) return { score: 0, label: 'Chưa nhập', color: 'bg-neutral-800' };
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
  const [activeTab, setActiveTab] = useState<'passwords' | 'users' | 'logs' | 'settings' | 'userTabs'>('passwords');
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [passwordTabs, setPasswordTabs] = useState<PasswordTab[]>([]);
  const [userTabs, setUserTabs] = useState<UserTab[]>([]);
  const [activePasswordTab, setActivePasswordTab] = useState<string>('general');
  const [unlockedTabs, setUnlockedTabs] = useState<string[]>([]);
  const [tabPasswordInput, setTabPasswordInput] = useState('');
  const [isTabUnlockModalOpen, setIsTabUnlockModalOpen] = useState(false);
  const [isCreateUserTabModalOpen, setIsCreateUserTabModalOpen] = useState(false);
  const [editingUserTab, setEditingUserTab] = useState<UserTab | null>(null);
  const [tabToUnlock, setTabToUnlock] = useState<PasswordTab | UserTab | null>(null);
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [userIp, setUserIp] = useState<string>('');
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
  const [otpInput, setOtpInput] = useState('');
  const [pass2Input, setPass2Input] = useState('');
  const [accessKeyInput, setAccessKeyInput] = useState(localStorage.getItem('rememberedAccessKey') || '');
  const [rememberKey, setRememberKey] = useState(!!localStorage.getItem('rememberedAccessKey'));
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [userTabSearchTerm, setUserTabSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [specialPasswordInput, setSpecialPasswordInput] = useState('');
  const [isDeletingLogs, setIsDeletingLogs] = useState(false);
  const [showSpecialPassHint, setShowSpecialPassHint] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [secretAdminClicks, setSecretAdminClicks] = useState(0);
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  
  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);
  const [duplicateEntries, setDuplicateEntries] = useState<{ row: any, existingId: string }[]>([]);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

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
          if (user && profile) {
            updateDoc(doc(db, 'users', user.uid), {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
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
            status: 'active'
          };

          if (profileDoc.exists()) {
            const data = profileDoc.data();
            const updatedProfile = { 
              ...data, 
              lastLogin: now,
              status: data.isDisabled ? 'locked' : (data.status || 'active')
            } as UserProfile;
            await updateDoc(profileRef, { lastLogin: now, status: updatedProfile.status });
            setProfile(updatedProfile);
          } else {
            await setDoc(profileRef, defaultProfile);
            setProfile(defaultProfile);
            // Removed toast with access key as per user request
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
            otp: '123456',
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

    if (profile?.role === 'admin') {
      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });

      const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      });
    }

    return () => {
      unsubPasswords();
      unsubTabs();
      unsubUserTabs();
      unsubUsers();
      unsubLogs();
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

  // --- HANDLERS ---
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

    if (otpInput === settings.otp && 
        pass2Input === settings.passwordLevel2 && 
        accessKeyInput === profile.accessKey) {
      
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
              setProfile(prev => prev ? { ...prev, latitude, longitude, lastIp: userIp } : null);
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

      setIsSecondaryAuthPassed(true);
      toast.success('Truy cập thành công');
      logActivity('login', 'Secondary Auth Passed');
    } else {
      toast.error('Sai OTP, Mật khẩu cấp 2 hoặc Mã truy cập');
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

  const handleUpdateSettings = async (newOtp: string, newPass2: string, maintenance: boolean, blockedIps: string, contactMethods: ContactMethod[], specialPassword?: string, specialPasswordHint?: string) => {
    try {
      await updateDoc(doc(db, 'system', 'settings'), {
        otp: newOtp,
        passwordLevel2: newPass2,
        specialPassword: specialPassword || '',
        specialPasswordHint: specialPasswordHint || '',
        isMaintenance: maintenance,
        blockedIps: blockedIps.split(',').map(ip => ip.trim()).filter(ip => ip),
        contactMethods
      });
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
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-neutral-400 font-medium">Đang khởi tạo hệ thống...</p>
      </div>
    );
  }

  // Blocked IP Screen
  if (settings?.blockedIps?.includes(userIp) && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Truy cập bị chặn</h2>
          <p className="text-neutral-400 mb-6">Địa chỉ IP ({userIp}) của bạn đã bị chặn khỏi hệ thống này.</p>
          <button onClick={() => signOut(auth)} className="btn-primary w-full py-3">Quay lại</button>
        </div>
      </div>
    );
  }

  // Location Denied Screen
  if (locationStatus === 'denied' && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Yêu cầu vị trí</h2>
          <p className="text-neutral-400 mb-6">Hệ thống yêu cầu quyền truy cập vị trí để hoạt động. Vui lòng bật vị trí trong cài đặt trình duyệt và tải lại trang.</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full py-3">Tải lại trang</button>
        </div>
      </div>
    );
  }

  // User Disabled Screen
  if ((profile?.isDisabled || profile?.status === 'locked') && profile?.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="max-w-md w-full glass p-10 rounded-3xl text-center shadow-2xl border border-red-500/20">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-red-500">Tài khoản bị khóa</h2>
          <p className="text-neutral-400 mb-8 leading-relaxed">
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
              <div className="h-px flex-1 bg-neutral-800"></div>
              <span className="text-xs text-neutral-600 font-bold uppercase tracking-widest">Hoặc</span>
              <div className="h-px flex-1 bg-neutral-800"></div>
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
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-4">404</h2>
          <p className="text-neutral-400 mb-6">Trang bạn tìm kiếm không tồn tại.</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary w-full py-3">Quay lại trang chủ</button>
        </div>
      </div>
    );
  }

  // Maintenance Screen
  if (settings?.isMaintenance && profile?.role !== 'admin' && !showSecretLogin) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="max-w-md w-full glass p-8 rounded-2xl text-center">
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
          <p className="text-neutral-400">Chúng tôi đang nâng cấp hệ thống. Vui lòng quay lại sau.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass p-8 rounded-2xl shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 overflow-hidden">
            <img src={SITE_LOGO} className="w-full h-full object-cover" alt="Logo" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Quản lý Mật khẩu</h1>
          <p className="text-neutral-400 mb-8">Bảo mật mật khẩu cấp doanh nghiệp cho cuộc sống số của bạn.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 px-6 rounded-xl hover:bg-neutral-200 transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Đăng nhập với Google
          </button>
        </motion.div>
        <Toaster position="top-center" theme="dark" />
      </div>
    );
  }

  if (!isSecondaryAuthPassed) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-[#0a0a0a]">
        <div className="max-w-md w-full glass p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Xác thực đa lớp</h2>
              <p className="text-xs text-neutral-400">Yêu cầu xác minh để tiếp tục</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Mã OTP</label>
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Nhập mã OTP 6 số"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Mật khẩu cấp 2</label>
              <input 
                type="password" 
                value={pass2Input}
                onChange={(e) => setPass2Input(e.target.value)}
                placeholder="Nhập mật khẩu cấp 2"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Mã truy cập (Key)</label>
              <input 
                type="text" 
                value={accessKeyInput}
                onChange={(e) => setAccessKeyInput(e.target.value)}
                placeholder="Nhập mã truy cập 8 ký tự"
                className="w-full input-field"
              />
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="rememberKey" 
                  checked={rememberKey} 
                  onChange={(e) => setRememberKey(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="rememberKey" className="text-xs text-neutral-400 cursor-pointer">Ghi nhớ mã truy cập</label>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button 
                onClick={handleSecondaryAuth}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Xác minh & Vào hệ thống
              </button>
            </div>

            <AdminContactInfo settings={settings} />

            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl mt-4">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                <span className="font-bold uppercase block mb-1">Thông báo quan trọng:</span>
                Mỗi người dùng sẽ được cấp một mã truy cập (Key) riêng biệt. Vui lòng liên hệ Admin để nhận mã.
              </p>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 font-bold py-3 rounded-xl transition-all active:scale-95 mt-2"
            >
              Đăng xuất
            </button>
            
            <p className="text-[10px] text-center text-neutral-600 mt-4">
              Nếu quên mã truy cập, vui lòng liên hệ Admin để được cấp lại.
            </p>
          </div>
        </div>
        <Toaster position="top-center" theme="dark" />
      </div>
    );
  }

  const isPersonalTabOwner = activePasswordTab === userTabs.find(t => t.ownerId === user?.uid)?.id;

  return (
    <div className="h-screen flex bg-[#0a0a0a] text-white relative overflow-hidden">
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass border-r border-neutral-800 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-blue-500/10">
                <img src={SITE_LOGO} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold tracking-tight">SecurePass</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-neutral-800 rounded-lg">
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
            {profile?.role === 'admin' && (
              <>
                <NavItem 
                  icon={<Users className="w-5 h-5" />} 
                  label="Người dùng" 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                />
                <NavItem 
                  icon={<FolderKey className="w-5 h-5" />} 
                  label="Tab Mật khẩu User" 
                  active={activeTab === 'userTabs'} 
                  onClick={() => setActiveTab('userTabs')} 
                />
                <NavItem 
                  icon={<History className="w-5 h-5" />} 
                  label="Nhật ký" 
                  active={activeTab === 'logs'} 
                  onClick={() => setActiveTab('logs')} 
                />
                <NavItem 
                  icon={<Settings className="w-5 h-5" />} 
                  label="Cài đặt" 
                  active={activeTab === 'settings'} 
                  onClick={() => setActiveTab('settings')} 
                />
              </>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-neutral-800 space-y-4">
            <div className="flex items-center gap-3 p-2">
              <img src={profile?.photoURL} className="w-10 h-10 rounded-full border border-neutral-700" alt="User" />
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{profile?.displayName}</p>
                <p className="text-xs text-neutral-500 truncate">{profile?.email}</p>
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
        <header className="h-16 glass border-b border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 hover:bg-neutral-800 rounded-lg">
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <h2 className="text-lg font-semibold capitalize">
              {activeTab === 'passwords' ? 'Mật khẩu' : activeTab === 'users' ? 'Người dùng' : activeTab === 'userTabs' ? 'Tab Mật khẩu User' : activeTab === 'logs' ? 'Nhật ký' : 'Cài đặt'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <Clock className="w-3 h-3" />
                <span>Lần đầu: {profile?.firstLogin ? format(parseISO(profile.firstLogin), 'HH:mm dd/MM') : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-neutral-400">
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
                      <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">MK Chung</p>
                      <p className="text-2xl font-bold text-blue-500">{stats.totalGeneralPasswords}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">MK Tab Con</p>
                      <p className="text-2xl font-bold text-purple-500">{stats.totalTabPasswords}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Người dùng</p>
                      <p className="text-2xl font-bold text-green-500">{stats.totalUsers}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Hoạt động</p>
                      <p className="text-2xl font-bold text-yellow-500">{stats.activeUsers}</p>
                    </div>
                    <div className="glass p-4 rounded-xl">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">IP bị chặn</p>
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
                        : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                          : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                          : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                              : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white border border-dashed border-neutral-700"
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
                          : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm mật khẩu..." 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {(profile?.role === 'admin' || isPersonalTabOwner) && activePasswordTab !== 'trash' && (
                    <div className="flex gap-2">
                      <button onClick={handleExportExcel} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                        <Download className="w-4 h-4" />
                        Xuất Excel
                      </button>
                      <label className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer">
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
                            isAdmin={profile?.role === 'admin' || isPersonalTabOwner}
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
                          <th className="px-6 py-4 font-semibold">Vai trò</th>
                          <th className="px-6 py-4 font-semibold">Truy cập</th>
                          <th className="px-6 py-4 font-semibold">Trạng thái</th>
                          <th className="px-6 py-4 font-semibold">Mã Key</th>
                          <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {users.filter(u => 
                          u.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                        ).map((u) => (
                          <UserRow 
                            key={u.uid} 
                            user={u} 
                            onUpdate={handleUpdateUserAccess} 
                            onDelete={handleDeleteUser}
                          />
                        ))}
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
                            <tr key={tab.id} className="hover:bg-neutral-800/30 transition-colors">
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
                      className="bg-neutral-800 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm outline-none"
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

            {activeTab === 'settings' && profile?.role === 'admin' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <div className="glass p-8 rounded-2xl space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <Settings className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Cấu hình hệ thống</h3>
                      <p className="text-sm text-neutral-400">Quản lý bảo mật và bảo trì toàn cục</p>
                    </div>
                  </div>

                  <form className="space-y-6" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleUpdateSettings(
                      formData.get('otp') as string,
                      formData.get('pass2') as string,
                      (e.currentTarget.elements.namedItem('maintenance') as HTMLInputElement).checked,
                      formData.get('blockedIps') as string,
                      settings?.contactMethods || [],
                      formData.get('specialPassword') as string,
                      formData.get('specialPasswordHint') as string
                    );
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Smart OTP</label>
                        <input name="otp" type="text" inputMode="numeric" defaultValue={settings?.otp} className="w-full input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Mật khẩu cấp 2</label>
                        <input name="pass2" type="text" defaultValue={settings?.passwordLevel2} className="w-full input-field" />
                      </div>
                    </div>

                    <div className="glass p-6 rounded-2xl space-y-4 border border-red-500/10">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-red-500 uppercase tracking-wider">
                        <Lock className="w-4 h-4" />
                        Bảo mật nâng cao (Admin)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Mật khẩu đặc biệt</label>
                          <input 
                            name="specialPassword"
                            type="password" 
                            defaultValue={settings?.specialPassword || ''}
                            placeholder="Dùng để xóa nhật ký"
                            className="w-full input-field py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Gợi ý mật khẩu (Hint)</label>
                          <input 
                            name="specialPasswordHint"
                            type="text" 
                            defaultValue={settings?.specialPasswordHint || ''}
                            placeholder="Gợi ý nơi lưu trên Firebase"
                            className="w-full input-field py-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-500 italic">
                        * Mật khẩu đặc biệt dùng để xác thực các hành động nguy hiểm như xóa toàn bộ nhật ký hệ thống.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-2">Chặn địa chỉ IP (cách nhau bằng dấu phẩy)</label>
                      <textarea 
                        name="blockedIps" 
                        defaultValue={settings?.blockedIps?.join(', ')} 
                        placeholder="192.168.1.1, 10.0.0.1"
                        className="w-full input-field min-h-[80px] py-2"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium">Chế độ bảo trì</p>
                          <p className="text-xs text-neutral-500">Chỉ quản trị viên mới có thể truy cập khi bật</p>
                        </div>
                      </div>
                      <input name="maintenance" type="checkbox" defaultChecked={settings?.isMaintenance} className="w-6 h-6 accent-blue-500" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Thông tin liên hệ Admin</h4>
                        <button 
                          type="button"
                          onClick={() => {
                            const newMethod: ContactMethod = {
                              id: Math.random().toString(36).substr(2, 9),
                              type: 'phone',
                              label: 'Số điện thoại',
                              value: ''
                            };
                            if (settings) {
                              setSettings({
                                ...settings,
                                contactMethods: [...(settings.contactMethods || []), newMethod]
                              });
                            }
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Thêm phương thức
                        </button>
                      </div>

                      <div className="overflow-x-auto pb-2 scrollbar-hide">
                        <div className="space-y-3 min-w-[500px]">
                          {settings?.contactMethods?.map((method, index) => (
                            <div key={method.id} className="flex gap-2 items-start">
                              <select 
                                value={method.type}
                                onChange={(e) => {
                                  const newMethods = [...(settings.contactMethods || [])];
                                  newMethods[index].type = e.target.value as any;
                                  setSettings({ ...settings, contactMethods: newMethods });
                                }}
                                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-2 text-xs outline-none w-24"
                              >
                                <option value="phone">SĐT</option>
                                <option value="email">Email</option>
                                <option value="facebook">FB</option>
                                <option value="telegram">Tele</option>
                                <option value="zalo">Zalo</option>
                                <option value="other">Khác</option>
                              </select>
                              <input 
                                type="text"
                                placeholder="Nhãn (VD: Zalo Admin)"
                                value={method.label}
                                onChange={(e) => {
                                  const newMethods = [...(settings.contactMethods || [])];
                                  newMethods[index].label = e.target.value;
                                  setSettings({ ...settings, contactMethods: newMethods });
                                }}
                                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none"
                              />
                              <input 
                                type="text"
                                placeholder="Giá trị (VD: 0987...)"
                                value={method.value}
                                onChange={(e) => {
                                  const newMethods = [...(settings.contactMethods || [])];
                                  newMethods[index].value = e.target.value;
                                  setSettings({ ...settings, contactMethods: newMethods });
                                }}
                                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newMethods = settings.contactMethods?.filter(m => m.id !== method.id);
                                  setSettings({ ...settings, contactMethods: newMethods });
                                }}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="w-full btn-primary py-3">
                      Lưu thay đổi hệ thống
                    </button>
                  </form>
                </div>

                <AdminPasswordTabsSettings passwordTabs={passwordTabs} settings={settings} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <dialog id="add-modal" className="modal bg-black/60 backdrop-blur-sm">
        <div className="modal-box glass border border-neutral-800 p-8 rounded-2xl max-w-md w-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold">{editingPassword ? 'Chỉnh sửa mật khẩu' : 'Thêm mật khẩu mới'}</h3>
            <form method="dialog">
              <button onClick={() => setEditingPassword(null)} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
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
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Trang web</label>
              <input name="website" type="text" defaultValue={editingPassword?.website} required placeholder="Ví dụ: facebook.com" className="w-full input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Tên đăng nhập</label>
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
                  <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
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
                <div key={idx} className="bg-neutral-800/50 p-3 rounded-xl border border-neutral-800 text-xs">
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
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-all active:scale-95"
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

      <Toaster position="top-right" theme="dark" richColors />

      {/* Delete Logs Modal */}
      {isDeletingLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
          >
            <h3 className="font-bold text-xl text-red-500 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" />
              Xác nhận xóa nhật ký
            </h3>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Hành động này sẽ xóa toàn bộ nhật ký hoạt động của hệ thống. 
              Bạn cần nhập <span className="text-white font-bold">Mật khẩu đặc biệt</span> để tiếp tục.
            </p>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mật khẩu đặc biệt</label>
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
                <button 
                  onClick={() => {
                    setIsTabUnlockModalOpen(false);
                    setTabPasswordInput('');
                    setTabToUnlock(null);
                  }}
                  className="text-sm text-neutral-400 hover:text-white font-medium"
                >
                  Hủy bỏ
                </button>
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
              const oldPassword = (form.elements.namedItem('oldPassword') as HTMLInputElement).value;
              const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
              
              if (!name) {
                toast.error('Vui lòng nhập tên tab');
                return;
              }

              const updateData: any = { name };
              
              if (newPassword) {
                if (profile?.role !== 'admin') {
                  if (!oldPassword) {
                    toast.error('Vui lòng nhập mật khẩu cũ để đổi mật khẩu mới');
                    return;
                  }
                  if (oldPassword !== decrypt(editingUserTab.password)) {
                    toast.error('Mật khẩu cũ không chính xác');
                    return;
                  }
                }
                updateData.password = encrypt(newPassword);
              }

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
              {profile?.role !== 'admin' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mật khẩu cũ (nếu muốn đổi)</label>
                  <input 
                    type="password" 
                    name="oldPassword"
                    placeholder="Nhập mật khẩu cũ..." 
                    className="w-full input-field py-4"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mật khẩu mới</label>
                <input 
                  type="password" 
                  name="newPassword"
                  placeholder="Nhập mật khẩu mới..." 
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
    const oldPassword = formData.get('oldPassword') as string;

    try {
      if (editingTab) {
        const updateData: any = { name };
        if (password) {
          if (!oldPassword) {
            toast.error('Vui lòng nhập mật khẩu cũ để đổi mật khẩu mới');
            return;
          }
          if (oldPassword !== decrypt(editingTab.password)) {
            toast.error('Mật khẩu cũ không chính xác');
            return;
          }
          updateData.password = encrypt(password);
        }
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
            {editingTab ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Mật khẩu cũ</label>
                  <input 
                    name="oldPassword"
                    type="password" 
                    placeholder="Nhập mật khẩu cũ để đổi"
                    className="w-full input-field py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Mật khẩu mới</label>
                  <input 
                    name="password"
                    type="password" 
                    placeholder="Để trống nếu không muốn đổi"
                    className="w-full input-field py-2.5 text-sm"
                  />
                </div>
              </>
            ) : (
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
              {tab.isHidden && <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">Đang ẩn</span>}
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
                className={`p-2 rounded-lg transition-colors ${tab.isHidden ? 'text-neutral-500 hover:bg-neutral-800 hover:text-white' : 'text-blue-400 hover:bg-blue-500/10'}`}
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

function AdminContactInfo({ settings }: { settings: SystemSettings | null }) {
  if (!settings?.contactMethods || settings.contactMethods.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3 w-full">
      <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em]">Liên hệ Admin</p>
      <div className="flex items-center justify-center gap-3 flex-wrap max-w-full px-2">
        {settings.contactMethods.map((method) => (
          <a 
            key={method.id}
            href={method.type === 'phone' ? `tel:${method.value}` : method.type === 'email' ? `mailto:${method.value}` : method.value}
            target="_blank"
            rel="noreferrer"
            title={method.label}
            className="w-9 h-9 bg-neutral-900/50 hover:bg-blue-500/10 rounded-full border border-neutral-800 hover:border-blue-500/30 flex items-center justify-center transition-all group shrink-0"
          >
            {method.type === 'phone' && <Phone className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
            {method.type === 'email' && <Mail className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
            {method.type === 'facebook' && <Facebook className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
            {method.type === 'telegram' && <Send className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
            {method.type === 'zalo' && <MessageCircle className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
            {method.type === 'other' && <Link className="w-4 h-4 text-neutral-500 group-hover:text-blue-400" />}
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
          : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
    <tr className={`text-sm hover:bg-neutral-900/30 transition-colors group ${isPinnedByUser ? 'bg-blue-900/10' : ''}`}>
      <td className="px-6 py-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-all ${isPinnedByUser ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-neutral-600 hover:text-yellow-500 hover:bg-yellow-500/10 opacity-0 group-hover:opacity-100'}`}
          >
            <Star className="w-4 h-4" fill={isPinnedByUser ? "currentColor" : "none"} />
          </button>
          <img 
            src={favicon} 
            className="w-8 h-8 rounded-lg bg-neutral-800 p-1.5" 
            alt="icon" 
            referrerPolicy="no-referrer"
            onError={(e) => (e.currentTarget.src = 'https://www.google.com/favicon.ico')}
          />
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[150px]">{entry.website}</span>
            <a href={entry.website} target="_blank" rel="noreferrer" className="text-[10px] text-neutral-500 hover:text-blue-400 flex items-center gap-1">
              Truy cập <ExternalLink className="w-2 h-2" />
            </a>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-300 truncate max-w-[120px]">{entry.username}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(entry.username);
              toast.success('Đã sao chép tên đăng nhập');
            }}
            className="p-1 text-neutral-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-neutral-400 select-none">
            {showPass ? decrypt(entry.password) : '••••••••'}
          </span>
          <button 
            onMouseDown={handleShowPassStart}
            onMouseUp={handleShowPassEnd}
            onMouseLeave={handleShowPassEnd}
            onTouchStart={handleShowPassStart}
            onTouchEnd={handleShowPassEnd}
            className="p-1 text-neutral-600 hover:text-white active:text-blue-400 cursor-pointer"
            title="Chạm và giữ để xem"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <span className="text-neutral-500 text-xs italic truncate max-w-[150px] block">
          {entry.notes || 'Không có ghi chú'}
        </span>
      </td>
      <td className="px-6 py-4 text-right min-w-[150px]">
        <div className="flex items-center justify-end gap-2">
          {!isTrashView ? (
            <>
              <button 
                onClick={onCopy}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Sao chép
              </button>
              {isAdmin && (
                <>
                  <button 
                    onClick={onEdit}
                    className="p-2 text-neutral-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={onDelete}
                    className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
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
                    className="flex items-center gap-2 bg-neutral-800 hover:bg-green-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
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

const UserRow: React.FC<{ user: UserProfile, onUpdate: (uid: string, disabled: boolean, newAccessKey?: string) => void, onDelete: (uid: string) => void }> = ({ user, onUpdate, onDelete }) => {
  const [disabled, setDisabled] = useState(!!user.isDisabled);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [newKey, setNewKey] = useState(user.accessKey || '');
  const status = user.isDisabled ? 'locked' : (user.status || 'active');

  return (
    <tr className="text-sm hover:bg-neutral-900/30 transition-colors">
      <td className="px-6 py-4 min-w-[250px]">
        <div className="flex items-center gap-3">
          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`} className="w-10 h-10 rounded-full border border-neutral-800" alt="" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{user.displayName || 'Người dùng ẩn danh'}</p>
              {user.latitude && user.longitude && (
                <a 
                  href={`https://www.google.com/maps?q=${user.latitude},${user.longitude}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                  title="Xem vị trí trên bản đồ"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[10px] text-neutral-500">{user.email}</p>
            <p className="text-[10px] text-neutral-600 font-mono">IP: {user.lastIp || 'N/A'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[120px]">
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
          user.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-neutral-500/10 text-neutral-400'
        }`}>
          {user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
        </span>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Clock className="w-3 h-3" />
            <span>Lần đầu: {user.firstLogin ? format(parseISO(user.firstLogin), 'HH:mm dd/MM') : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <History className="w-3 h-3" />
            <span>Gần nhất: {user.lastLogin ? format(parseISO(user.lastLogin), 'HH:mm dd/MM') : 'N/A'}</span>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[120px]">
        <div className="flex flex-col gap-2">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase text-center ${
            status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {status === 'active' ? 'Đang hoạt động' : 'Đã bị khóa'}
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={disabled} 
              onChange={(e) => setDisabled(e.target.checked)}
              className="w-3 h-3 accent-red-500"
            />
            <span className="text-[10px] text-neutral-500">Vô hiệu hóa</span>
          </label>
        </div>
      </td>
      <td className="px-6 py-4 min-w-[150px]">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-neutral-500 mb-1">Mã truy cập:</p>
          {isEditingKey ? (
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={newKey} 
                onChange={(e) => setNewKey(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 px-2 py-1 rounded font-mono text-[10px] text-white outline-none w-24"
              />
              <button onClick={() => {
                if (newKey.length !== 8) {
                  toast.error('Mã truy cập phải có đúng 8 ký tự');
                  return;
                }
                onUpdate(user.uid, disabled, newKey);
                setIsEditingKey(false);
              }} className="text-green-400 hover:text-green-300">
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => {
                setNewKey(user.accessKey || '');
                setIsEditingKey(false);
              }} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded font-mono text-[10px] text-blue-400">
              {user.accessKey || 'N/A'}
              <button onClick={() => {
                if (user.accessKey) {
                  navigator.clipboard.writeText(user.accessKey);
                  toast.success('Đã sao chép mã truy cập');
                }
              }} className="hover:text-white">
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={() => setIsEditingKey(true)} className="hover:text-white ml-auto">
                <Settings className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right min-w-[120px]">
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => onUpdate(user.uid, disabled)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
          >
            Lưu
          </button>
          <button 
            onClick={() => onDelete(user.uid)}
            className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
