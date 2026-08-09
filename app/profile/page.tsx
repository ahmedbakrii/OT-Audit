'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Save, User, Lock, ShieldCheck } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    // الاشعار بيختفي بعد ثانيتين
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2000);
  };

  useEffect(() => {
    document.title = 'إعدادات الحساب | OT Audit';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    const userSession = JSON.parse(userStr);
    setUserId(userSession.id);
    setUserRole(userSession.role);
    fetchUserData(userSession.id);
  }, [router]);

  async function fetchUserData(id: string) {
    try {
      const { data, error } = await supabase.from('users').select('name, password').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setName(data.name);
        setPassword(data.password);
      }
    } catch (error) {
      console.error(error);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ name, password })
        .eq('id', userId);

      if (error) throw error;

      // تحديث الاسم في الجلسة المحلية
      const userStr = localStorage.getItem('ot_user');
      if (userStr) {
        const userSession = JSON.parse(userStr);
        userSession.name = name;
        localStorage.setItem('ot_user', JSON.stringify(userSession));
      }

      showToast('تم التعديل بنجاح! جاري تحويلك للرئيسية...', 'success');
      
      // توجيه تلقائي بعد ثانيتين
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);

    } catch (error) {
      showToast('حدث خطأ أثناء التحديث.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 max-w-2xl mx-auto mt-10 relative">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] flex items-center gap-4">
        <div className="bg-blue-50 p-3 rounded-full text-blue-600">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">إعدادات الحساب الشخصي</h1>
          <p className="text-gray-500 text-sm mt-1">تعديل الاسم ورمز المرور الخاص بدخولك للنظام</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">الصلاحية الحالية</label>
            <input 
              type="text" 
              value={userRole === 'ADMIN' ? 'مدير النظام (تحكم كامل)' : userRole === 'MANAGER' ? 'مدير قسم' : 'مدخل بيانات'} 
              disabled 
              className="w-full border border-gray-200 bg-gray-100 rounded-lg px-4 py-2.5 outline-none font-bold text-gray-500 cursor-not-allowed" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم (الاسم الظاهر)</label>
            <div className="relative">
              <User size={18} className="absolute right-3 top-3 text-gray-400" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-[var(--color-navy-900)]" 
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">رمز المرور (Password)</label>
            <div className="relative">
              <Lock size={18} className="absolute right-3 top-3 text-gray-400" />
              <input 
                type="text" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-indigo-700 dir-ltr text-left" 
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[var(--color-navy-500)] text-white py-3 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold flex items-center justify-center gap-2 mt-4 shadow-md disabled:opacity-50"
          >
            <Save size={18} /> {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </div>
    </div>
  );
}