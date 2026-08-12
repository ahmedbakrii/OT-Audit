'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Lock, ClipboardList, Fingerprint, CalendarDays, FileCheck2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ForbiddenOverlay({ userDeptId }: { userDeptId: string | null }) {
  const router = useRouter();
  const [adminName, setAdminName] = useState<string>('مدير النظام');
  const [managerName, setManagerName] = useState<string>('مدير إدارتك');

  useEffect(() => {
    async function fetchAuthorities() {
      try {
        const { data: adminData } = await supabase
          .from('users')
          .select('name')
          .eq('role', 'ADMIN')
          .limit(1)
          .single();
        if (adminData) setAdminName(adminData.name);

        if (userDeptId) {
          const { data: managerData } = await supabase
            .from('users')
            .select('name')
            .eq('role', 'MANAGER')
            .eq('department_id', userDeptId)
            .limit(1)
            .single();
          if (managerData) setManagerName(managerData.name);
        }
      } catch (error) {
        console.error("Error fetching authorities:", error);
      }
    }
    fetchAuthorities();
  }, [userDeptId]);

  return (
    // 🔴 تم تعديل هذا الغلاف بالكامل ليكون مناسباً ولا يغطي النافبار
    // استخدمنا absolute ليكون فوق المحتوى המموَّه (Blurred)، مع top-0 left-0 right-0
    // والـ min-h-[calc(100vh-140px)] تضمن أنه يأخذ مساحة الشاشة المتبقية بين النافبار والفوتر فقط
    <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center min-h-[calc(100vh-140px)] bg-transparent p-4 animate-in fade-in duration-500">
      
      <div className="bg-white/95 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col items-center text-center border-t-8 border-rose-600 max-w-xl w-full">
        
        <div className="relative mb-5">
          <div className="absolute inset-0 bg-rose-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="bg-gradient-to-br from-rose-50 to-red-100 p-4 rounded-full relative shadow-inner border border-red-200">
            <ShieldAlert size={48} className="text-rose-600 drop-shadow-md" />
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md">
              <Lock size={16} className="text-gray-700" />
            </div>
          </div>
        </div>

        <h2 className="font-black text-2xl md:text-3xl text-[var(--color-navy-900)] mb-2 tracking-tight">غير مصرح لك بالوصول</h2>
        
        <p className="text-gray-600 font-semibold leading-relaxed text-sm md:text-base mb-6 px-2">
          عذراً، مستوى الصلاحيات الممنوح لحسابك لا يتيح لك الاطلاع على بيانات وإحصائيات هذه الصفحة.
        </p>

        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl w-full mb-6 text-sm text-orange-900 text-right shadow-sm">
          <p className="font-bold mb-2">لطلب ترقية الصلاحيات، يرجى مراجعة:</p>
          <ul className="list-disc list-inside px-2 space-y-1 font-medium">
            <li>مدير الإدارة: <strong className="text-[var(--color-navy-800)]">{managerName}</strong></li>
            <li>مدير النظام: <strong className="text-[var(--color-navy-800)]">{adminName}</strong></li>
          </ul>
        </div>

        <div className="w-full text-right">
          <p className="text-xs md:text-sm font-bold text-gray-500 mb-3 text-center">المهام المصرح لك بتنفيذها حالياً:</p>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <button onClick={() => router.push('/assignments')} className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 border p-2.5 rounded-lg transition font-bold text-gray-700 text-xs md:text-sm group">
              <ClipboardList size={16} className="text-purple-500 group-hover:scale-110 transition-transform" /> التكليفات
            </button>
            <button onClick={() => router.push('/attendance')} className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 border p-2.5 rounded-lg transition font-bold text-gray-700 text-xs md:text-sm group">
              <Fingerprint size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" /> البصمة
            </button>
            <button onClick={() => router.push('/leaves')} className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 border p-2.5 rounded-lg transition font-bold text-gray-700 text-xs md:text-sm group">
              <CalendarDays size={16} className="text-orange-500 group-hover:scale-110 transition-transform" /> الإجازات
            </button>
            <button onClick={() => router.push('/permissions')} className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 border p-2.5 rounded-lg transition font-bold text-gray-700 text-xs md:text-sm group">
              <FileCheck2 size={16} className="text-teal-500 group-hover:scale-110 transition-transform" /> الأذونات
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}