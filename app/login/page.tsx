'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Cpu, User, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('ot_user');
    if (user) router.push('/');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('user_name', userName)
        .eq('is_active', true)
        .single();

      if (dbError || !user) throw new Error('اسم المستخدم غير صحيح أو الحساب موقوف.');
      if (user.password !== password) throw new Error('كلمة المرور غير صحيحة.');

      const sessionData = { id: user.id, name: user.name, role: user.role, userName: user.user_name };
      
      // 🔴 الحل هنا: نحفظ الداتا الأول، وبعدين نبعت الإشارة للنافبار
      localStorage.setItem('ot_user', JSON.stringify(sessionData));
      window.dispatchEvent(new Event('user_login_changed'));
// 🔴 توجيه الجميع للرئيسية عشان مدخل البيانات يشوف شاشة الحماية ويحترم نفسه 😎
      router.push('/');

    } catch (err: any) {
      setError(err.message || 'حدث خطأ في تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="bg-[var(--color-navy-900)] p-8 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white p-3 rounded-full text-[var(--color-navy-900)] mb-3 shadow-lg">
              <Cpu size={40} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">STAFFCORE</h1>
            <p className="text-blue-200 text-sm mt-1">لنظام المركزي لإدارة العمليات وشؤون العاملين</p>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
        </div>

        <form onSubmit={handleLogin} className="p-8 flex flex-col space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold text-center border border-red-100">{error}</div>}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم</label>
            <div className="relative">
              <User size={18} className="absolute right-3 top-3 text-gray-400" />
              <input 
                type="text" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full border border-gray-300 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] bg-gray-50 focus:bg-white transition"
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock size={18} className="absolute right-3 top-3 text-gray-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] bg-gray-50 focus:bg-white transition text-left"
                dir="ltr"
                required 
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[var(--color-navy-500)] text-white py-3 rounded-xl hover:bg-[var(--color-navy-800)] transition font-bold flex items-center justify-center gap-2 mt-4 shadow-md disabled:opacity-70">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><>تسجيل الدخول</> <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}