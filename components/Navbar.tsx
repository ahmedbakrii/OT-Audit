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
  Cpu,
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
      if (
        navRef.current &&
        !navRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
        setShowNotifs(false);
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUserAndData = () => {
    const userStr = localStorage.getItem('ot_user');

    if (userStr) {
      const parsedUser = JSON.parse(userStr);

      setUser(parsedUser);

      fetchUserDataAndNotifications(
        parsedUser.id,
        parsedUser.role
      );
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUserAndData();

    const handleNewNotif = () => loadUserAndData();
    const handleStorageChange = () => loadUserAndData();

    window.addEventListener(
      'new_notification',
      handleNewNotif
    );

    window.addEventListener(
      'storage',
      handleStorageChange
    );

    window.addEventListener(
      'user_login_changed',
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        'new_notification',
        handleNewNotif
      );

      window.removeEventListener(
        'storage',
        handleStorageChange
      );

      window.removeEventListener(
        'user_login_changed',
        handleStorageChange
      );
    };
  }, []);

  async function fetchUserDataAndNotifications(
    userId: string,
    role: string
  ) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, department_id')
        .eq('id', userId)
        .single();

      if (userData) {
        setDbUserName(userData.name);

        if (role !== 'DATA_ENTRY') {
          const startOfToday = new Date();

          startOfToday.setHours(0, 0, 0, 0);

          let query = supabase
            .from('notifications')
            .select('*')
            .gte(
              'created_at',
              startOfToday.toISOString()
            )
            .order('created_at', {
              ascending: false,
            });

          if (
            role === 'MANAGER' &&
            userData.department_id
          ) {
            query = query.eq(
              'department_id',
              userData.department_id
            );
          }

          const { data: notifs } = await query;

          if (notifs) {
            setNotifications(notifs);
          }
        }
      }
    } catch (error) {
      console.error(
        'Error fetching user data or notifications',
        error
      );

      setDbUserName(user?.name || 'مستخدم');
    }
  }

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications(
      notifications.map((n) =>
        n.id === id
          ? { ...n, is_read: true }
          : n
      )
    );
  }

  if (pathname === '/login') return null;
  if (!user) return null;

  const navigationGroups = [
    {
      id: 'operations',
      name: 'العمليات والتشغيل',
      icon: Workflow,
      items: [
        {
          name: 'التكليفات',
          description: 'إنشاء وإدارة تكليفات العمل الإضافي',
          href: '/assignments',
          icon: ClipboardList,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
        {
          name: 'سجل البصمة',
          description: 'متابعة سجلات الحضور والانصراف',
          href: '/attendance',
          icon: Fingerprint,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
      ],
    },

    {
      id: 'employees',
      name: 'شؤون الموظفين والطلبات',
      icon: UsersRound,
      items: [
        {
          name: 'إدارة الموظفين',
          description: 'إدارة بيانات الموظفين',
          href: '/employees',
          icon: Users,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
        {
          name: 'الإجازات',
          description: 'إدارة طلبات الإجازات',
          href: '/leaves',
          icon: CalendarDays,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
        {
          name: 'الأذونات',
          description: 'إدارة طلبات الأذونات',
          href: '/permissions',
          icon: Clock,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
      ],
    },

    {
      id: 'reports',
      name: 'التقارير والاعتمادات',
      icon: ChartNoAxesCombined,
      items: [
        {
          name: 'مركز الموافقات',
          description: 'مراجعة واعتماد الطلبات',
          href: '/approvals',
          icon: CheckCircle,
          roles: ['ADMIN', 'MANAGER'],
        },
        {
          name: 'تصدير التايم شيت',
          description: 'إنشاء وتصدير سجلات التايم شيت',
          href: '/timesheet',
          icon: FileClock,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
        {
          name: 'المطابقة والتدقيق',
          description: 'مراجعة ومطابقة بيانات OT',
          href: '/audit',
          icon: ShieldCheck,
          roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'],
        },
      ],
    },
  ];

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.roles.includes(user.role)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const unreadCount = notifications.filter(
    (n) => !n.is_read
  ).length;

  const isGroupActive = (group: any) => {
    return group.items.some(
      (item: any) => pathname === item.href
    );
  };

  const toggleMenu = (menuId: string) => {
    setOpenMenu(
      openMenu === menuId ? null : menuId
    );

    setIsProfileOpen(false);
    setShowNotifs(false);
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    setShowNotifs(false);
    setIsMobileMenuOpen(false);
    setOpenMenu(null);

    localStorage.removeItem('ot_user');

    window.dispatchEvent(
      new Event('user_login_changed')
    );

    router.push('/login');
  };

  return (
    <nav
      ref={navRef}
      className="bg-[var(--color-navy-900)] text-white shadow-lg print:hidden sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">

          {/* LOGO + NAVIGATION */}
          <div className="flex items-center gap-8">

            <Link
              href="/"
              className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition cursor-pointer"
            >
              <div className="bg-white text-[var(--color-navy-900)] p-1.5 rounded-lg shadow-sm">
                <Cpu size={24} />
              </div>

              <span className="font-black text-xl tracking-wider hidden sm:block">
                STAFFCORE
              </span>
            </Link>

            {/* DESKTOP NAVIGATION */}
            <div className="hidden md:flex items-center gap-1">

              {visibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const active = isGroupActive(group);
                const isOpen = openMenu === group.id;

                return (
                  <div
                    key={group.id}
                    className="relative"
                  >
                    <button
                      onClick={() =>
                        toggleMenu(group.id)
                      }
                      className={`
                        flex items-center gap-2
                        px-3 py-2
                        rounded-md
                        text-sm
                        font-bold
                        transition-all
                        ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-300 hover:bg-[var(--color-navy-800)] hover:text-white'
                        }
                      `}
                    >
                      <GroupIcon size={17} />

                      <span>
                        {group.name}
                      </span>

                      <ChevronDown
                        size={14}
                        className={`
                          transition-transform
                          ${
                            isOpen
                              ? 'rotate-180'
                              : ''
                          }
                        `}
                      />
                    </button>

                    {isOpen && (
                      <div
                        className="
                          absolute
                          top-full
                          right-0
                          mt-2
                          w-[330px]
                          bg-white
                          rounded-xl
                          shadow-2xl
                          border
                          border-gray-200
                          overflow-hidden
                          text-gray-800
                          animate-in
                          fade-in
                          slide-in-from-top-2
                          duration-150
                        "
                      >

                        {/* DROPDOWN HEADER */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">

                          <div className="flex items-center gap-2">

                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <GroupIcon size={17} />
                            </div>

                            <div>
                              <p className="text-sm font-black text-gray-800">
                                {group.name}
                              </p>

                              <p className="text-[11px] text-gray-500">
                                اختر الخدمة التي تريد فتحها
                              </p>
                            </div>

                          </div>

                        </div>

                        {/* ITEMS */}
                        <div className="p-2">

                          {group.items.map(
                            (item: any) => {
                              const ItemIcon =
                                item.icon;

                              const itemActive =
                                pathname ===
                                item.href;

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() =>
                                    setOpenMenu(null)
                                  }
                                  className={`
                                    group
                                    flex
                                    items-center
                                    gap-3
                                    p-3
                                    rounded-lg
                                    transition-all
                                    ${
                                      itemActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'hover:bg-gray-50 text-gray-700'
                                    }
                                  `}
                                >

                                  <div
                                    className={`
                                      w-10
                                      h-10
                                      rounded-lg
                                      flex
                                      items-center
                                      justify-center
                                      transition-all
                                      ${
                                        itemActive
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                                      }
                                    `}
                                  >
                                    <ItemIcon size={19} />
                                  </div>

                                  <div className="flex-1 min-w-0">

                                    <p
                                      className={`
                                        text-sm
                                        font-bold
                                        ${
                                          itemActive
                                            ? 'text-blue-700'
                                            : 'text-gray-800'
                                        }
                                      `}
                                    >
                                      {item.name}
                                    </p>

                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                      {item.description}
                                    </p>

                                  </div>

                                  <ArrowLeft
                                    size={15}
                                    className={`
                                      transition-all
                                      ${
                                        itemActive
                                          ? 'text-blue-600 translate-x-0'
                                          : 'text-gray-300 group-hover:text-blue-500 group-hover:-translate-x-1'
                                      }
                                    `}
                                  />

                                </Link>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}
                  </div>
                );
              })}

            </div>

          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-3">

            {/* NOTIFICATIONS */}
            {user.role !== 'DATA_ENTRY' && (
              <div className="relative">

                <button
                  onClick={() => {
                    setShowNotifs(!showNotifs);
                    setIsProfileOpen(false);
                    setOpenMenu(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className="relative p-2 bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] rounded-full transition text-blue-300 hover:text-white border border-[var(--color-navy-500)]"
                >
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

                      <span className="text-sm text-gray-700">
                        إشعارات اليوم
                      </span>

                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                        {unreadCount} غير مقروء
                      </span>

                    </div>

                    <div className="max-h-72 overflow-y-auto bg-gray-50">

                      {notifications.length === 0 ? (

                        <p className="p-6 text-center text-gray-500 font-bold text-sm">
                          لا توجد حركات مسجلة اليوم
                        </p>

                      ) : (

                        notifications.map(
                          (notif) => (

                            <div
                              key={notif.id}
                              className={`
                                p-4
                                border-b
                                transition
                                relative
                                group
                                ${
                                  notif.is_read
                                    ? 'bg-white opacity-75'
                                    : 'bg-blue-50/80 shadow-inner'
                                }
                              `}
                            >

                              <h4
                                className={`
                                  text-sm
                                  mb-1
                                  ${
                                    notif.is_read
                                      ? 'text-gray-600 font-bold'
                                      : 'text-[var(--color-navy-900)] font-black'
                                  }
                                `}
                              >
                                {notif.title}
                              </h4>

                              <p className="text-[11px] text-gray-600 font-semibold whitespace-pre-wrap leading-relaxed">
                                {notif.body}
                              </p>

                              {!notif.is_read && (
                                <button
                                  onClick={() =>
                                    markAsRead(
                                      notif.id
                                    )
                                  }
                                  className="absolute top-4 left-4 text-gray-400 hover:text-green-500 md:opacity-0 md:group-hover:opacity-100 transition"
                                  title="تحديد كمقروء"
                                >
                                  <CheckCircle2
                                    size={18}
                                  />
                                </button>
                              )}

                              {notif.is_read && (
                                <span className="absolute top-4 left-4 text-green-500/50">
                                  <CheckCircle2
                                    size={16}
                                  />
                                </span>
                              )}

                            </div>

                          )
                        )

                      )}

                    </div>

                    <div className="bg-white p-2 border-t border-gray-100 text-center flex flex-col">

                      <Link
                        href="/notifications"
                        onClick={() =>
                          setShowNotifs(false)
                        }
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center justify-center gap-2 w-full py-2 hover:bg-blue-50 rounded-lg"
                      >
                        عرض السجل الكامل للإشعارات
                        <ArrowLeft size={14} />
                      </Link>

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* PROFILE */}
            <div className="hidden md:block relative">

              <button
                onClick={() => {
                  setIsProfileOpen(
                    !isProfileOpen
                  );
                  setShowNotifs(false);
                  setOpenMenu(null);
                }}
                className="flex items-center gap-2 text-sm bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] px-4 py-2 rounded-full border border-[var(--color-navy-500)] transition"
              >

                <User
                  size={16}
                  className="text-blue-400"
                />

                <span className="font-bold text-gray-200">
                  {dbUserName}
                </span>

                <ChevronDown
                  size={14}
                  className={`
                    text-gray-400
                    transition-transform
                    ${
                      isProfileOpen
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />

              </button>

              {isProfileOpen && (
                <div className="absolute top-12 left-0 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border overflow-hidden animate-in fade-in slide-in-from-top-2">

                  <div className="px-4 py-2 border-b mb-1 bg-gray-50">

                    <p className="text-sm font-bold text-gray-800">
                      {dbUserName}
                    </p>

                    <p className="text-xs text-gray-500">
                      {user.role === 'ADMIN'
                        ? 'مدير النظام'
                        : user.role ===
                            'DATA_ENTRY'
                          ? 'مدخل بيانات'
                          : 'مدير إدارة'}
                    </p>

                  </div>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push('/profile');
                    }}
                    className="w-full text-right px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition"
                  >
                    <Settings
                      size={16}
                      className="text-gray-500"
                    />
                    تعديل الحساب
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full text-right px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                  >
                    <LogOut size={16} />
                    تسجيل خروج
                  </button>

                </div>
              )}

            </div>

            {/* MOBILE MENU BUTTON */}
            <div className="md:hidden flex items-center">

              <button
                onClick={() => {
                  setIsMobileMenuOpen(
                    !isMobileMenuOpen
                  );
                  setShowNotifs(false);
                  setIsProfileOpen(false);
                  setOpenMenu(null);
                }}
                className="text-gray-300 hover:text-white p-1 relative"
              >

                {isMobileMenuOpen ? (
                  <X size={28} />
                ) : (
                  <Menu size={28} />
                )}

                {user.role !== 'DATA_ENTRY' &&
                  unreadCount > 0 &&
                  !isMobileMenuOpen && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-[var(--color-navy-900)]"></span>
                  )}

              </button>

            </div>

          </div>

        </div>
      </div>

      {/* MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-navy-800)] border-t border-[var(--color-navy-500)] animate-in slide-in-from-top-2">

          <div className="px-3 pt-3 pb-4">

            {visibleGroups.map((group) => {

              const GroupIcon = group.icon;
              const active =
                isGroupActive(group);
              const isOpen =
                openMenu === group.id;

              return (
                <div
                  key={group.id}
                  className="mb-2"
                >

                  {/* GROUP BUTTON */}
                  <button
                    onClick={() =>
                      setOpenMenu(
                        isOpen
                          ? null
                          : group.id
                      )
                    }
                    className={`
                      w-full
                      flex
                      items-center
                      justify-between
                      px-3
                      py-3
                      rounded-lg
                      text-sm
                      font-bold
                      transition
                      ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-200 hover:bg-[var(--color-navy-900)]'
                      }
                    `}
                  >

                    <span className="flex items-center gap-3">

                      <GroupIcon size={19} />

                      {group.name}

                    </span>

                    <ChevronDown
                      size={16}
                      className={`
                        transition-transform
                        ${
                          isOpen
                            ? 'rotate-180'
                            : ''
                        }
                      `}
                    />

                  </button>

                  {/* GROUP ITEMS */}
                  {isOpen && (
                    <div className="mt-1 mr-3 border-r border-gray-600 pr-2 space-y-1">

                      {group.items.map(
                        (item: any) => {

                          const ItemIcon =
                            item.icon;

                          const itemActive =
                            pathname ===
                            item.href;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() =>
                                setIsMobileMenuOpen(
                                  false
                                )
                              }
                              className={`
                                flex
                                items-center
                                gap-3
                                px-3
                                py-3
                                rounded-lg
                                text-sm
                                font-bold
                                transition
                                ${
                                  itemActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-[var(--color-navy-900)]'
                                }
                              `}
                            >

                              <ItemIcon size={18} />

                              <span>
                                {item.name}
                              </span>

                            </Link>
                          );
                        }
                      )}

                    </div>
                  )}

                </div>
              );
            })}

            {/* MOBILE USER AREA */}
            <div className="border-t border-gray-600 mt-3 pt-3">

              {user.role !== 'DATA_ENTRY' &&
                unreadCount > 0 && (
                  <div className="px-3 py-2 text-sm text-blue-300 font-bold border-b border-gray-600 mb-2 pb-2">
                    يوجد لديك ({unreadCount})
                    إشعارات غير مقروءة
                  </div>
                )}

              <div className="px-3 py-3 border-b border-gray-600 mb-2">

                <p className="text-white font-bold">
                  {dbUserName}
                </p>

                <p className="text-gray-400 text-xs">
                  {user.role === 'ADMIN'
                    ? 'مدير النظام'
                    : user.role ===
                        'DATA_ENTRY'
                      ? 'مدخل بيانات'
                      : 'مدير إدارة'}
                </p>

              </div>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push('/profile');
                }}
                className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-gray-300 hover:bg-[var(--color-navy-900)]"
              >
                <Settings size={18} />
                تعديل الحساب
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-red-400 hover:bg-red-900/50"
              >
                <LogOut size={18} />
                تسجيل خروج
              </button>

            </div>

          </div>

        </div>
      )}

    </nav>
  );
}