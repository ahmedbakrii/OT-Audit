'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Clock, CalendarDays, Save, Printer, User, CheckCircle2, AlertCircle, ArrowRight, FileText, XCircle, Search, Edit, Trash2, Filter, LayoutDashboard, FilePlus2, PieChart, Activity, CheckCircle, Hourglass, HelpCircle, AlertTriangle, BriefcaseMedical, Landmark, ShieldQuestion } from 'lucide-react';
import '@/components/permissions/permission-print.css';
import PermissionForm, { PermissionFormData } from '@/components/permissions/PermissionForm';

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
        className="w-full border border-gray-300 rounded-lg p-3 bg-white cursor-pointer flex justify-between items-center focus-within:ring-2 focus-within:ring-[var(--color-navy-500)]"
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
                className="p-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition border-b border-gray-50 last:border-0"
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
export default function PermissionsPage() {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'FORM'>('FORM');

  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<any[]>([]);
  
  const [deptFilter, setDeptFilter] = useState<string>(''); 
  const [dateFilter, setDateFilter] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // داتا الفورم المحدثة 
  const [permData, setPermData] = useState({
    date: new Date().toISOString().split('T')[0],
    timeOfExit: '',
    timeOfEntry: '',
    reasonType: 'الذهاب للمستشفى', // القايمة الذكية
    customReason: '',
    calculatedDuration: '' // المدة اللي هتتحسب أوتوماتيك
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [printData, setPrintData] = useState<PermissionFormData | null>(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    document.title = ' الأذونات | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserId(user.id);

    if (user.role === 'FACTORY_MANAGER' || user.role === 'ADMIN' || user.role === 'MANAGER') setCurrentView('DASHBOARD');
    else setCurrentView('FORM');

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) setUserDeptId(data.department_id);
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

    const { data: emps } = await supabase.from('employees').select('*, companies(name), departments(name), shifts(name)').eq('status', 'ACTIVE').order('name');
    if (emps) setEmployees(emps);

    let query = supabase.from('permission_requests')
      .select('*, employees!inner(name, emp_number, job_title, department_id, departments(name), companies(name), shifts(name))')
      .order('created_at', { ascending: false });

    if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') {
      query = query.eq('employees.department_id', userDeptId);
    } else if ((userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && deptFilter) {
      query = query.eq('employees.department_id', deptFilter);
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
      dStart = customStartDate || null;
      dEnd = customEndDate || null;
    }

    if (dStart) query = query.gte('date', dStart);
    if (dEnd) query = query.lte('date', dEnd);

    const { data: reqs } = await query;
    if (reqs) setPermissionRequests(reqs);
    setLoading(false);
  }

  useEffect(() => {
    async function fetchManager() {
      if (!selectedEmpId) return setManagerName('');
      const emp = employees.find(e => e.id === selectedEmpId);
      if (emp && emp.department_id) {
        const { data: manager } = await supabase.from('users').select('name').eq('role', 'MANAGER').eq('department_id', emp.department_id).single();
        setManagerName(manager?.name || 'غير محدد');
      } else { setManagerName(''); }
    }
    fetchManager();
  }, [selectedEmpId, employees]);

  // 🔴 الذكاء الصناعي لحساب مدة الإذن ونهاية الدوام
  useEffect(() => {
    if (permData.timeOfExit && permData.timeOfEntry && selectedEmpId) {
      const emp = employees.find(e => e.id === selectedEmpId);
      const shiftName = emp?.shifts?.name?.toLowerCase() || '';
      const isNight = shiftName.includes('ليل') || shiftName.includes('night');

      // لو ليل وراجع الساعة 4 ص، أو نهار وراجع الساعة 4 م
      if ((isNight && permData.timeOfEntry === '04:00') || (!isNight && permData.timeOfEntry === '16:00')) {
        setPermData(prev => ({ ...prev, calculatedDuration: 'نهاية الدوام' }));
      } else {
        // حساب الساعات والدقائق
        let exitDate = new Date(`2000-01-01T${permData.timeOfExit}`);
        let entryDate = new Date(`2000-01-01T${permData.timeOfEntry}`);
        
        // لو وقت الدخول أصغر من وقت الخروج (يعني عدى نص الليل)
        if (entryDate <= exitDate) entryDate.setDate(entryDate.getDate() + 1);

        let diffMs = entryDate.getTime() - exitDate.getTime();
        let diffHrs = Math.floor(diffMs / 3600000);
        let diffMins = Math.floor((diffMs % 3600000) / 60000);

        let res = [];
        if (diffHrs > 0) res.push(`${diffHrs} ساعة`);
        if (diffMins > 0) res.push(`${diffMins} دقيقة`);
        
        setPermData(prev => ({ ...prev, calculatedDuration: res.join(' و ') || '0 دقيقة' }));
      }
    } else {
      setPermData(prev => ({ ...prev, calculatedDuration: '' }));
    }
  }, [permData.timeOfExit, permData.timeOfEntry, selectedEmpId, employees]);

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !permData.date || !permData.timeOfExit || !permData.timeOfEntry) {
      return showToast('برجاء استكمال تواريخ وأوقات الخروج والدخول', 'error');
    }
    if (permData.reasonType === 'أخرى' && !permData.customReason) {
      return showToast('برجاء كتابة سبب الإذن', 'error');
    }

    setSubmitting(true);
    const emp = employees.find(e => e.id === selectedEmpId);
    const finalReason = permData.reasonType === 'أخرى' ? permData.customReason : permData.reasonType;

    try {
      const payload = {
        employee_id: emp.id,
        company_id: emp.company_id,
        date: permData.date,
        time_of_exit: permData.timeOfExit,
        time_of_entry: permData.timeOfEntry,
        period_of_exit: permData.calculatedDuration,
        reason: finalReason,
        special_circumstances: null, 
        status: 'PENDING',
        created_by: userId
      };

      if (editingId) {
        const { error } = await supabase.from('permission_requests').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast('تم تعديل الإذن بنجاح', 'success');
      } else {
        const { error } = await supabase.from('permission_requests').insert(payload);
        if (error) throw error;
        showToast('تم إرسال إذن الخروج للاعتماد', 'success');

        // 🔴 إرسال الإشعار الذكي
        await supabase.from('notifications').insert([{
          title: '🔔 تصريح خروج/تأخير للمراجعة',
          body: `طلب تصريح خروج للموظف ${emp.name} بتاريخ ${permData.date}`,
          department_id: emp.department_id,
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
    const isStandardReason = ['الذهاب للمستشفى', 'الذهاب للبنك', 'ظرف خاص'].includes(req.reason);
    
    setPermData({
      date: req.date,
      timeOfExit: req.time_of_exit,
      timeOfEntry: req.time_of_entry,
      reasonType: isStandardReason ? req.reason : 'أخرى',
      customReason: isStandardReason ? '' : req.reason,
      calculatedDuration: req.period_of_exit
    });
    setEditingId(req.id);
    setCurrentView('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل تريد إلغاء هذا الإذن؟')) return;
    await supabase.from('permission_requests').delete().eq('id', id);
    showToast('تم الإلغاء بنجاح', 'success');
    loadData();
  };

  const resetForm = () => {
    setSelectedEmpId(''); setEditingId(null);
    setPermData({ date: new Date().toISOString().split('T')[0], timeOfExit: '', timeOfEntry: '', reasonType: 'الذهاب للمستشفى', customReason: '', calculatedDuration: '' });
  };

  const handlePrint = (req: any) => {
    setPrintData({
      company: req.employees?.companies?.name || 'Energya',
      date: req.date,
      employeeId: req.employees?.emp_number,
      name: req.employees?.name,
      title: req.employees?.job_title,
      section: req.employees?.departments?.name,
      department: req.employees?.departments?.name,
      timeOfExit: req.time_of_exit,
      timeOfEntry: req.time_of_entry,
      periodOfExit: req.period_of_exit,
      reason: req.reason,
      deptHead: 'معتمد إلكترونياً',
      deptManager: managerName || 'معتمد',
      hrManager: 'إدارة الموارد البشرية'
    });
    setShowPrintView(true);
  };

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.emp_number} - ${e.name}` }));
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // ==========================================
  // 🔴 الإحصائيات والداشبورد الدسمة
  // ==========================================
  const getDashboardStats = () => {
    const empStats: any = {};
    const reasonStats: any = {};
    let endOfShiftCount = 0;
    
    permissionRequests.forEach(req => {
      if (req.status !== 'APPROVED') return;

      // تحليل الأسباب
      const reason = req.reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;

      // أذونات لنهاية الدوام
      if (req.period_of_exit === 'نهاية الدوام') endOfShiftCount++;

      // تحليل الموظفين والساعات
      const empName = req.employees?.name;
      const empCode = req.employees?.emp_number;
      if (!empStats[empName]) empStats[empName] = { count: 0, hours: 0, code: empCode };
      empStats[empName].count += 1;

      // حساب تقريبي لعدد الساعات
      let hrs = 0;
      if (req.period_of_exit && req.period_of_exit !== 'نهاية الدوام') {
        const hMatch = req.period_of_exit.match(/(\d+)\s*ساعة/);
        const mMatch = req.period_of_exit.match(/(\d+)\s*دقيقة/);
        if (hMatch) hrs += parseInt(hMatch[1], 10);
        if (mMatch) hrs += parseFloat((parseInt(mMatch[1], 10) / 60).toFixed(1));
      } else if (req.period_of_exit === 'نهاية الدوام') {
         hrs += 4; // تقدير جزافي لنهاية الدوام لأغراض العرض
      }
      empStats[empName].hours += hrs;
    });

    const topEmployees = Object.entries(empStats).map(([name, data]: any) => ({ name, ...data })).sort((a, b) => b.hours - a.hours).slice(0, 5);
    const topReasons = Object.entries(reasonStats).map(([reason, count]: any) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 4);

    return { topEmployees, topReasons, endOfShiftCount };
  };

  const analytics = getDashboardStats();
  const stats = {
    total: permissionRequests.length,
    pending: permissionRequests.filter(r => r.status === 'PENDING').length,
    approved: permissionRequests.filter(r => r.status === 'APPROVED').length,
    endOfShift: analytics.endOfShiftCount,
  };

  if (showPrintView && printData) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 relative animate-in zoom-in-95">
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border-t-4 border-blue-500">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Printer className="text-blue-500"/> طباعة تصريح الخروج</h2>
          <button onClick={() => setShowPrintView(false)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg transition">العودة للنظام <ArrowRight size={16}/></button>
        </div>
        <PermissionForm data={printData} />
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

      {/* הـ Header الموحد */}
      <div className="max-w-6xl mx-auto mt-6 px-4 md:px-0 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {(userRole === 'ADMIN' || userRole === 'MANAGER') ? (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'DASHBOARD' ? 'bg-[var(--color-navy-900)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><PieChart size={18}/> الداشبورد الدسم</button>
            <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'FORM' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FilePlus2 size={18}/> تقديم وتعديل الإذونات</button>
          </div>
        ) : <div />}

        {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER' || userRole === 'MANAGER') && (
          <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-2 px-4 w-full md:w-auto">
            {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
              <div className="flex items-center gap-2 border-l pl-3">
                <Filter size={16} className="text-gray-400"/>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)] cursor-pointer">
                  <option value="">كل إدارات المصنع</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-blue-500"/>
              <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); if(e.target.value !== 'CUSTOM') {setCustomStartDate(''); setCustomEndDate('');} }} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)] cursor-pointer">
                <option value="ALL">كل الفترات</option>
                <option value="THIS_MONTH">أذونات الشهر الحالي</option>
                <option value="LAST_MONTH">أذونات الشهر الماضي</option>
                <option value="CUSTOM">تحديد فترة مخصصة...</option>
              </select>
            </div>
            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-2 py-1 animate-in slide-in-from-right-4">
                <input type="date" value={customStartDate} onChange={e=>setCustomStartDate(e.target.value)} className="text-xs border rounded p-1 font-bold text-gray-700 bg-white" title="من تاريخ"/>
                <span className="text-gray-400 text-xs">-</span>
                <input type="date" value={customEndDate} onChange={e=>setCustomEndDate(e.target.value)} className="text-xs border rounded p-1 font-bold text-gray-700 bg-white" title="إلى تاريخ"/>
              </div>
            )}
          </div>
        )}
      </div>

      {/* الداشبورد الدسمة */}
      {currentView === 'DASHBOARD' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">إجمالي الأذونات</p><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.total}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-green-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">الإذونات المعتمدة</p><div className="bg-green-50 p-2 rounded-lg text-green-600"><CheckCircle2 size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.approved}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">بانتظار الاعتماد</p><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Clock size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.pending}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-rose-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">أذونات لنهاية الدوام</p><div className="bg-rose-50 p-2 rounded-lg text-rose-600"><Activity size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.endOfShift}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2 border-b pb-2"><AlertTriangle size={18} className="text-orange-500"/> أكثر الموظفين استئذاناً (حسب الساعات)</h3>
              {analytics.topEmployees.length === 0 ? <div className="text-sm font-bold text-gray-400 text-center py-6">لا يوجد أذونات معتمدة.</div> : (
                <div className="space-y-3">
                  {analytics.topEmployees.map((emp: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                      <div><div className="font-bold text-gray-800 text-sm">{emp.name}</div><div className="text-xs text-gray-500">{emp.code}</div></div>
                      <div className="text-right">
                        <div className="text-orange-600 font-black text-sm">{emp.hours} ساعة</div>
                        <div className="text-gray-400 text-xs font-bold">{emp.count} أذونات</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2 border-b pb-2"><ShieldQuestion size={18} className="text-indigo-500"/> أسباب الأذونات الأكثر شيوعاً</h3>
              {analytics.topReasons.length === 0 ? <div className="text-sm font-bold text-gray-400 text-center py-6">لا يوجد بيانات لعرضها.</div> : (
                <div className="space-y-3">
                  {analytics.topReasons.map((reason: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                      <div className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                        {reason.reason.includes('مستشفى') ? <BriefcaseMedical size={16} className="text-rose-500"/> : reason.reason.includes('بنك') ? <Landmark size={16} className="text-blue-500"/> : <HelpCircle size={16} className="text-gray-400"/>}
                        {reason.reason}
                      </div>
                      <div className="text-indigo-700 font-black text-sm">{reason.count} طلبات</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نموذج التقديم */}
      {currentView === 'FORM' && (
        <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 ${editingId ? 'border-orange-500' : 'border-[var(--color-navy-500)]'} max-w-6xl mx-auto animate-in slide-in-from-bottom-4`}>
          <div className="flex items-center justify-between mb-8 pb-4 border-b">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
                <Clock className={editingId ? 'text-orange-500' : 'text-[var(--color-navy-500)]'} size={32} />
                {editingId ? 'تعديل تصريح الخروج' : 'إصدار تصريح خروج / تأخير'}
              </h1>
              <p className="text-gray-500 text-sm font-bold">نموذج موحد لجميع شركات المصنع (إنرجيا، جوهرة، مقاول).</p>
            </div>
            {editingId && <button onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"><XCircle size={16}/> إلغاء التعديل</button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2"><User size={16}/> بيانات الموظف</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اختر الموظف (بحث)</label>
                  <SearchableSelect options={empOptions} value={selectedEmpId} onChange={(val) => setSelectedEmpId(val)} placeholder="-- ابحث واختار الموظف --" />
                </div>
                {selectedEmp && (
                  <div className="bg-white p-3 rounded-lg border flex flex-col justify-center animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الشركة:</span><span className="text-sm font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{selectedEmp.companies?.name}</span></div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الإدارة:</span><span className="text-sm font-bold text-gray-800">{selectedEmp.departments?.name}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500 font-bold">الوردية:</span><span className="text-sm font-bold text-indigo-600">{selectedEmp.shifts?.name || 'غير محددة'}</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2"><Hourglass size={16}/> أوقات وسبب الاستئذان</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">التاريخ</label>
                  <input type="date" required value={permData.date} onChange={(e) => setPermData({...permData, date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">وقت الخروج</label>
                  <input type="time" required value={permData.timeOfExit} onChange={(e) => setPermData({...permData, timeOfExit: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">وقت الدخول</label>
                  <input type="time" required value={permData.timeOfEntry} onChange={(e) => setPermData({...permData, timeOfEntry: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-blue-600 mb-1">مدة الإذن المحسوبة</span>
                  <span className={`font-black text-center ${permData.calculatedDuration === 'نهاية الدوام' ? 'text-rose-600 text-lg' : 'text-blue-800 text-xl'}`}>{permData.calculatedDuration || '-'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">سبب الإذن</label>
                  <select value={permData.reasonType} onChange={(e) => setPermData({...permData, reasonType: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800">
                    <option value="الذهاب للمستشفى">الذهاب للمستشفى</option>
                    <option value="الذهاب للبنك">الذهاب للبنك</option>
                    <option value="ظرف خاص">ظرف خاص</option>
                    <option value="أخرى">أخرى (كتابة السبب)</option>
                  </select>
                </div>
                {permData.reasonType === 'أخرى' && (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">توضيح السبب</label>
                    <input type="text" required placeholder="اكتب سبب الإذن هنا..." value={permData.customReason} onChange={(e) => setPermData({...permData, customReason: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={submitting || !selectedEmpId} className={`text-white px-8 py-3.5 rounded-xl font-black transition disabled:opacity-50 flex items-center gap-2 shadow-lg ${editingId ? 'bg-orange-600' : 'bg-[var(--color-navy-900)]'}`}>
                <Save size={20} />
                {submitting ? 'جاري الحفظ...' : (editingId ? 'تعديل الإذن' : 'إرسال الإذن للاعتماد')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* أرشيف الأذونات الجدول المحدث */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-6xl mx-auto mt-8 mb-8">
        <h2 className="text-xl font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-2"><FileText className="text-gray-400"/> سجل الأذونات التفصيلي</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-bold text-gray-600">
                <th className="p-4">الموظف</th>
                <th className="p-4 text-center">التاريخ</th>
                <th className="p-4 text-center">الخروج والدخول</th>
                <th className="p-4 text-center">عدد الساعات</th>
                <th className="p-4 text-center">سبب الإذن</th>
                <th className="p-4 text-center">حالة الطلب</th>
                <th className="p-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {permissionRequests.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center font-bold text-gray-400">لا توجد أذونات في هذه الفترة.</td></tr>
              ) : (
                permissionRequests.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-black text-[var(--color-navy-800)]">{req.employees?.name}</div>
                      <div className="text-xs font-bold text-gray-500">{req.employees?.emp_number} - {req.employees?.departments?.name}</div>
                    </td>
                    <td className="p-4 text-center font-bold text-sm text-gray-700">{req.date}</td>
                    <td className="p-4 text-center font-bold text-xs text-gray-500">
                      {req.time_of_exit} <ArrowRight size={10} className="inline mx-1"/> {req.time_of_entry}
                    </td>
                    <td className="p-4 text-center font-black text-sm text-blue-800">{req.period_of_exit}</td>
                    <td className="p-4 text-center text-xs font-bold text-gray-600 max-w-[150px] truncate" title={req.reason}>{req.reason}</td>
                    <td className="p-4 text-center">
                      {req.status === 'PENDING' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">قيد المراجعة</span>}
                      {req.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">معتمد</span>}
                      {req.status === 'REJECTED' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">مرفوض</span>}
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      {req.status === 'APPROVED' && (
                        <button onClick={() => handlePrint(req)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1"><Printer size={14} /> طباعة</button>
                      )}
                      {req.status === 'PENDING' && (userRole === 'DATA_ENTRY' || userRole === 'MANAGER') && (
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