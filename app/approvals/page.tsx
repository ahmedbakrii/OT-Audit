'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, CalendarDays, CheckCircle2, AlertCircle, AlertTriangle, MessageSquare } from 'lucide-react';

export default function ApprovalsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);

  // حالة الـ Modal للرفض
  const [rejectModal, setRejectModal] = useState({ show: false, type: '', id: '', reason: '' });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    document.title = 'مركز الموافقات | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      router.push('/'); // منع مدخل البيانات من الدخول
      return;
    }
    
    setUserRole(user.role);
    
    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) setUserDeptId(data.department_id);
      loadPendingRequests(user.role, data?.department_id);
    }
    initUser();
  }, [router]);

  async function loadPendingRequests(role: string | null, deptId: string | null) {
    setLoading(true);

    let lQuery = supabase.from('leave_requests').select('*, employees!inner(name, emp_number, job_title, department_id)').eq('status', 'PENDING').order('created_at', { ascending: true });
    let pQuery = supabase.from('permission_requests').select('*, employees!inner(name, emp_number, job_title, department_id)').eq('status', 'PENDING').order('created_at', { ascending: true });

    if (role === 'MANAGER' && deptId) {
      lQuery = lQuery.eq('employees.department_id', deptId);
      pQuery = pQuery.eq('employees.department_id', deptId);
    }

    const [lRes, pRes] = await Promise.all([lQuery, pQuery]);
    
    if (lRes.data) setLeaves(lRes.data);
    if (pRes.data) setPermissions(pRes.data);
    
    setLoading(false);
  }

  // =====================================
  // معالجة القبول والرفض
  // =====================================
  const handleApprove = async (type: 'leave' | 'permission', id: string) => {
    const table = type === 'leave' ? 'leave_requests' : 'permission_requests';
    try {
      const { error } = await supabase.from(table).update({ status: 'APPROVED' }).eq('id', id);
      if (error) throw error;
      showToast('تم اعتماد الطلب بنجاح', 'success');
      
      // إزالة الطلب من القائمة حالياً
      if (type === 'leave') setLeaves(prev => prev.filter(item => item.id !== id));
      else setPermissions(prev => prev.filter(item => item.id !== id));

    } catch (err) {
      showToast('حدث خطأ أثناء الاعتماد', 'error');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal.reason.trim()) return showToast('برجاء كتابة سبب الرفض', 'error');

    const table = rejectModal.type === 'leave' ? 'leave_requests' : 'permission_requests';
    const reasonField = rejectModal.type === 'leave' ? 'manager_notes' : 'special_circumstances'; // هنستخدم الحقول دي مؤقتاً لتخزين سبب الرفض
    
    try {
      const { error } = await supabase.from(table).update({ 
        status: 'REJECTED',
        [reasonField]: rejectModal.reason 
      }).eq('id', rejectModal.id);

      if (error) throw error;
      showToast('تم رفض الطلب', 'success');
      
      if (rejectModal.type === 'leave') setLeaves(prev => prev.filter(item => item.id !== rejectModal.id));
      else setPermissions(prev => prev.filter(item => item.id !== rejectModal.id));

      setRejectModal({ show: false, type: '', id: '', reason: '' });

    } catch (err) {
      showToast('حدث خطأ أثناء الرفض', 'error');
    }
  };

  const leaveTypesMap: Record<string, string> = { annual: 'سنوية', deduct: 'بدون أجر', medical: 'مرضي', emergency: 'عارضة', hajj: 'حج/عمرة', other: 'أخرى' };

  return (
    <div className="relative w-full min-h-screen animate-in fade-in pb-10">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Modal الرفض */}
      {rejectModal.show && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center gap-3">
              <AlertTriangle className="text-rose-600" />
              <h3 className="font-black text-rose-800">تأكيد رفض الطلب</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">برجاء توضيح سبب الرفض (إجباري)</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-gray-800"
                rows={3}
                placeholder="اكتب سبب الرفض هنا..."
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
              />
            </div>
            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setRejectModal({ show: false, type: '', id: '', reason: '' })} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition">إلغاء</button>
              <button onClick={handleRejectSubmit} className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg shadow-md transition flex items-center gap-2"><XCircle size={16}/> تأكيد الرفض</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto mt-6 px-4 md:px-0">
        <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
          <CheckCircle className="text-green-500" size={32} />
          مركز الموافقات والاعتمادات
        </h1>
        <p className="text-gray-500 text-sm font-bold mb-8">مراجعة واعتماد طلبات إدارتك (الإجازات وأذونات الخروج) بضغطة زر.</p>

        {loading ? (
          <div className="text-center py-20 font-bold text-gray-400">جاري تحميل الطلبات المعلقة...</div>
        ) : (
          <div className="space-y-8">
            
            {/* ================================== */}
            {/* قسم الإجازات المعلقة */}
            {/* ================================== */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 border-blue-500">
              <h2 className="text-lg font-black text-[var(--color-navy-800)] mb-6 flex items-center gap-2"><CalendarDays className="text-blue-500"/> طلبات الإجازة المعلقة ({leaves.length})</h2>
              
              {leaves.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <CheckCircle2 className="mx-auto text-gray-300 mb-2" size={40}/>
                  <p className="font-bold text-gray-400 text-sm">لا توجد طلبات إجازة معلقة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {leaves.map(req => (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition bg-blue-50/30">
                      <div className="flex justify-between items-start mb-3 border-b pb-3">
                        <div>
                          <div className="font-black text-[var(--color-navy-800)]">{req.employees?.name}</div>
                          <div className="text-xs font-bold text-gray-500">{req.employees?.job_title}</div>
                        </div>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-black">{leaveTypesMap[req.leave_type] || req.leave_type}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm mb-4">
                        <div className="font-bold text-gray-700">من: <span className="text-[var(--color-navy-900)]">{req.start_date}</span></div>
                        <div className="font-bold text-gray-700">إلى: <span className="text-[var(--color-navy-900)]">{req.end_date}</span></div>
                        <div className="font-black text-rose-600 bg-rose-50 px-2 rounded">({req.total_days} أيام)</div>
                      </div>

                      {req.reason && (
                        <div className="mb-4 text-xs font-bold text-gray-500 flex items-start gap-1"><MessageSquare size={14} className="mt-0.5"/> <span className="italic">"{req.reason}"</span></div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-blue-100">
                        <button onClick={() => handleApprove('leave', req.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-black flex items-center justify-center gap-1 transition shadow-sm"><CheckCircle size={16}/> اعتماد</button>
                        <button onClick={() => setRejectModal({ show: true, type: 'leave', id: req.id, reason: '' })} className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 py-2 rounded-lg text-sm font-black flex items-center justify-center gap-1 transition"><XCircle size={16}/> رفض</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================================== */}
            {/* قسم الأذونات المعلقة */}
            {/* ================================== */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 border-orange-500">
              <h2 className="text-lg font-black text-[var(--color-navy-800)] mb-6 flex items-center gap-2"><Clock className="text-orange-500"/> أذونات الخروج والتأخير ({permissions.length})</h2>
              
              {permissions.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <CheckCircle2 className="mx-auto text-gray-300 mb-2" size={40}/>
                  <p className="font-bold text-gray-400 text-sm">لا توجد أذونات معلقة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {permissions.map(req => (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition bg-orange-50/30">
                      <div className="flex justify-between items-start mb-3 border-b pb-3">
                        <div>
                          <div className="font-black text-[var(--color-navy-800)]">{req.employees?.name}</div>
                          <div className="text-xs font-bold text-gray-500">{req.date}</div>
                        </div>
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-black">{req.period_of_exit}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm mb-4">
                        <div className="font-bold text-gray-700">خروج: <span className="text-[var(--color-navy-900)] text-lg">{req.time_of_exit}</span></div>
                        <div className="font-bold text-gray-700">عودة: <span className="text-[var(--color-navy-900)] text-lg">{req.time_of_entry}</span></div>
                      </div>

                      <div className="mb-4 text-xs font-bold text-gray-600 bg-white p-2 rounded border border-gray-100">
                        <span className="text-gray-400 mr-1">السبب:</span> {req.reason}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-orange-100">
                        <button onClick={() => handleApprove('permission', req.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-black flex items-center justify-center gap-1 transition shadow-sm"><CheckCircle size={16}/> اعتماد</button>
                        <button onClick={() => setRejectModal({ show: true, type: 'permission', id: req.id, reason: '' })} className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 py-2 rounded-lg text-sm font-black flex items-center justify-center gap-1 transition"><XCircle size={16}/> رفض</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}