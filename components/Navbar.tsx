'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

import {
  LogOut,
  Users,
  Fingerprint,
  ClipboardList,
  ShieldCheck,
  Menu,
  X,
  User,
  ChevronDown,
  Settings,
  FileClock,
  Bell,
  CheckCircle2,
  ArrowLeft,
  CalendarDays,
  Clock,
  CheckCircle,
  Workflow,
  UsersRound,
  ChartNoAxesCombined,
  UserX,
  Scale
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [dbUserName, setDbUserName] = useState<string>('جاري التحميل...');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
    setShowNotifs(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setShowNotifs(false);
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUserAndData = () => {
    const userStr = localStorage.getItem('ot_user');
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      fetchUserDataAndNotifications(parsedUser.id, parsedUser.role);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUserAndData();

    const handleNewNotif = () => loadUserAndData();
    const handleStorageChange = () => loadUserAndData();

    window.addEventListener('new_notification', handleNewNotif);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user_login_changed', handleStorageChange);

    // ==========================================
    // 🔴 1. فتح قناة Realtime مع Supabase 
    // ==========================================
    const userStr = localStorage.getItem('ot_user');
    let realtimeChannel: any = null;

    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      
      // مش هنزعج مدخل البيانات بالإشعارات
      if (parsedUser.role !== 'DATA_ENTRY') {
        realtimeChannel = supabase.channel('realtime_notifications')
          .on(
            'postgres_changes',
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'notifications',
              // المدير يشوف إشعارات إدارته بس، الأدمن يشوف كل حاجة
              filter: parsedUser.role === 'MANAGER' ? `department_id=eq.${parsedUser.department_id}` : undefined
            },
            (payload) => {
              // ==========================================
              // 🎵 2. نظام الصوت الآمن (Fallback System)
              // ==========================================
              const playSound = async () => {
                const title = payload.new.title || '';
                let soundFile = '/sound-default.mp3'; // الأساسي اللي لازم يكون موجود

                // تحديد الصوت بناءً على الكلمة
                if (title.includes('غياب')) soundFile = '/sound-absence.mp3';
                else if (title.includes('جزاء')) soundFile = '/sound-penalty.mp3';
                else if (title.includes('تكليف') || title.includes('إضافي')) soundFile = '/sound-assignment.mp3';
                else if (title.includes('إجازة') || title.includes('إذن')) soundFile = '/sound-leave.mp3';

                try {
                  const audio = new Audio(soundFile);
                  await audio.play();
                } catch (e) {
                  // لو الملف المخصص مش موجود أو حصل أي خطأ، هنشغل الأساسي
                  console.log(`Failed to play ${soundFile}, playing default sound.`);
                  try {
                    const fallbackAudio = new Audio('/sound-default.mp3');
                    await fallbackAudio.play();
                  } catch (fallbackError) {
                    console.log('Autoplay blocked by browser or default sound missing');
                  }
                }
              };

              playSound(); // تشغيل الدالة

              // 2. تحديث الجرس والقائمة فوراً بدون Refresh
              setNotifications(prev => [payload.new, ...prev]);

              // 3. إظهار الإشعار بره المتصفح (Browser/OS Notification)
              if (Notification.permission === 'granted') {
                new Notification(payload.new.title, {
                  body: payload.new.body,
                  icon: '/logo-name.png' // لوجو السيستم
                });
              }
            }
          )
          .subscribe();
      }
    }

    // طلب صلاحية الإشعارات الخارجية أول مرة يفتح فيها السيستم
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('new_notification', handleNewNotif);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user_login_changed', handleStorageChange);
      
      // إغلاق الاتصال لما اليوزر يخرج عشان منستهلكش السيرفر
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  async function fetchUserDataAndNotifications(userId: string, role: string) {
    try {
      const { data: userData } = await supabase.from('users').select('name, department_id').eq('id', userId).single();
      if (userData) {
        setDbUserName(userData.name);

        if (role !== 'DATA_ENTRY') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          let query = supabase.from('notifications').select('*').gte('created_at', startOfToday.toISOString()).order('created_at', { ascending: false });

          if (role === 'MANAGER' && userData.department_id) {
            query = query.eq('department_id', userData.department_id);
          }

          const { data: notifs } = await query;
          if (notifs) setNotifications(notifs);
        }
      }
    } catch (error) {
      console.error('Error fetching user data or notifications', error);
      setDbUserName(user?.name || 'مستخدم');
    }
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  if (pathname === '/login') return null;
  if (!user) return null;

  const navigationGroups = [
    {
      id: 'operations',
      name: 'العمليات والتشغيل',
      icon: Workflow,
      items: [
        { name: 'التكاليف', description: 'إنشاء وإدارة تكليفات العمل الإضافي', href: '/assignments', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'سجل البصمة', description: 'متابعة سجلات الحضور والانصراف', href: '/attendance', icon: Fingerprint, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
      ],
    },
    {
      id: 'employees',
      name: 'شؤون الموظفين والطلبات',
      icon: UsersRound,
      items: [
        { name: 'إدارة الموظفين', description: 'إدارة بيانات الموظفين', href: '/employees', icon: Users, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'الأجازات', description: 'إدارة طلبات الأجازات', href: '/leaves', icon: CalendarDays, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'الأذونات', description: 'إدارة طلبات الأذونات', href: '/permissions', icon: Clock, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'الغياب', description: 'إدارة كشوف الغياب', href: '/absences', icon: UserX, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'الجزاءات', description: 'طلبات توقيع الجزاءات', href: '/penalties', icon: Scale, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
      ],
    },
    {
      id: 'reports',
      name: 'التقارير والاعتمادات',
      icon: ChartNoAxesCombined,
      items: [
        { name: 'مركز الموافقات', description: 'مراجعة واعتماد الطلبات', href: '/approvals', icon: CheckCircle, roles: ['ADMIN', 'MANAGER', 'FACTORY_MANAGER'] },
        { name: 'تصدير التايم شيت', description: 'إنشاء وتصدير سجلات التايم شيت', href: '/timesheet', icon: FileClock, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
        { name: 'المطابقة والتدقيق', description: 'مراجعة ومطابقة بيانات OT', href: '/audit', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
      ],
    },
  ];

  const visibleGroups = navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(user.role)), })).filter((group) => group.items.length > 0);
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const isGroupActive = (group: any) => group.items.some((item: any) => pathname === item.href);

  const toggleMenu = (menuId: string) => {
    setOpenMenu(openMenu === menuId ? null : menuId);
    setIsProfileOpen(false);
    setShowNotifs(false);
  };

  const handleLogout = () => {
    setIsProfileOpen(false); setShowNotifs(false); setIsMobileMenuOpen(false); setOpenMenu(null);
    localStorage.removeItem('ot_user');
    window.dispatchEvent(new Event('user_login_changed'));
    router.push('/login');
  };

  return (
    <nav ref={navRef} className="bg-slate-50 text-slate-900 border-b border-slate-200 shadow-sm print:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          <div className="flex items-center gap-8">
            <Link href="/" className="flex-shrink-0 flex items-center hover:opacity-90 transition cursor-pointer">
              <img src="/logo-name.png" alt="StaffCore" className="h-12 w-auto object-contain" />
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {visibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const active = isGroupActive(group);
                const isOpen = openMenu === group.id;

                return (
                  <div key={group.id} className="relative">
                    <button onClick={() => toggleMenu(group.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                      <GroupIcon size={17} />
                      <span>{group.name}</span>
                      <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute top-full right-0 mt-2 w-[330px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><GroupIcon size={17} /></div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{group.name}</p>
                              <p className="text-[11px] text-slate-500">اختر الخدمة التي تريد فتحها</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-2">
                          {group.items.map((item: any) => {
                            const ItemIcon = item.icon;
                            const itemActive = pathname === item.href;
                            return (
                              <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)} className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${itemActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${itemActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                  <ItemIcon size={19} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-bold ${itemActive ? 'text-blue-700' : 'text-slate-800'}`}>{item.name}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                                </div>
                                <ArrowLeft size={15} className={`transition-all ${itemActive ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-500 group-hover:-translate-x-1'}`} />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            {user.role === 'ADMIN' && (
              <Link href="/settings" className={`hidden md:flex p-2 rounded-full transition border shadow-sm ${pathname === '/settings' ? 'bg-[var(--color-navy-900)] text-white border-[var(--color-navy-900)]' : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-100 border-slate-200'}`} title="إعدادات النظام">
                <Settings size={20} className={pathname === '/settings' ? 'animate-spin-slow' : ''} />
              </Link>
            )}

            {user.role !== 'DATA_ENTRY' && (
              <div className="relative">
                <button onClick={() => { setShowNotifs(!showNotifs); setIsProfileOpen(false); setOpenMenu(null); setIsMobileMenuOpen(false); }} className="relative p-2 rounded-full bg-white hover:bg-slate-100 transition text-slate-600 hover:text-blue-600 border border-slate-200 shadow-sm">
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse border-2 border-slate-50 shadow-sm">{unreadCount}</span>}
                </button>

                {showNotifs && (
                  <div className="absolute left-0 top-12 mt-2 w-[calc(100vw-2rem)] max-w-[320px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 z-50 flex flex-col">
                    <div className="bg-slate-50 p-3 border-b border-slate-200 font-bold flex justify-between items-center">
                      <span className="text-sm text-slate-700">إشعارات اليوم</span>
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{unreadCount} غير مقروء</span>
                    </div>

                    <div className="max-h-72 overflow-y-auto bg-slate-50">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-center text-slate-500 font-bold text-sm">لا توجد حركات مسجلة اليوم</p>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} onClick={() => {
                              markAsRead(notif.id);
                              if (notif.target_url) router.push(notif.target_url);
                              else if (notif.title.includes('إجازة') || notif.title.includes('إذن') || notif.title.includes('تكليف') || notif.title.includes('غياب') || notif.title.includes('جزاء')) {
                                if (user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'FACTORY_MANAGER') router.push('/approvals');
                              }
                              setShowNotifs(false);
                            }}
                            className={`p-4 border-b transition cursor-pointer relative group ${notif.is_read ? 'bg-white opacity-75' : 'bg-blue-50/80 shadow-inner'}`}
                          >
                            <h4 className={`text-sm mb-1 ${notif.is_read ? 'text-slate-600 font-bold' : 'text-slate-900 font-black'}`}>{notif.title}</h4>
                            <p className="text-[11px] text-slate-600 font-semibold whitespace-pre-wrap leading-relaxed">{notif.body}</p>
                            {!notif.is_read && <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }} className="absolute top-4 left-4 text-slate-400 hover:text-green-500 md:opacity-0 md:group-hover:opacity-100 transition" title="تحديد كمقروء"><CheckCircle2 size={18} /></button>}
                            {notif.is_read && <span className="absolute top-4 left-4 text-green-500/50"><CheckCircle2 size={16} /></span>}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="bg-white p-2 border-t border-slate-100 text-center flex flex-col">
                      <Link href="/notifications" onClick={() => setShowNotifs(false)} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center justify-center gap-2 w-full py-2 hover:bg-blue-50 rounded-lg">عرض السجل الكامل للإشعارات <ArrowLeft size={14} /></Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block relative">
              <button onClick={() => { setIsProfileOpen(!isProfileOpen); setShowNotifs(false); setOpenMenu(null); }} className="flex items-center gap-2 text-sm bg-white hover:bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm transition">
                <User size={16} className="text-blue-600" />
                <span className="font-bold text-slate-700">{dbUserName}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                <div className="absolute top-12 left-0 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b mb-1 bg-slate-50">
                    <p className="text-sm font-bold text-slate-800">{dbUserName}</p>
                    <p className="text-xs text-slate-500">{user.role === 'ADMIN' ? 'مدير النظام' : user.role === 'DATA_ENTRY' ? 'مدخل بيانات' : user.role === 'FACTORY_MANAGER' ? 'مدير المصنع' : 'مدير إدارة'}</p>
                  </div>
                  <button onClick={() => { setIsProfileOpen(false); router.push('/profile'); }} className="w-full text-right px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition"><Settings size={16} className="text-slate-500" /> تعديل الحساب</button>
                  <button onClick={handleLogout} className="w-full text-right px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"><LogOut size={16} /> تسجيل خروج</button>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => { setIsMobileMenuOpen(!isMobileMenuOpen); setShowNotifs(false); setIsProfileOpen(false); setOpenMenu(null); }} className="text-slate-600 hover:text-blue-600 p-1 relative">
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                {user.role !== 'DATA_ENTRY' && unreadCount > 0 && !isMobileMenuOpen && <span className="absolute top-1 right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-50"></span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 shadow-lg animate-in slide-in-from-top-2">
          <div className="px-3 pt-3 pb-4">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = isGroupActive(group);
              const isOpen = openMenu === group.id;

              return (
                <div key={group.id} className="mb-2">
                  <button onClick={() => setOpenMenu(isOpen ? null : group.id)} className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-bold transition ${active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <span className="flex items-center gap-3"><GroupIcon size={19} />{group.name}</span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="mt-1 mr-3 border-r border-slate-300 pr-2 space-y-1">
                      {group.items.map((item: any) => {
                        const ItemIcon = item.icon;
                        const itemActive = pathname === item.href;
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold transition ${itemActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <ItemIcon size={18} /><span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="border-t border-slate-200 mt-3 pt-3">
              {user.role !== 'DATA_ENTRY' && unreadCount > 0 && (
                <div className="px-3 py-2 text-sm text-blue-600 font-bold border-b border-slate-200 mb-2 pb-2">يوجد لديك ({unreadCount}) إشعارات غير مقروءة</div>
              )}
              <div className="px-3 py-3 border-b border-slate-200 mb-2">
                <p className="text-slate-900 font-bold">{dbUserName}</p>
                <p className="text-slate-500 text-xs">{user.role === 'ADMIN' ? 'مدير النظام' : user.role === 'DATA_ENTRY' ? 'مدخل بيانات' : user.role === 'FACTORY_MANAGER' ? 'مدير المصنع' : 'مدير إدارة'}</p>
              </div>
              {user.role === 'ADMIN' && (
                <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-blue-600 hover:bg-blue-50"><Settings size={18} /> إعدادات النظام</Link>
              )}
              <button onClick={() => { setIsMobileMenuOpen(false); router.push('/profile'); }} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-slate-600 hover:bg-slate-100"><Settings size={18} /> تعديل الحساب</button>
              <button onClick={handleLogout} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-red-600 hover:bg-red-50"><LogOut size={18} /> تسجيل خروج</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}