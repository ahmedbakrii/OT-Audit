'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Scale, Save, Printer, User, CheckCircle2, AlertCircle, ArrowRight, FileText, XCircle, Search, Edit, Trash2, Filter, LayoutDashboard, FilePlus2, PieChart, Activity, CheckCircle, AlertTriangle, Gavel, FileSignature, Info, CalendarDays, Clock } from 'lucide-react';import PenaltyPrintTemplate, { PenaltyPrintData } from '@/components/penalty/PenaltyPrintTemplate';

// ==========================================
// 1️⃣ مكون قايمة البحث الذكية
// ==========================================
function SearchableSelect({ options, value, onChange, placeholder }: { options: any[], value: string, onChange: (val: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find(o => o.value === value);
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="w-full border border-gray-300 rounded-lg p-3 bg-white cursor-pointer flex justify-between items-center focus-within:ring-2 focus-within:ring-rose-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOpt ? 'text-gray-800 font-bold' : 'text-gray-400 font-bold'}>{selectedOpt ? selectedOpt.label : placeholder}</span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
          <div className="p-2 sticky top-0 bg-white border-b">
            <div className="relative">
              <Search className="absolute right-2 top-2 text-gray-400" size={14} />
              <input 
                type="text" autoFocus placeholder="ابحث بالاسم أو الرقم..." 
                className="w-full pl-2 pr-8 py-1.5 text-sm border bg-gray-50 border-gray-200 rounded-md outline-none"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">لا توجد نتائج</div>
          ) : (
            filteredOptions.map(opt => (
              <div 
                key={opt.value} 
                className="p-3 text-sm font-bold text-gray-700 hover:bg-rose-50 hover:text-rose-700 cursor-pointer transition border-b border-gray-50 last:border-0"
                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);

// ==========================================
// 2️⃣ الصفحة الرئيسية
// ==========================================
export default function penaltyPage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split('T')[0];

  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // بيانات الإدارة للمستخدم الحالي (الإدارة الطالبة للجزاء)
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [userDeptName, setUserDeptName] = useState<string>('');
  const [deptManagerName, setDeptManagerName] = useState<string>('');

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'FORM'>('FORM');

  const [penalty, setpenalty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [deptFilter, setDeptFilter] = useState<string>(''); 
  const [dateFilter, setDateFilter] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    dateOfPenalty: todayStr,
    location: 'Energya Factory',
    typeOfPenalty: 'تأخير عن مواعيد العمل',
    customType: '',
    subject: '',
    otherRecommendation: '',
    penaltyDecision: 'يتم خصم (عدد) يوم من الراتب الأساسي.',
  });

  const penaltyTypes = ['غياب بدون إذن', 'تأخير عن مواعيد العمل', 'إهمال في العمل', 'عدم ارتداء مهمات السلامة', 'أخرى'];

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [printData, setPrintData] = useState<PenaltyPrintData | null>(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    setTimeout(() => { document.title = 'إدارة الجزاءات | STAFFCORE'; }, 100);
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserId(user.id);

    if (user.role === 'FACTORY_MANAGER' || user.role === 'ADMIN' || user.role === 'MANAGER') setCurrentView('DASHBOARD');
    else setCurrentView('FORM');

    async function initUser() {
      // 🔴 جلب الإدارة الطالبة للجزاء
      const { data } = await supabase.from('users').select('department_id, departments(name)').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setUserDeptName((data as any).departments?.name || '');
        
        // 🔴 جلب مدير الإدارة الطالبة للجزاء
        const { data: manager } = await supabase.from('users').select('name').eq('role', 'MANAGER').eq('department_id', data.department_id).single();
        if (manager) setDeptManagerName(manager.name);
      }
      setIsInitialized(true);
    }
    initUser();
  }, [router]);

  useEffect(() => {
    if (!isInitialized) return;
    loadData();
  }, [isInitialized, userRole, userDeptId, deptFilter, dateFilter, customStartDate, customEndDate]);

  async function loadData() {
    setLoading(true);
    if (userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') {
      const { data: depts } = await supabase.from('departments').select('id, name');
      if (depts) setDepartments(depts);
    }

    const { data: emps } = await supabase.from('employees').select('*, companies(name), departments(name)').eq('status', 'ACTIVE').order('name');
    if (emps) setEmployees(emps);

    let query = supabase.from('penalty_requests').select('*, employees!inner(name, emp_number, job_title, departments(name)), req_dept:requesting_dept_id(name)').order('created_at', { ascending: false });

    // فلترة بناءً على الإدارة اللي طلبت الجزاء أو إدارة الموظف
    if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') {
      query = query.or(`requesting_dept_id.eq.${userDeptId},department_id.eq.${userDeptId}`);
    } else if ((userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && deptFilter) {
      query = query.or(`requesting_dept_id.eq.${deptFilter},department_id.eq.${deptFilter}`);
    }

    const now = new Date();
    let dStart = null, dEnd = null;
    
    if (dateFilter === 'THIS_MONTH') {
      dStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      dEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateFilter === 'LAST_MONTH') {
      dStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      dEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (dateFilter === 'CUSTOM') {
      dStart = customStartDate || null; dEnd = customEndDate || null;
    }

    if (dStart) query = query.gte('date_of_penalty', dStart);
    if (dEnd) query = query.lte('date_of_penalty', dEnd);

    const { data: reqs } = await query;
    if (reqs) setpenalty(reqs);
    setLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !formData.dateOfPenalty || !formData.subject) {
      return showToast('برجاء استكمال البيانات والموضوع', 'error');
    }

    setSubmitting(true);
    const emp = employees.find(e => e.id === selectedEmpId);
    const finalType = formData.typeOfPenalty === 'أخرى' ? formData.customType : formData.typeOfPenalty;

    try {
      const payload = {
        employee_id: emp.id,
        company_id: emp.company_id,
        department_id: emp.department_id,
        requesting_dept_id: userDeptId,
        location: formData.location,
        date_of_penalty: formData.dateOfPenalty,
        type_of_penalty: finalType,
        subject: formData.subject,
        other_recommendation: formData.otherRecommendation,
        penalty_decision: formData.penaltyDecision,
        status: 'PENDING',
        created_by: userId
      };

      if (editingId) {
        const { error } = await supabase.from('penalty_requests').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast('تم تعديل الجزاء بنجاح', 'success');
      } else {
        const { error } = await supabase.from('penalty_requests').insert(payload);
        if (error) throw error;
        showToast('تم إرسال الجزاء للاعتماد', 'success');

        await supabase.from('notifications').insert([{
          title: '🔔 طلب جزاء جديد للمراجعة',
          body: `طلب توقيع جزاء على الموظف ${emp.name} بسبب (${finalType})`,
          department_id: userDeptId, // هيوصل لمدير الإدارة الطالبة
          target_url: '/approvals'
        }]);
        window.dispatchEvent(new Event('new_notification'));
      }

      resetForm();
      loadData();
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (req: any) => {
    setSelectedEmpId(req.employee_id);
    const isStandard = penaltyTypes.includes(req.type_of_penalty);
    
    setFormData({
      dateOfPenalty: req.date_of_penalty,
      location: req.location,
      typeOfPenalty: isStandard ? req.type_of_penalty : 'أخرى',
      customType: isStandard ? '' : req.type_of_penalty,
      subject: req.subject,
      otherRecommendation: req.other_recommendation || '',
      penaltyDecision: req.penalty_decision || '',
    });
    setEditingId(req.id);
    setCurrentView('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل تريد إلغاء هذا الجزاء بشكل نهائي؟')) return;
    await supabase.from('penalty_requests').delete().eq('id', id);
    showToast('تم الإلغاء بنجاح', 'success');
    loadData();
  };

  const resetForm = () => {
    setSelectedEmpId(''); setEditingId(null);
    setFormData({ dateOfPenalty: todayStr, location: 'Energya Factory', typeOfPenalty: 'تأخير عن مواعيد العمل', customType: '', subject: '', otherRecommendation: '', penaltyDecision: 'يتم خصم (عدد) يوم من الراتب الأساسي.' });
  };

  const handlePrint = (req: any) => {
    setPrintData({
      name: req.employees?.name,
      employeeId: req.employees?.emp_number,
      title: req.employees?.job_title,
      department: req.employees?.departments?.name,
      location: req.location,
      dateOfPenalty: req.date_of_penalty,
      typeOfPenalty: req.type_of_penalty,
      subject: req.subject,
      otherRecommendation: req.other_recommendation,
      requestingDepartment: req.req_dept?.name || userDeptName,
      departmentManager: deptManagerName || 'معتمد إلكترونياً',
      departmentManagerDate: req.created_at,
      penaltyForEmployee: req.penalty_decision,
      hrManager: '',
      hrManagerDate: '',
      employeeSignature: '',
      employeeAcknowledgementDate: ''
    });
    setShowPrintView(true);
  };

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.emp_number} - ${e.name}` }));
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  const stats = {
    total: penalty.length,
    pending: penalty.filter(r => r.status === 'PENDING').length,
    approved: penalty.filter(r => r.status === 'APPROVED').length,
  };

  if (showPrintView && printData) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 relative animate-in zoom-in-95">
        <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border-t-4 border-rose-800">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Printer className="text-rose-800"/> طباعة نموذج الجزاء</h2>
          <button onClick={() => setShowPrintView(false)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg transition">العودة للنظام <ArrowRight size={16}/></button>
        </div>
        <PenaltyPrintTemplate data={printData} />
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen animate-in fade-in pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* الـ Header الموحد */}
      <div className="max-w-6xl mx-auto mt-6 px-4 md:px-0 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {(userRole === 'ADMIN' || userRole === 'MANAGER') ? (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'DASHBOARD' ? 'bg-[var(--color-navy-900)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><PieChart size={18}/> الإحصائيات</button>
            <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'FORM' ? 'bg-rose-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FileSignature size={18}/> إصدار جزاء جديد</button>
          </div>
        ) : <div />}

        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-2 px-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-rose-800"/>
            <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); if(e.target.value !== 'CUSTOM') {setCustomStartDate(''); setCustomEndDate('');} }} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)] cursor-pointer">
              <option value="ALL">كل الفترات</option>
              <option value="THIS_MONTH">جزاءات الشهر الحالي</option>
              <option value="LAST_MONTH">جزاءات الشهر الماضي</option>
              <option value="CUSTOM">تحديد فترة مخصصة...</option>
            </select>
          </div>
        </div>
      </div>

      {currentView === 'DASHBOARD' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[var(--color-navy-900)]">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">إجمالي الجزاءات</p><div className="bg-blue-50 p-2 rounded-lg text-[var(--color-navy-900)]"><FileText size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.total}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-rose-800">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">الجزاءات المعتمدة</p><div className="bg-rose-50 p-2 rounded-lg text-rose-800"><Gavel size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.approved}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">بانتظار الاعتماد</p><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Clock size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.pending}</h3>
            </div>
          </div>
        </div>
      )}

      {currentView === 'FORM' && (
        <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 ${editingId ? 'border-orange-500' : 'border-rose-900'} max-w-6xl mx-auto animate-in slide-in-from-bottom-4`}>
          
          {/* 🔴 تنبيه النظام المؤقت (شياكة وفاخر جداً) */}
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4 items-start shadow-sm">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0"><Info size={24}/></div>
            <div>
              <h4 className="font-black text-blue-900 text-sm mb-1">ملاحظة هامة (تحديث قادم)</h4>
              <p className="text-xs font-bold text-blue-700 leading-relaxed">
                هذه الشاشة تعمل حالياً بوضع "البحث اليدوي المؤقت". بمجرد الانتهاء من دمج قاعدة بيانات المصنع الكاملة للـ HR، سيتم تحديث هذه الشاشة لتقوم بسحب جميع بيانات الموظف والإدارة فور إدخال رقمه الوظيفي أوتوماتيكياً.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-8 pb-4 border-b">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
                <Scale className={editingId ? 'text-orange-500' : 'text-rose-900'} size={32} />
                {editingId ? 'تعديل توقيع الجزاء' : 'طلب توقيع جزاء على موظف'}
              </h1>
              <p className="text-gray-500 text-sm font-bold">بناءً على هذا النموذج سيتم إرسال إشعار لمديرك للاعتماد.</p>
            </div>
            {editingId && <button onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"><XCircle size={16}/> إلغاء التعديل</button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h3 className="text-sm font-black text-rose-900 mb-4 flex items-center gap-2"><User size={16}/> الموظف المخالف</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اختر الموظف (بحث)</label>
                  <SearchableSelect options={empOptions} value={selectedEmpId} onChange={(val) => setSelectedEmpId(val)} placeholder="-- ابحث واختار الموظف --" />
                </div>
                {selectedEmp && (
                  <div className="bg-white p-3 rounded-lg border flex flex-col justify-center animate-in zoom-in-95 shadow-sm border-rose-100">
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الشركة:</span><span className="text-sm font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded">{selectedEmp.companies?.name}</span></div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الإدارة:</span><span className="text-sm font-bold text-gray-800">{selectedEmp.departments?.name}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500 font-bold">الوظيفة:</span><span className="text-sm font-bold text-gray-800">{selectedEmp.job_title}</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h3 className="text-sm font-black text-rose-900 mb-4 flex items-center gap-2"><AlertTriangle size={16}/> بيانات المخالفة</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ المخالفة</label>
                  <input type="date" required value={formData.dateOfPenalty} onChange={(e) => setFormData({...formData, dateOfPenalty: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الموقع (Location)</label>
                  <input type="text" required value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800 text-left dir-ltr" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع المخالفة</label>
                  <select value={formData.typeOfPenalty} onChange={(e) => setFormData({...formData, typeOfPenalty: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800">
                    {penaltyTypes.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              
              {formData.typeOfPenalty === 'أخرى' && (
                <div className="mb-6 animate-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">توضيح نوع المخالفة</label>
                  <input type="text" required placeholder="اكتب النوع..." value={formData.customType} onChange={(e) => setFormData({...formData, customType: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">موضوع المخالفة (Subject)</label>
                <textarea required rows={4} placeholder="اشرح بالتفصيل ما حدث..." value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">توصيات أخرى (اختياري)</label>
                  <textarea rows={2} placeholder="أي توصيات للإدارة العليا..." value={formData.otherRecommendation} onChange={(e) => setFormData({...formData, otherRecommendation: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-rose-800 mb-2">الجزاء المقترح (للموظف)</label>
                  <textarea rows={2} placeholder="مثال: خصم يوم من الراتب" value={formData.penaltyDecision} onChange={(e) => setFormData({...formData, penaltyDecision: e.target.value})} className="w-full border border-rose-300 bg-rose-50 rounded-lg p-3 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-rose-900" />
                </div>
              </div>

            </div>

            {/* 🔴 إظهار بيانات الإدارة الطالبة بناءً على اليوزر الحالي */}
            <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 flex justify-between items-center">
              <div>
                <span className="text-xs text-gray-400 font-bold block mb-1">الإدارة الطالبة للجزاء:</span>
                <span className="text-sm font-black text-[var(--color-navy-800)]">{userDeptName}</span>
              </div>
              <div className="text-left">
                <span className="text-xs text-gray-400 font-bold block mb-1">يعتمد من:</span>
                <span className="text-sm font-black text-rose-700">{deptManagerName || 'المدير المباشر'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={submitting || !selectedEmpId} className={`text-white px-8 py-3.5 rounded-xl font-black transition disabled:opacity-50 flex items-center gap-2 shadow-lg ${editingId ? 'bg-orange-600' : 'bg-rose-900 hover:bg-rose-800'}`}>
                <Save size={20} />
                {submitting ? 'جاري الحفظ...' : (editingId ? 'تعديل الجزاء' : 'إرسال للاعتماد')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* أرشيف الجزاءات */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-6xl mx-auto mt-8 mb-8">
        <h2 className="text-xl font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-2"><FileText className="text-gray-400"/> سجل الجزاءات التفصيلي</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-bold text-gray-600">
                <th className="p-4">الموظف / الإدارة</th>
                <th className="p-4 text-center">التاريخ</th>
                <th className="p-4 text-center">نوع وموضوع المخالفة</th>
                <th className="p-4 text-center">الطالب للجزاء</th>
                <th className="p-4 text-center">حالة الطلب</th>
                <th className="p-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {penalty.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center font-bold text-gray-400">لا توجد جزاءات مسجلة.</td></tr>
              ) : (
                penalty.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-black text-rose-900">{req.employees?.name}</div>
                      <div className="text-[10px] font-bold text-gray-500">{req.employees?.emp_number} - {req.employees?.departments?.name}</div>
                    </td>
                    <td className="p-4 text-center font-bold text-sm text-gray-700">{req.date_of_penalty}</td>
                    <td className="p-4 text-center">
                      <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black block w-max mx-auto mb-1">{req.type_of_penalty}</span>
                      <div className="text-[10px] text-gray-500 max-w-[150px] truncate mx-auto" title={req.subject}>{req.subject}</div>
                    </td>
                    <td className="p-4 text-center text-xs font-bold text-gray-600">{req.req_dept?.name || '-'}</td>
                    <td className="p-4 text-center">
                      {req.status === 'PENDING' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">قيد المراجعة</span>}
                      {req.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">معتمد</span>}
                      {req.status === 'REJECTED' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">مرفوض</span>}
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      {/* 🔴 الطباعة تظهر فقط لو الطلب APPROVED */}
                      {req.status === 'APPROVED' && (
                        <button onClick={() => handlePrint(req)} className="bg-[var(--color-navy-900)] hover:bg-blue-800 text-white px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1"><Printer size={14} /> طباعة</button>
                      )}
                      {(req.status === 'PENDING' && (userRole === 'DATA_ENTRY' || userRole === 'MANAGER')) && (
                        <button onClick={() => handleEdit(req)} className="bg-gray-100 text-gray-700 hover:bg-orange-100 px-2 py-1.5 rounded-md transition"><Edit size={16} /></button>
                      )}
                      {((req.status === 'PENDING' && userRole === 'DATA_ENTRY') || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
                        <button onClick={() => handleDelete(req.id)} className="bg-gray-100 text-gray-500 hover:bg-red-100 px-2 py-1.5 rounded-md transition"><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}