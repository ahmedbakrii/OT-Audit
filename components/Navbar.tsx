'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, Fingerprint, ClipboardList, ShieldCheck, Menu, X, User, ChevronDown, Settings, FileClock } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('ot_user');
    if (userStr) setUser(JSON.parse(userStr));
  }, [pathname]);

  if (pathname === '/login') return null;
  if (!user) return null;

  const handleLogout = () => {
    localStorage.removeItem('ot_user');
    router.push('/login');
  };

  const navLinks = [
    { name: 'الموظفين', href: '/employees', icon: Users, roles: ['ADMIN', 'MANAGER'] },
    { name: 'البصمة', href: '/attendance', icon: Fingerprint, roles: ['ADMIN', 'MANAGER'] },
    { name: 'التكليفات', href: '/assignments', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] },
    { name: 'التايم شيت', href: '/timesheet', icon: FileClock, roles: ['ADMIN', 'MANAGER', 'DATA_ENTRY'] }, // <-- تم إضافتها هنا
    { name: 'المطابقة', href: '/audit', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER'] },
  ];

  return (
    <nav className="bg-[var(--color-navy-900)] text-white shadow-lg print:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href={user.role === 'DATA_ENTRY' ? '/assignments' : '/'} className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition cursor-pointer">
              <div className="bg-white text-[var(--color-navy-900)] p-1.5 rounded-lg shadow-sm">
                <ShieldCheck size={24} />
              </div>
              <span className="font-black text-xl tracking-wider">OT Audit</span>
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

          <div className="hidden md:flex items-center relative">
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 text-sm bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] px-4 py-2 rounded-full border border-[var(--color-navy-500)] transition">
              <User size={16} className="text-blue-400" />
              <span className="font-bold text-gray-200">{user.name}</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                <div className="absolute top-12 left-0 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b mb-1 bg-gray-50">
                    <p className="text-sm font-bold text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role === 'ADMIN' ? 'مدير النظام' : 'صلاحيات مخصصة'}</p>
                  </div>
                  <button onClick={() => { setIsProfileOpen(false); router.push('/profile'); }} className="w-full text-right px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition">
                    <Settings size={16} className="text-gray-500" /> تعديل الحساب
                  </button>
                  <button onClick={handleLogout} className="w-full text-right px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition">
                    <LogOut size={16} /> تسجيل خروج
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-300 hover:text-white">
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-navy-800)] border-t border-[var(--color-navy-500)]">
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
              <button onClick={() => router.push('/profile')} className="flex items-center w-full gap-2 px-3 py-3 rounded-md text-base font-bold text-gray-300 hover:bg-[var(--color-navy-900)]">
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