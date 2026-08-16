'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { CalendarDays, Save, Printer, User, CheckCircle2, AlertCircle, ArrowRight, Clock, FileText, XCircle, Search, Edit, Trash2, Filter, LayoutDashboard, FilePlus2, PieChart, Activity, CheckCircle, AlertTriangle, TrendingUp, History, Stethoscope, CalendarOff, UploadCloud, Paperclip, ExternalLink } from 'lucide-react';

import '@/components/leaves/leave-print.css';
import EnergyaLeaveTemplate, { EnergyaLeaveData } from '@/components/leaves/EnergyaLeaveTemplate';
import JawharaLeaveTemplate, { JawharaLeaveData } from '@/components/leaves/JawharaLeaveTemplate';

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

export default function LeavesPage() {
  const router = useRouter();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'FORM'>('FORM');

  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  
  const [deptFilter, setDeptFilter] = useState<string>(''); 
  const [dateFilter, setDateFilter] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveData, setLeaveData] = useState({ leaveType: 'annual', startDate: '', endDate: '', totalDays: 0, substituteEmployee: '', contactPhone: '', destination: '', emergencyReason: '', attachmentUrl: '' });
  
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [printData, setPrintData] = useState<any>(null); 
  const [printCompany, setPrintCompany] = useState('');
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const leaveTypesMap: Record<string, string> = { annual: 'سنوية', deduct: 'بدون أجر', medical: 'مرضي', emergency: 'عارضة', hajj: 'حج/عمرة', other: 'أخرى' };

  useEffect(() => {
    document.title = ' الأجازات | STAFFCORE';
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

    async function loadData() {
      setLoading(true);
      
      if (userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') {
        const { data: depts } = await supabase.from('departments').select('id, name');
        if (depts) setDepartments(depts);
      }

      const { data: emps } = await supabase.from('employees').select('*, companies(name), departments(name)').eq('status', 'ACTIVE').order('name');
      if (emps) setEmployees(emps);

      let reqQuery = supabase.from('leave_requests')
        .select('*, employees!inner(name, emp_number, job_title, department_id, departments(name), companies(name))')
        .order('created_at', { ascending: false });
      
      if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') {
        reqQuery = reqQuery.eq('employees.department_id', userDeptId);
      } else if ((userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && deptFilter) {
        reqQuery = reqQuery.eq('employees.department_id', deptFilter);
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

      if (dStart) reqQuery = reqQuery.gte('start_date', dStart);
      if (dEnd) reqQuery = reqQuery.lte('start_date', dEnd);

      const { data: reqs } = await reqQuery;
      if (reqs) setLeaveRequests(reqs);
      setLoading(false);
    }
    
    loadData();
  }, [isInitialized, userRole, userDeptId, deptFilter, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (leaveData.startDate && leaveData.endDate) {
      const start = new Date(leaveData.startDate);
      const end = new Date(leaveData.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
      setLeaveData(prev => ({ ...prev, totalDays: diffDays > 0 ? diffDays : 0 }));
    }
  }, [leaveData.startDate, leaveData.endDate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !leaveData.startDate || !leaveData.endDate) return showToast('برجاء استكمال البيانات', 'error');
    if (new Date(leaveData.startDate) > new Date(leaveData.endDate)) return showToast('تاريخ البداية لا يمكن أن يكون بعد النهاية', 'error');
    if (leaveData.leaveType === 'medical' && !medicalFile && !leaveData.attachmentUrl) return showToast('برجاء إرفاق تقرير السكليف (المرضي)', 'error');

    setSubmitting(true);
    const emp = employees.find(e => e.id === selectedEmpId);

    try {
      if (leaveData.substituteEmployee) {
        const { data: busySub } = await supabase.from('leave_requests').select('id').eq('employee_id', leaveData.substituteEmployee).eq('status', 'APPROVED').lte('start_date', leaveData.endDate).gte('end_date', leaveData.startDate).maybeSingle();
        if (busySub) { setSubmitting(false); return showToast('الموظف البديل لديه إجازة معتمدة في هذه الفترة!', 'error'); }
      }

      let finalAttachmentUrl = leaveData.attachmentUrl;
      if (medicalFile) {
        const fileExt = medicalFile.name.split('.').pop();
        const fileName = `${Date.now()}_${emp.emp_number}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('medical_leaves').upload(fileName, medicalFile);
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('medical_leaves').getPublicUrl(fileName);
        finalAttachmentUrl = publicUrlData.publicUrl;
      }

      const payload = {
        employee_id: emp.id, company_id: emp.company_id, leave_type: leaveData.leaveType, start_date: leaveData.startDate,
        end_date: leaveData.endDate, total_days: leaveData.totalDays, substitute_employee: leaveData.substituteEmployee || null,
        contact_phone: leaveData.contactPhone, contact_address: leaveData.destination, reason: leaveData.emergencyReason,
        attachment_url: finalAttachmentUrl,
        status: 'PENDING', created_by: userId
      };

      if (editingLeaveId) {
        const { error } = await supabase.from('leave_requests').update(payload).eq('id', editingLeaveId);
        if (error) throw error;
        showToast('تم تعديل الطلب بنجاح', 'success');
      } else {
        const { error } = await supabase.from('leave_requests').insert(payload);
        if (error) throw error;
        showToast('تم إرسال الطلب للاعتماد', 'success');

        await supabase.from('notifications').insert([{
          title: '🔔 طلب إجازة جديد للمراجعة',
          body: `طلب إجازة ${leaveData.leaveType === 'annual' ? 'سنوية' : 'جديد'} من ${emp.name}`,
          department_id: emp.department_id,
          target_url: '/approvals?section=leaves' 
        }]);
        window.dispatchEvent(new Event('new_notification'));
      }
      
      resetForm();
      setCustomStartDate(prev => prev); 

    } catch (error: any) { showToast('حدث خطأ أثناء الحفظ. تأكد من إعدادات الـ Storage', 'error'); } 
    finally { setSubmitting(false); }
  };

  const handleEdit = (req: any) => {
    setSelectedEmpId(req.employee_id);
    setLeaveData({
      leaveType: req.leave_type, startDate: req.start_date, endDate: req.end_date, totalDays: req.total_days,
      substituteEmployee: req.substitute_employee || '', contactPhone: req.contact_phone || '',
      destination: req.contact_address || '', emergencyReason: req.reason || '', attachmentUrl: req.attachment_url || ''
    });
    setEditingLeaveId(req.id);
    setCurrentView('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء وحذف هذه الإجازة؟')) return;
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (error) throw error;
      showToast('تم إلغاء الإجازة', 'success');
      setLeaveRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) { showToast('خطأ أثناء الإلغاء', 'error'); }
  };

  const resetForm = () => {
    setSelectedEmpId(''); setEditingLeaveId(null); setMedicalFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLeaveData({ leaveType: 'annual', startDate: '', endDate: '', totalDays: 0, substituteEmployee: '', contactPhone: '', destination: '', emergencyReason: '', attachmentUrl: '' });
  };

  // 🔴 دالة الطباعة المحدثة اللي بتسحب اسم المدير الحقيقي من الداتابيز
  const handlePrint = async (req: any) => {
    const compName = req.employees?.companies?.name;
    setPrintCompany(compName);
    const subEmp = employees.find(e => e.id === req.substitute_employee);

    // منطق ذكي لاستدعاء اسم المدير الحقيقي من الداتابيز
    let finalManagerName = 'جاري التحميل...';
    let finalManagerTitle = 'مدير الإدارة';
    
    // هل طالب الإجازة نفسه هو مدير؟
    const isRequesterManager = req.employees?.job_title?.includes('مدير');

    if (isRequesterManager) {
      // لو هو مدير، نجيب اسم مدير المصنع (FACTORY_MANAGER) عشان هو اللي بيعتمدله
      const { data: fm } = await supabase.from('users').select('name').eq('role', 'FACTORY_MANAGER').maybeSingle();
      finalManagerName = fm?.name || 'مدير المصنع';
      finalManagerTitle = 'مدير المصنع';
    } else {
      // لو موظف عادي، نجيب اسم مدير إدارته
      const { data: dm } = await supabase.from('users').select('name').eq('role', 'MANAGER').eq('department_id', req.employees.department_id).maybeSingle();
      finalManagerName = dm?.name || 'مدير الإدارة المباشر';
    }

    // تمرير الداتا الحقيقية للورقة
    const baseData = {
      employeeName: req.employees.name, 
      employeeCode: req.employees.emp_number, 
      jobTitle: req.employees.job_title,
      department: req.employees.departments?.name || '', 
      leaveType: req.leave_type as any, 
      startDate: req.start_date,
      endDate: req.end_date, 
      leaveDays: req.total_days, 
      replacementName: subEmp?.name || '', 
      
      managerDecision: req.status === 'APPROVED' ? 'approved' : 'rejected',
      managerName: finalManagerName, // الاسم الحقيقي
      managerTitle: finalManagerTitle, // الوظيفة الحقيقية
      managerSignatureDate: new Date(req.updated_at || req.created_at).toISOString().split('T')[0], // تاريخ الاعتماد الفعلي من السيستم
      attachmentUrl: req.attachment_url
    };

    if (compName === 'Energya' || compName === 'انيرجيا') {
      setPrintData({ ...baseData, logoSrc: '/energya-logo.png' });
    } else {
      setPrintData({
        ...baseData, requestDate: new Date(req.created_at).toISOString().split('T')[0],
        phoneSaudi: req.contact_phone, emergencyReason: req.reason, destination: req.contact_address, 
        clientName: 'Energya Steel Solutions', clientAuthorizedSignature: 'Approved via STAFFCORE', logoSrc: '/jawhara-logo.png'
      });
    }
    setShowPrintView(true);
  };

  const today = new Date(); today.setHours(0,0,0,0);
  
  const stats = {
    activeToday: leaveRequests.filter(r => r.status === 'APPROVED' && new Date(r.start_date) <= today && new Date(r.end_date) >= today).length,
    pending: leaveRequests.filter(r => r.status === 'PENDING').length,
    approved: leaveRequests.filter(r => r.status === 'APPROVED').length,
    rejected: leaveRequests.filter(r => r.status === 'REJECTED').length,
  };

  const getAnalytics = () => {
    const sickStats: any = {};
    const annualStats: any = {};
    const suspicious: any = {}; 

    leaveRequests.forEach(req => {
      if (req.status !== 'APPROVED') return;
      const empName = req.employees?.name;
      const empCode = req.employees?.emp_number;
      
      if (req.leave_type === 'medical') {
        if (!sickStats[empName]) sickStats[empName] = { days: 0, code: empCode };
        sickStats[empName].days += req.total_days;
      }
      if (req.leave_type === 'annual') {
        if (!annualStats[empName]) annualStats[empName] = { days: 0, code: empCode };
        annualStats[empName].days += req.total_days;
      }

      if (req.leave_type === 'medical' || req.leave_type === 'emergency') {
        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        if (end.getDay() === 4 || start.getDay() === 6) {
          if (!suspicious[empName]) suspicious[empName] = { count: 0, code: empCode };
          suspicious[empName].count += 1;
        }
      }
    });

    const sortAndSlice = (obj: any, key: string) => Object.entries(obj).map(([n, d]: any) => ({ name: n, ...d })).sort((a,b) => b[key] - a[key]).slice(0, 3);
    return { topSick: sortAndSlice(sickStats, 'days'), topAnnual: sortAndSlice(annualStats, 'days'), sus: sortAndSlice(suspicious, 'count').filter(s => s.count > 1) };
  };
  const analytics = getAnalytics();

  const getLastLeave = () => {
    if (!selectedEmpId) return null;
    const empLeaves = leaveRequests.filter(r => r.employee_id === selectedEmpId && r.status === 'APPROVED');
    if (empLeaves.length === 0) return null;
    empLeaves.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
    return empLeaves[0];
  };
  const lastLeave = getLastLeave();

  const calculateDaysLeft = (req: any) => {
    if (req.status !== 'APPROVED') return <span className="text-gray-400 font-bold">-</span>;
    const end = new Date(req.end_date);
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return <span className="text-gray-400 font-bold text-xs">عاد للعمل</span>;
    if (diffDays === 0) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDay() === 5) return <span className="text-orange-600 font-black text-xs">سيداوم السبت القادم</span>;
      return <span className="text-orange-500 font-black text-xs">سيأتي للدوام الغد</span>;
    }
    return <span className="text-blue-600 font-black text-xs">باقي {diffDays} يوم</span>;
  };

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.emp_number} - ${e.name}` }));

  if (showPrintView && printData) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 relative animate-in zoom-in-95">
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border-t-4 border-blue-500">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Printer className="text-blue-500"/> طباعة الإجازة المعتمدة</h2>
          <button onClick={() => setShowPrintView(false)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg transition"> العودة للنظام <ArrowRight size={16} /></button>
        </div>
        
        <div className="print-page">
          {printCompany === 'Energya' || printCompany === 'انيرجيا' ? <EnergyaLeaveTemplate data={printData as EnergyaLeaveData} /> : <JawharaLeaveTemplate data={printData as JawharaLeaveData} />}
        </div>

        {printData.attachmentUrl && (
          <div className="print-page-break mt-8 max-w-[210mm] mx-auto bg-white p-8 rounded-xl shadow-sm border print:shadow-none print:border-none print:mt-0 print:p-0">
            <h3 className="text-center font-black text-xl mb-6 text-gray-800 no-print">مرفق التقرير الطبي (السكليف)</h3>
            <img src={printData.attachmentUrl} alt="Medical Certificate" className="max-w-full h-auto mx-auto border rounded-lg print:border-none print:rounded-none object-contain" style={{ maxHeight: '250mm' }} />
          </div>
        )}

        <style jsx global>{`
          @media print { 
            .print-page-break { page-break-before: always; } 
          }
        `}</style>
      </div>
    );
  }

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  return (
    <div className="relative w-full min-h-screen animate-in fade-in pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto mt-6 px-4 md:px-0 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {(userRole === 'ADMIN' || userRole === 'MANAGER') ? (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'DASHBOARD' ? 'bg-[var(--color-navy-900)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
              <PieChart size={18}/> الداشبورد والتحليلات
            </button>
            <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'FORM' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
              <FilePlus2 size={18}/> تقديم وتعديل الطلبات
            </button>
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
                <option value="ALL">كل الفترات (مفتوح)</option>
                <option value="THIS_MONTH">إجازات الشهر الحالي</option>
                <option value="LAST_MONTH">إجازات الشهر الماضي</option>
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

      {currentView === 'DASHBOARD' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-green-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">إجازات سارية اليوم</p><div className="bg-green-50 p-2 rounded-lg text-green-600"><Activity size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.activeToday}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">طلبات بانتظار الاعتماد</p><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Clock size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.pending}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">إجمالي المعتمد (بالفترة)</p><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckCircle size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.approved}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-red-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">الطلبات المرفوضة</p><div className="bg-red-50 p-2 rounded-lg text-red-600"><XCircle size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{stats.rejected}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-sm font-black text-rose-800 mb-4 flex items-center gap-2 border-b border-rose-100 pb-2"><AlertTriangle size={18}/> رادار التلاعب (ربط بالويك إند)</h3>
              <p className="text-xs text-gray-500 font-bold mb-4">موظفين يكثرون من المرضي/الطارئ أيام الخميس والسبت.</p>
              {analytics.sus.length === 0 ? <div className="text-sm font-bold text-green-600 text-center py-4 bg-green-50 rounded-lg">لا يوجد نمط مريب حالياً. ممتاز!</div> : (
                <div className="space-y-3">
                  {analytics.sus.map((emp: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                      <div><div className="font-bold text-gray-800 text-sm">{emp.name}</div><div className="text-xs text-gray-500">{emp.code}</div></div>
                      <div className="text-rose-700 font-black text-lg">{emp.count} مرات</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2 border-b pb-2"><Stethoscope size={18}/> الأكثر استهلاكاً للمرضي</h3>
              {analytics.topSick.length === 0 ? <div className="text-sm font-bold text-gray-400 text-center py-4">لا توجد إجازات مرضية بالفترة.</div> : (
                <div className="space-y-3">
                  {analytics.topSick.map((emp: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                      <div><div className="font-bold text-gray-800 text-sm">{emp.name}</div><div className="text-xs text-gray-500">{emp.code}</div></div>
                      <div className="text-blue-700 font-black text-sm">{emp.days} يوم</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2 border-b pb-2"><CalendarOff size={18}/> الأكثر استهلاكاً للسنوي</h3>
              {analytics.topAnnual.length === 0 ? <div className="text-sm font-bold text-gray-400 text-center py-4">لا توجد إجازات سنوية بالفترة.</div> : (
                <div className="space-y-3">
                  {analytics.topAnnual.map((emp: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                      <div><div className="font-bold text-gray-800 text-sm">{emp.name}</div><div className="text-xs text-gray-500">{emp.code}</div></div>
                      <div className="text-teal-700 font-black text-sm">{emp.days} يوم</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'FORM' && (
        <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 ${editingLeaveId ? 'border-orange-500' : 'border-[var(--color-navy-500)]'} max-w-6xl mx-auto animate-in slide-in-from-bottom-4`}>
          <div className="flex items-center justify-between mb-8 pb-4 border-b">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
                <CalendarDays className={editingLeaveId ? 'text-orange-500' : 'text-[var(--color-navy-500)]'} size={32} />
                {editingLeaveId ? 'تعديل طلب الإجازة' : 'تقديم طلب إجازة'}
              </h1>
              <p className="text-gray-500 text-sm font-bold">تسجيل طلبات الإجازة لتمريرها للاعتماد والطباعة.</p>
            </div>
            {editingLeaveId && (
              <button onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"><XCircle size={16}/> إلغاء التعديل</button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 font-bold text-gray-400">جاري تحميل البيانات...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2"><User size={16}/> بيانات الموظف</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اختر الموظف (يمكنك البحث بالكتابة)</label>
                    <SearchableSelect options={empOptions} value={selectedEmpId} onChange={(val) => setSelectedEmpId(val)} placeholder="-- ابحث واختار الموظف --" />
                    
                    {lastLeave && (
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col gap-1 animate-in slide-in-from-top-2">
                        <div className="text-xs font-black text-blue-800 flex items-center gap-1"><History size={14}/> آخر إجازة مسجلة للموظف:</div>
                        <div className="text-sm font-bold text-blue-900">
                          {leaveTypesMap[lastLeave.leave_type] || lastLeave.leave_type} ({lastLeave.total_days} يوم)
                        </div>
                        <div className="text-xs font-semibold text-blue-700">
                          من {lastLeave.start_date} إلى {lastLeave.end_date}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedEmp && (
                    <div className="bg-white p-3 rounded-lg border flex flex-col justify-center animate-in zoom-in-95">
                      <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الشركة:</span><span className="text-sm font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{selectedEmp.companies?.name}</span></div>
                      <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500 font-bold">الإدارة:</span><span className="text-sm font-bold text-gray-800">{selectedEmp.departments?.name}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-500 font-bold">مدير الإدارة (للاعتماد):</span><span className="text-sm font-bold text-rose-600">{managerName || 'غير محدد'}</span></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 flex items-center gap-2"><CalendarDays size={16}/> تفاصيل الإجازة</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نوع الإجازة</label>
                    <select value={leaveData.leaveType} onChange={(e) => { setLeaveData({...leaveData, leaveType: e.target.value}); setMedicalFile(null); }} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800 cursor-pointer">
                      <option value="annual">سنوية (Annual)</option>
                      <option value="deduct">بالخصم / غير مدفوعة</option>
                      <option value="medical">مرضي (Medical)</option>
                      <option value="emergency">عارضة (Emergency)</option>
                      <option value="hajj">حج / عمرة</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">من تاريخ</label>
                    <input type="date" required value={leaveData.startDate} onChange={(e) => setLeaveData({...leaveData, startDate: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">إلى تاريخ</label>
                    <input type="date" required value={leaveData.endDate} onChange={(e) => setLeaveData({...leaveData, endDate: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800" />
                  </div>
                </div>

                {leaveData.leaveType === 'medical' && (
                  <div className="mb-6 p-5 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-xl animate-in zoom-in-95">
                    <h4 className="text-sm font-black text-blue-800 mb-3 flex items-center gap-2"><Paperclip size={16}/> إرفاق التقرير الطبي (السكليف) إجباري</h4>
                    <input type="file" accept="image/*, application/pdf" className="hidden" ref={fileInputRef} onChange={(e) => setMedicalFile(e.target.files?.[0] || null)} />
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition flex items-center gap-2">
                        <UploadCloud size={18}/> {medicalFile || leaveData.attachmentUrl ? 'تغيير الملف' : 'اختر ملف (صورة أو PDF)'}
                      </button>
                      {medicalFile ? (
                        <span className="text-sm font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={16}/> تم إرفاق: {medicalFile.name}</span>
                      ) : leaveData.attachmentUrl ? (
                        <a href={leaveData.attachmentUrl} target="_blank" className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"><ExternalLink size={14}/> عرض المرفق الحالي</a>
                      ) : (
                        <span className="text-sm font-bold text-rose-500 flex items-center gap-1"><AlertTriangle size={16}/> لم يتم الإرفاق بعد</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col justify-center items-center">
                    <span className="text-xs font-bold text-blue-600 mb-1">إجمالي أيام الإجازة</span>
                    <span className="text-2xl font-black text-blue-800">{leaveData.totalDays} يوم</span>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الموظف البديل (اختياري)</label>
                    <SearchableSelect options={[{value: '', label: '-- بدون موظف بديل --'}, ...empOptions]} value={leaveData.substituteEmployee} onChange={(val) => setLeaveData({...leaveData, substituteEmployee: val})} placeholder="-- اختر البديل --" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رقم التواصل أثناء الإجازة</label>
                    <input type="text" placeholder="05xxxxxxxx" value={leaveData.contactPhone} onChange={(e) => setLeaveData({...leaveData, contactPhone: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800 text-left dir-ltr" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={submitting || !selectedEmpId} className={`text-white px-8 py-3.5 rounded-xl font-black transition disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-xl ${editingLeaveId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[var(--color-navy-900)] hover:bg-blue-600'}`}>
                  <Save size={20} />
                  {submitting ? 'جاري الحفظ والرفع...' : (editingLeaveId ? 'تعديل الطلب' : 'إرسال الطلب للاعتماد')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 3️⃣ جدول الأرشيف والمتابعة اللحظية */}
      {/* ========================================== */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-6xl mx-auto mt-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[var(--color-navy-900)] flex items-center gap-2"><FileText className="text-gray-400"/> أرشيف الأجازات 
             {dateFilter !== 'ALL' && <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2">(حسب الفلتر الزمني)</span>}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-bold text-gray-600">
                <th className="p-4">اسم الموظف</th>
                <th className="p-4 text-center">التاريخ</th>
                <th className="p-4 text-center">النوع / المرفق</th>
                <th className="p-4 text-center">حالة الطلب</th>
                <th className="p-4 text-center">العودة للعمل</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center font-bold text-gray-400">لا توجد إجازات في هذه الفترة.</td></tr>
              ) : (
                leaveRequests.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-black text-[var(--color-navy-800)]">{req.employees?.name}</div>
                      <div className="text-xs font-bold text-gray-500">{req.employees?.emp_number} - {req.employees?.departments?.name}</div>
                    </td>
                    <td className="p-4 text-center font-bold text-sm text-gray-700">
                      {req.start_date} <ArrowRight size={12} className="inline mx-1 text-gray-400"/> {req.end_date}
                    </td>
                    <td className="p-4 text-center text-xs font-bold text-gray-600">
                      <div>{leaveTypesMap[req.leave_type] || req.leave_type}</div>
                      {req.attachment_url && (
                        <a href={req.attachment_url} target="_blank" className="text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 mt-1 bg-blue-50 rounded px-2 py-0.5 w-max mx-auto border border-blue-100"><Paperclip size={12}/> سكليف مرفق</a>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {req.status === 'PENDING' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black flex items-center justify-center gap-1 w-max mx-auto"><Clock size={14}/> قيد المراجعة</span>}
                      {req.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black flex items-center justify-center gap-1 w-max mx-auto"><CheckCircle2 size={14}/> معتمد</span>}
                      {req.status === 'REJECTED' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black flex items-center justify-center gap-1 w-max mx-auto"><XCircle size={14}/> مرفوض</span>}
                    </td>
                    <td className="p-4 text-center">
                      {calculateDaysLeft(req)}
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      {req.status === 'APPROVED' && (
                        <button onClick={() => handlePrint(req)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition flex items-center gap-1">
                          <Printer size={14} /> طباعة
                        </button>
                      )}
                      {req.status === 'PENDING' && (userRole === 'DATA_ENTRY' || userRole === 'MANAGER') && (
                        <button onClick={() => handleEdit(req)} className="bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700 px-2 py-1.5 rounded-md transition" title="تعديل"><Edit size={16} /></button>
                      )}
                      {((req.status === 'PENDING' && userRole === 'DATA_ENTRY') || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
                        <button onClick={() => handleDelete(req.id)} className="bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-700 px-2 py-1.5 rounded-md transition" title="إلغاء الإجازة"><Trash2 size={16} /></button>
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