'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, Users, Fingerprint, ClipboardList, ShieldCheck, Menu, X, User, ChevronDown, Settings, FileClock, Bell, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [dbUserName, setDbUserName] = useState<string>('جاري التحميل...'); // 🔴 لحفظ الاسم الحقيقي من الداتابيز
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
    setShowNotifs(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('ot_user');
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      // 🔴 بننادي الدالة عشان تجيب الداتا الحقيقية (الاسم والإشعارات) بناءً على الـ ID
      fetchUserDataAndNotifications(parsedUser.id, parsedUser.role);
    }

    const handleNewNotif = () => {
      const currentUserStr = localStorage.getItem('ot_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        fetchUserDataAndNotifications(currentUser.id, currentUser.role);
      }
    };

    window.addEventListener('new_notification', handleNewNotif);
    return () => window.removeEventListener('new_notification', handleNewNotif);
  }, []);

  // 🔴 الدالة دي اتعدلت عشان تجيب الاسم الحقيقي من الداتابيز مع الإشعارات
  async function fetchUserDataAndNotifications(userId: string, role: string) {
    try {
      const { data: userData } = await supabase.from('users').select('name, department_id').eq('id', userId).single();
      
      if (userData) {
        setDbUserName(userData.name); // 🔴 تحديث الاسم الفعلي
        
        if (role !== 'DATA_ENTRY') {
          // 🔴 جلب إشعارات اليوم فقط للنافبار
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          
          let query = supabase.from('notifications')
            .select('*')
            .gte('created_at', startOfToday.toISOString())
            .order('created_at', { ascending: false });
            
          if (role === 'MANAGER' && userData.department_id) {
            query = query.eq('department_id', userData.department_id); 
          }
          
          const { data: notifs } = await query;
          if (notifs) setNotifications(notifs);
        }
      }
    } catch (error) {
      console.error("Error fetching user data or notifications", error);
      setDbUserName(user?.name || 'مستخدم'); // لو حصل خطأ نستخدم الاسم القديم
    }
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  if (pathname === '/login') return null;
  if (!user) return null;

  const handleLogout = () => {
    setIsProfileOpen(false);
    setShowNotifs(false);
    setIsMobileMenuOpen(false);
    localStorage.removeItem('ot_user');
    router.push('/login');
  };

  const navLinks = [
    { name: 'الموظفين', href: '/employees', icon: Users, roles: ['ADMIN', 'MANAGER'] },
    { name: 'البصمة', href: '/attendance', icon: Fingerprint, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
    { name: 'التكاليف', href: '/assignments', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
    { name: 'التايم شيت', href: '/timesheet', icon: FileClock, roles: ['ADMIN', 'MANAGER'] },
    { name: 'المطابقة', href: '/audit', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER'] },
  ];

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav ref={navRef} className="bg-[var(--color-navy-900)] text-white shadow-lg print:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href={user.role === 'DATA_ENTRY' ? '/assignments' : '/'} className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition cursor-pointer">
              <div className="bg-white text-[var(--color-navy-900)] p-1.5 rounded-lg shadow-sm">
                <ShieldCheck size={24} />
              </div>
              <span className="font-black text-xl tracking-wider hidden sm:block">OT Audit</span>
            </Link>
            
            <div className="hidden md:flex space-x-reverse space-x-1">
              {navLinks.map((link) => {
                if (!link.roles.includes(user.role)) return null;
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link key={link.name} href={link.href} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:bg-[var(--color-navy-800)] hover:text-white'}`}>
                    <Icon size={16} /> {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user.role !== 'DATA_ENTRY' && (
              <div className="relative">
                <button onClick={() => {setShowNotifs(!showNotifs); setIsProfileOpen(false); setIsMobileMenuOpen(false);}} className="relative p-2 bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] rounded-full transition text-blue-300 hover:text-white border border-[var(--color-navy-500)]">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse border border-[var(--color-navy-900)] shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute left-0 top-12 mt-2 w-[calc(100vw-2rem)] max-w-[320px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden text-gray-800 animate-in fade-in slide-in-from-top-2 z-50 flex flex-col">
                    <div className="bg-gray-50 p-3 border-b border-gray-200 font-bold flex justify-between items-center">
                      <span className="text-sm text-gray-700">إشعارات اليوم</span>
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{unreadCount} غير مقروء</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto bg-gray-50">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-center text-gray-500 font-bold text-sm">لا توجد حركات مسجلة اليوم</p>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className={`p-4 border-b transition relative group ${notif.is_read ? 'bg-white opacity-75' : 'bg-blue-50/80 shadow-inner'}`}>
                            <h4 className={`text-sm mb-1 ${notif.is_read ? 'text-gray-600 font-bold' : 'text-[var(--color-navy-900)] font-black'}`}>{notif.title}</h4>
                            <p className="text-[11px] text-gray-600 font-semibold whitespace-pre-wrap leading-relaxed">{notif.body}</p>
                            
                            {!notif.is_read && (
                              <button 
                                onClick={() => markAsRead(notif.id)}
                                className="absolute top-4 left-4 text-gray-400 hover:text-green-500 md:opacity-0 md:group-hover:opacity-100 transition"
                                title="تحديد كمقروء"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            )}
                            {notif.is_read && (
                               <span className="absolute top-4 left-4 text-green-500/50">
                                 <CheckCircle2 size={16} />
                               </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {/* 🔴 الزرار الشيك اللي بيودي لصفحة السجل الكامل */}
                    <div className="bg-white p-2 border-t border-gray-100 text-center">
                      <Link 
                        href="/notifications" 
                        onClick={() => setShowNotifs(false)} 
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center justify-center gap-2 w-full py-2 hover:bg-blue-50 rounded-lg"
                      >
                        عرض السجل الكامل للإشعارات <ArrowLeft size={14} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block relative">
              <button onClick={() => {setIsProfileOpen(!isProfileOpen); setShowNotifs(false);}} className="flex items-center gap-2 text-sm bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] px-4 py-2 rounded-full border border-[var(--color-navy-500)] transition">
                <User size={16} className="text-blue-400" />
                <span className="font-bold text-gray-200">{dbUserName}</span> {/* 🔴 استخدام الاسم الفعلي من الداتابيز */}
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                  <div className="absolute top-12 left-0 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b mb-1 bg-gray-50">
                      <p className="text-sm font-bold text-gray-800">{dbUserName}</p> {/* 🔴 استخدام الاسم الفعلي من الداتابيز */}
                      <p className="text-xs text-gray-500">{user.role === 'ADMIN' ? 'مدير النظام' : user.role === 'DATA_ENTRY' ? 'مدخل بيانات' : 'مدير إدارة'}</p>
                    </div>
                    <button onClick={() => { setIsProfileOpen(false); router.push('/profile'); }} className="w-full text-right px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition">
                      <Settings size={16} className="text-gray-500" /> تعديل الحساب
                    </button>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition">
                      <LogOut size={16} /> تسجيل خروج
                    </button>
                  </div>
              )}
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => {setIsMobileMenuOpen(!isMobileMenuOpen); setShowNotifs(false); setIsProfileOpen(false);}} className="text-gray-300 hover:text-white p-1 relative">
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                {user.role !== 'DATA_ENTRY' && unreadCount > 0 && !isMobileMenuOpen && (
                 <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-[var(--color-navy-900)]"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-navy-800)] border-t border-[var(--color-navy-500)] animate-in slide-in-from-top-2">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => {
              if (!link.roles.includes(user.role)) return null;
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-2 px-3 py-3 rounded-md text-base font-bold ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-[var(--color-navy-900)]'}`}>
                  <Icon size={18} /> {link.name}
                </Link>
              );
            })}
            <div className="border-t border-gray-600 mt-2 pt-2">
              {user.role !== 'DATA_ENTRY' && unreadCount > 0 && (
                 <div className="px-3 py-2 text-sm text-blue-300 font-bold border-b border-gray-600 mb-2 pb-2">
                    يوجد لديك ({unreadCount}) إشعارات غير مقروءة (افتحها من الجرس 🔔)
                 </div>
              )}
              <div className="px-3 py-3 border-b border-gray-600 mb-2">
                 <p className="text-white font-bold">{dbUserName}</p>
                 <p className="text-gray-400 text-xs">{user.role === 'ADMIN' ? 'مدير النظام' : user.role === 'DATA_ENTRY' ? 'مدخل بيانات' : 'مدير إدارة'}</p>
              </div>
              <button onClick={() => { setIsMobileMenuOpen(false); router.push('/profile'); }} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-gray-300 hover:bg-[var(--color-navy-900)]">
                <Settings size={18} /> تعديل الحساب
              </button>
              <button onClick={handleLogout} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-red-400 hover:bg-red-900/50">
                <LogOut size={18} /> تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}