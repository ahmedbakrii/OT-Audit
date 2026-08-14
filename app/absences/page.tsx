'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { CalendarDays, Save, Printer, User, CheckCircle2, AlertCircle, ArrowRight, FileText, XCircle, Search, Edit, Trash2, Filter, LayoutDashboard, FilePlus2, PieChart, Activity, CheckCircle, UserX, AlertTriangle, Users } from 'lucide-react';
import AbsentPrintTemplate, { AbsentPrintData } from '@/components/absences/AbsentPrintTemplate';

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
export default function AbsencesPage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split('T')[0];

  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [userDeptName, setUserDeptName] = useState<string>(''); // 🔴 جلب اسم إدارة المدير

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'FORM'>('FORM');

  const [absences, setAbsences] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // الفلاتر
  const [filterStartDate, setFilterStartDate] = useState(todayStr);
  const [filterEndDate, setFilterEndDate] = useState(todayStr);
  const [deptFilter, setDeptFilter] = useState<string>(''); 

  // حالة الفورم
  const [formDate, setFormDate] = useState(todayStr);
  const [formDept, setFormDept] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  // قائمة الموظفين المضافين في الكشف الحالي
  const [absentEmployeesList, setAbsentEmployeesList] = useState<{emp_number: string, name: string, reason: string, remarks: string, company: string, shift: string}[]>([]);
  
  const [currentReason, setCurrentReason] = useState('بدون إذن');
  const [currentRemarks, setCurrentRemarks] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const reasonOptions = ['بدون إذن', 'إجازة مرضي', 'إجازة سنوية', 'مأمورية عمل', 'أخرى (يرجى التوضيح)'];

  useEffect(() => {
    setTimeout(() => { document.title = 'إدارة الغياب | STAFFCORE'; }, 100);
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserId(user.id);

    if (user.role === 'FACTORY_MANAGER' || user.role === 'ADMIN' || user.role === 'MANAGER') setCurrentView('DASHBOARD');
    else setCurrentView('FORM');

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id, departments(name)').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setFormDept(data.department_id);
        setUserDeptName((data as any).departments?.name || ''); // 🔴 حفظ اسم الإدارة
      }
      setIsInitialized(true);
    }
    initUser();
  }, [router]);

  useEffect(() => {
    if (!isInitialized) return;
    loadData();
  }, [isInitialized, userRole, userDeptId, deptFilter, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (formDept) loadEmployeesForForm();
  }, [formDept]);

  async function loadData() {
    setLoading(true);
    const { data: depts } = await supabase.from('departments').select('id, name');
    if (depts) setDepartments(depts);

    let query = supabase.from('absence_requests').select(`
      id, date, status, manager_notes, created_at, department_id, departments(name),
      absence_employees(emp_number, reason, remarks, employees(name, job_title, companies(name), shifts(name)))
    `).gte('date', filterStartDate).lte('date', filterEndDate).order('date', { ascending: false });

    // 🔴 Zoom In Logic: فلترة الداتا المعروضة للمدير أو مدخل البيانات لتكون إدارته فقط
    if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') query = query.eq('department_id', userDeptId);
    else if ((userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && deptFilter) query = query.eq('department_id', deptFilter);

    const { data: reqs } = await query;
    if (reqs) setAbsences(reqs);
    setLoading(false);
  }

  async function loadEmployeesForForm() {
    const { data } = await supabase.from('employees').select('id, emp_number, name, job_title, companies(name), shifts(name)').eq('department_id', formDept).eq('status', 'ACTIVE').order('name');
    setEmployees(data || []);
  }

  const handleAddEmployee = () => {
    if (!selectedEmpId) return showToast('برجاء اختيار الموظف أولاً', 'error');
    
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    if (absentEmployeesList.some(e => e.emp_number === emp.emp_number)) {
      return showToast('هذا الموظف مضاف بالفعل في القائمة', 'error');
    }

    setAbsentEmployeesList([...absentEmployeesList, {
      emp_number: emp.emp_number,
      name: emp.name,
      company: emp.companies?.name || '-',
      shift: emp.shifts?.name || '-',
      reason: currentReason,
      remarks: currentRemarks
    }]);

    setSelectedEmpId('');
    setCurrentReason('بدون إذن');
    setCurrentRemarks('');
  };

  const handleRemoveEmployee = (empNum: string) => {
    setAbsentEmployeesList(absentEmployeesList.filter(e => e.emp_number !== empNum));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (absentEmployeesList.length === 0) return showToast('برجاء إضافة موظف واحد على الأقل للكشف', 'error');

    setSubmitting(true);
    try {
      let targetId = editingId;

      if (editingId) {
        await supabase.from('absence_requests').update({ date: formDate, department_id: formDept, status: 'PENDING' }).eq('id', editingId);
        await supabase.from('absence_employees').delete().eq('absence_id', editingId);
      } else {
        const { data: exist } = await supabase.from('absence_requests').select('id').eq('date', formDate).eq('department_id', formDept).maybeSingle();
        if (exist) {
          targetId = exist.id;
          await supabase.from('absence_requests').update({ status: 'PENDING' }).eq('id', targetId);
        } else {
          const { data: newReq } = await supabase.from('absence_requests').insert([{
            date: formDate, department_id: formDept, status: 'PENDING'
          }]).select().single();
          targetId = newReq.id;
        }
      }

      const records = absentEmployeesList.map(emp => ({
        absence_id: targetId,
        emp_number: emp.emp_number,
        reason: emp.reason,
        remarks: emp.remarks
      }));
      
      if (!editingId) {
        const { data: existing } = await supabase.from('absence_employees').select('emp_number').eq('absence_id', targetId);
        const existingSet = new Set(existing?.map(e => e.emp_number) || []);
        const newRecords = records.filter(r => !existingSet.has(r.emp_number));
        if (newRecords.length > 0) await supabase.from('absence_employees').insert(newRecords);
      } else {
        await supabase.from('absence_employees').insert(records);
      }

      await supabase.from('notifications').insert([{
        title: '🔔 كشف غياب بانتظار الاعتماد',
        body: `تم تسجيل كشف غياب لعدد ${absentEmployeesList.length} موظفين بتاريخ ${formDate}`,
        department_id: formDept,
        target_url: '/approvals' 
      }]);
      window.dispatchEvent(new Event('new_notification'));

      showToast(editingId ? 'تم التعديل بنجاح' : 'تم إرسال كشف الغياب للاعتماد', 'success');
      resetForm();
      loadData();
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (req: any) => {
    if (req.status === 'APPROVED' && userRole === 'DATA_ENTRY') return showToast('لا يمكنك تعديل كشف معتمد', 'error');
    
    setEditingId(req.id);
    setFormDate(req.date);
    setFormDept(req.department_id);

    const list = req.absence_employees?.map((e: any) => {
      const empData = Array.isArray(e.employees) ? e.employees[0] : e.employees;
      return {
        emp_number: e.emp_number,
        name: empData?.name || '',
        company: empData?.companies?.name || '-',
        shift: empData?.shifts?.name || '-',
        reason: e.reason,
        remarks: e.remarks
      }
    }) || [];

    setAbsentEmployeesList(list);
    setCurrentView('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكشف بالكامل؟')) return;
    await supabase.from('absence_requests').delete().eq('id', id);
    showToast('تم الحذف بنجاح', 'success');
    loadData();
  };

  const resetForm = () => {
    setEditingId(null); 
    setAbsentEmployeesList([]); 
    setFormDate(todayStr);
    setSelectedEmpId('');
    setCurrentReason('بدون إذن');
    setCurrentRemarks('');
  };

  const handlePrint = (req: any) => {
    const energyaDay: any[] = [];
    const energyaNight: any[] = [];
    const jawharaDay: any[] = [];
    const jawharaNight: any[] = [];

    req.absence_employees?.forEach((e: any) => {
      const empData = Array.isArray(e.employees) ? e.employees[0] : e.employees;
      const compName = empData?.companies?.name || '';
      const shiftName = empData?.shifts?.name || '';
      const isNight = shiftName.includes('ليل') || shiftName.includes('مسا') || shiftName.includes('night');
      const isJawhara = compName.includes('Jawhara') || compName.includes('جوهرة') || compName.includes('جواهر');

      const empObj = { emp_number: e.emp_number, name: empData?.name, reason: e.reason, remarks: e.remarks };

      if (isJawhara) {
        if (isNight) jawharaNight.push(empObj); else jawharaDay.push(empObj);
      } else {
        if (isNight) energyaNight.push(empObj); else energyaDay.push(empObj);
      }
    });

    setPrintData({
      date: req.date,
      departmentName: req.departments?.name,
      energyaDay, energyaNight, jawharaDay, jawharaNight
    });
    
    setShowPrintView(true);
  };

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.emp_number} - ${e.name}` }));

  if (showPrintView && printData) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 relative animate-in zoom-in-95">
        <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border-t-4 border-rose-500">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Printer className="text-rose-500"/> طباعة كشوف الغياب المتعددة</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-[var(--color-navy-900)] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-rose-700 transition">🖨️ طباعة جميع الأوراق</button>
            <button onClick={() => setShowPrintView(false)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg transition">إغلاق <XCircle size={16}/></button>
          </div>
        </div>
        
        <div className="flex flex-col gap-8 items-center pb-10">
          {printData.energyaDay.length > 0 && (
            <div className="print-page-break"><AbsentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, shift: 'صباحي (Day Shift)', companyType: 'Energya', employees: printData.energyaDay }} showPrintButton={false} /></div>
          )}
          {printData.energyaNight.length > 0 && (
            <div className="print-page-break mt-8 print:mt-0"><AbsentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, shift: 'مسائي (Night Shift)', companyType: 'Energya', employees: printData.energyaNight }} showPrintButton={false} /></div>
          )}
          {printData.jawharaDay.length > 0 && (
            <div className="print-page-break mt-8 print:mt-0"><AbsentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, shift: 'صباحي (Day Shift)', companyType: 'Jawhara', employees: printData.jawharaDay }} showPrintButton={false} /></div>
          )}
          {printData.jawharaNight.length > 0 && (
            <div className="print-page-break mt-8 print:mt-0"><AbsentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, shift: 'مسائي (Night Shift)', companyType: 'Jawhara', employees: printData.jawharaNight }} showPrintButton={false} /></div>
          )}
          
          {(!printData.energyaDay.length && !printData.energyaNight.length && !printData.jawharaDay.length && !printData.jawharaNight.length) && (
            <div className="text-center font-bold text-gray-500 py-20 bg-white w-[210mm] rounded-xl border">لا يوجد موظفين مسجلين في هذا الكشف.</div>
          )}
        </div>
        <style jsx global>{` @media print { .print-page-break { page-break-after: always; } .print-page-break:last-child { page-break-after: auto; } } `}</style>
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

      {/* الـ Header */}
      <div className="max-w-6xl mx-auto mt-6 px-4 md:px-0 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {(userRole === 'ADMIN' || userRole === 'MANAGER') ? (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'DASHBOARD' ? 'bg-[var(--color-navy-900)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><PieChart size={18}/> الإحصائيات</button>
            <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'FORM' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FilePlus2 size={18}/> إدارة كشوف الغياب</button>
          </div>
        ) : <div />}

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
            <span className="text-sm font-semibold text-gray-500">من:</span>
            <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-rose-800 cursor-pointer" />
          </div>
          <div className="flex items-center gap-2 border-l pl-3">
            <span className="text-sm font-semibold text-gray-500">إلى:</span>
            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-rose-800 cursor-pointer" />
          </div>
        </div>
      </div>

      {currentView === 'DASHBOARD' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-rose-500 flex flex-col justify-center items-center py-20">
            <UserX size={60} className="text-rose-200 mb-4" />
            <h2 className="text-2xl font-black text-rose-800 mb-2">إحصائيات الغياب {userRole === 'MANAGER' ? `(${userDeptName})` : '(كافة الإدارات)'}</h2>
            <p className="text-gray-500 font-bold">هذه الشاشة ستعرض تحليلات متقدمة لنسب الغياب والموظفين الأكثر تغيباً قريباً.</p>
          </div>
        </div>
      )}

      {currentView === 'FORM' && (
        <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 ${editingId ? 'border-orange-500' : 'border-rose-500'} max-w-6xl mx-auto animate-in slide-in-from-bottom-4`}>
          <div className="flex items-center justify-between mb-8 pb-4 border-b">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
                <UserX className={editingId ? 'text-orange-500' : 'text-rose-500'} size={32} />
                {editingId ? 'تعديل كشف الغياب' : 'إنشاء كشف غياب يومي'}
              </h1>
              <p className="text-gray-500 text-sm font-bold">تسجيل الموظفين الغائبين وتحديد السبب لإصدار الكشوف المنفصلة (ليل/نهار).</p>
            </div>
            {editingId && <button onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"><XCircle size={16}/> إلغاء التعديل</button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الكشف</label>
                <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-gray-800" disabled={!!editingId && userRole === 'DATA_ENTRY'}/>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الإدارة</label>
                <select value={formDept} onChange={(e) => setFormDept(e.target.value)} disabled={userRole === 'DATA_ENTRY' || userRole === 'MANAGER'} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-gray-800 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
                  <option value="" disabled>اختر الإدارة...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {formDept && (
              <div className="border border-rose-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-rose-50 text-rose-900 p-4 border-b border-rose-200">
                  <span className="font-black text-sm flex items-center gap-2"><Users size={18}/> إضافة الموظفين للكشف</span>
                </div>
                
                <div className="p-5 flex flex-col md:flex-row gap-4 items-end bg-gray-50">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 mb-1">اختر الموظف الغائب</label>
                    <SearchableSelect options={empOptions} value={selectedEmpId} onChange={setSelectedEmpId} placeholder="ابحث بالاسم أو الرقم..." />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-bold text-gray-500 mb-1">سبب الغياب</label>
                    <select value={currentReason} onChange={(e) => setCurrentReason(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800">
                      {reasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="w-full md:w-1/3">
                    <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات (اختياري)</label>
                    <input type="text" value={currentRemarks} onChange={(e) => setCurrentRemarks(e.target.value)} placeholder="مثال: اتصل متأخراً" className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800" />
                  </div>
                  <button type="button" onClick={handleAddEmployee} className="w-full md:w-auto bg-[var(--color-navy-900)] text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-blue-800 transition whitespace-nowrap">إضافة للكشف</button>
                </div>

                <div className="p-4">
                  {absentEmployeesList.length === 0 ? (
                    <div className="text-center font-bold text-gray-400 py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">لم يتم إضافة أي موظف للكشف حتى الآن.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-right">
                        <thead className="bg-gray-100 text-gray-600 text-xs font-bold">
                          <tr><th className="p-3">م</th><th className="p-3">الموظف</th><th className="p-3">الوردية</th><th className="p-3">السبب</th><th className="p-3">ملاحظات</th><th className="p-3 text-center">حذف</th></tr>
                        </thead>
                        <tbody>
                          {absentEmployeesList.map((emp, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="p-3 font-bold">{i+1}</td>
                              <td className="p-3">
                                <div className="font-black text-gray-800">{emp.name}</div>
                                <div className="text-[10px] text-gray-500 font-bold">{emp.emp_number} - {emp.company}</div>
                              </td>
                              <td className="p-3 text-xs font-bold text-indigo-600">{emp.shift}</td>
                              <td className="p-3 text-xs font-black text-rose-600 bg-rose-50/50">{emp.reason}</td>
                              <td className="p-3 text-xs text-gray-500">{emp.remarks || '-'}</td>
                              <td className="p-3 text-center">
                                <button type="button" onClick={() => handleRemoveEmployee(emp.emp_number)} className="text-red-400 hover:text-red-600 transition"><XCircle size={18}/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={submitting || absentEmployeesList.length === 0} className={`text-white px-8 py-3.5 rounded-xl font-black transition disabled:opacity-50 flex items-center gap-2 shadow-lg ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                <Save size={20} /> {submitting ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'إرسال الكشف للاعتماد')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3️⃣ أرشيف الغياب */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-6xl mx-auto mt-8 mb-8">
        <h2 className="text-xl font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-2"><FileText className="text-gray-400"/> سجل كشوف الغياب اليومية</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-bold text-gray-600">
                <th className="p-4">التاريخ والقسم</th>
                <th className="p-4 w-1/2">الغياب (العدد والأسماء)</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {absences.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center font-bold text-gray-400">لا توجد كشوف مسجلة في هذه الفترة.</td></tr>
              ) : (
                absences.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 align-top">
                      <div className="font-black text-rose-800 text-sm mb-1">{new Date(req.date).toLocaleDateString('en-GB')}</div>
                      <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">{req.departments?.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-black text-rose-600 mb-2 border-b border-rose-100 pb-1 w-max">إجمالي الغياب: {req.absence_employees?.length || 0} موظفين</div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                        {req.absence_employees?.map((emp: any, i: number) => {
                          const empData = Array.isArray(emp.employees) ? emp.employees[0] : emp.employees;
                          return (
                            <div key={i} className="bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded shadow-sm flex flex-col min-w-[100px]">
                              <span className="font-black truncate block" title={empData?.name}>{empData?.name || emp.emp_number}</span>
                              <span className="font-bold text-rose-500 text-[10px]">{emp.reason}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-center align-middle">
                      {req.status === 'PENDING' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto">قيد المراجعة</span>}
                      {req.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto">معتمد</span>}
                      {req.status === 'REJECTED' && (
                        <div>
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto mb-1">مرفوض</span>
                          {req.manager_notes && <span className="text-[10px] font-bold text-gray-500 break-words">ملاحظات: {req.manager_notes}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        {req.status === 'APPROVED' && (
                          <button onClick={() => handlePrint(req)} className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-lg transition shadow-sm" title="طباعة الكشف"><Printer size={16} /></button>
                        )}
                        {(req.status === 'PENDING' && (userRole === 'DATA_ENTRY' || userRole === 'MANAGER')) && (
                          <button onClick={() => handleEdit(req)} className="bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700 p-2 rounded-lg transition shadow-sm" title="تعديل"><Edit size={16} /></button>
                        )}
                        {((req.status === 'PENDING' && userRole === 'DATA_ENTRY') || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
                          <button onClick={() => handleDelete(req.id)} className="bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm" title="إلغاء الكشف"><Trash2 size={16} /></button>
                        )}
                      </div>
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