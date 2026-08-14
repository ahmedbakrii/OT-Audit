'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, UserPlus, FileSpreadsheet, X, Upload, CheckCircle2, AlertCircle, Trash2, Filter, XCircle, ArrowRight, User, Briefcase, Building2, Activity, Clock, CalendarDays, UserX, Scale, ShieldAlert, BadgeCent } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function EmployeesPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'LIST' | 'PROFILE'>('LIST');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // الفلاتر
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [empNumber, setEmpNumber] = useState('');
  const [empName, setEmpName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile 360 State
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>({ leaves: [], perms: [], penalties: [], absences: [], ot: [], loading: true });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = ' الموظفين | STAFFCORE';
    
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setSelectedDepartment(data.department_id); 
      }
      fetchLookups();
      fetchEmployees(user.role, data?.department_id);
    }
    initUser();
  }, [router]);

  async function fetchEmployees(role = userRole, deptId = userDeptId) {
    try {
      setLoading(true);
      let query = supabase
        .from('employees')
        .select(`id, emp_number, name, job_title, status, company_id, department_id, shift_id, companies(name), departments(name), shifts(name)`);

      if (role === 'MANAGER' && deptId) {
        query = query.eq('department_id', deptId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLookups() {
    const [{ data: compData }, { data: deptData }, { data: shiftData }] = await Promise.all([
      supabase.from('companies').select('id, name'),
      supabase.from('departments').select('id, name'),
      supabase.from('shifts').select('id, name')
    ]);
    if (compData) setCompanies(compData);
    if (deptData) setDepartments(deptData);
    if (shiftData) setShifts(shiftData);
  }

  async function loadEmployee360(emp: any) {
    setSelectedEmp(emp);
    setCurrentView('PROFILE');
    setProfileData({ ...profileData, loading: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const empId = emp.id;
    const empNum = emp.emp_number;

    const pLeaves = supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'APPROVED');
    const pPerms = supabase.from('permission_requests').select('*').eq('employee_id', empId).eq('status', 'APPROVED');
    const pPenalties = supabase.from('penalty_requests').select('*').eq('employee_id', empId).eq('status', 'APPROVED');
    const pAbsences = supabase.from('absence_employees').select('*, absence_requests!inner(date, status)').eq('emp_number', empNum).eq('absence_requests.status', 'APPROVED');
    const pOT = supabase.from('ot_calculations').select('*').eq('emp_number', empNum).in('status', ['MATCHED', 'RESOLVED']);

    const [resLeaves, resPerms, resPenalties, resAbsences, resOT] = await Promise.all([pLeaves, pPerms, pPenalties, pAbsences, pOT]);

    setProfileData({
      leaves: resLeaves.data || [],
      perms: resPerms.data || [],
      penalties: resPenalties.data || [],
      absences: resAbsences.data || [],
      ot: resOT.data || [],
      loading: false
    });
  }

  const uniqueJobTitles = Array.from(new Set(employees.map(e => e.job_title))).filter(Boolean);

  // 🔴 خوارزمية الترتيب الذكي (Smart Auto-Sorting)
  const getCompanyWeight = (compName: string) => {
    if (!compName) return 99;
    if (compName.includes('انيرجيا') || compName.includes('Energya')) return 1;
    if (compName.includes('جواهر') || compName.includes('Jawhara')) return 2;
    if (compName.includes('مقاول') || compName.includes('Contractor')) return 3;
    return 4;
  };

  const getJobTitleWeight = (title: string) => {
    if (!title) return 99;
    if (title.includes('مدير')) return 1;
    if (title.includes('مهندس')) return 2;
    if (title.includes('رئيس')) return 3;
    if (title.includes('مشرف')) return 4;
    if (title.includes('مراقب')) return 5;
    if (title.includes('فني')) return 6;
    if (title.includes('مساعد') || title.includes('عامل')) return 8;
    return 7;
  };

  const filteredEmployees = employees.filter(emp => {
    return (
      (filterCompany === '' || emp.companies?.name === filterCompany) &&
      (filterDepartment === '' || emp.departments?.name === filterDepartment) &&
      (filterShift === '' || emp.shifts?.name === filterShift) &&
      (filterJobTitle === '' || emp.job_title === filterJobTitle)
    );
  }).sort((a, b) => {
    // الترتيب حسب الشركة أولاً
    const compDiff = getCompanyWeight(a.companies?.name) - getCompanyWeight(b.companies?.name);
    if (compDiff !== 0) return compDiff;
    
    // الترتيب حسب الأهمية الوظيفية ثانياً
    const jobDiff = getJobTitleWeight(a.job_title) - getJobTitleWeight(b.job_title);
    if (jobDiff !== 0) return jobDiff;
    
    // الترتيب الأبجدي أخيراً
    return a.name.localeCompare(b.name, 'ar');
  });

  // تصميم الـ Badges (الشارات)
  const getShiftBadge = (shiftName: string) => {
    if (!shiftName) return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shadow-sm">-</span>;
    if (shiftName.includes('صباحي') || shiftName.includes('نهار')) return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 shadow-sm">☀️ {shiftName}</span>;
    if (shiftName.includes('مسائيئي') || shiftName.includes('ليل') || shiftName.includes('night')) return <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 shadow-sm">🌙 {shiftName}</span>;
    return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">{shiftName}</span>;
  };

  const getCompanyBadge = (compName: string) => {
    if (!compName) return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md text-xs font-bold shadow-sm">-</span>;
    if (compName.includes('انيرجيا')) return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md text-xs font-bold border border-emerald-200 shadow-sm">🏢 {compName}</span>;
    if (compName.includes('جواهر')) return <span className="bg-violet-100 text-violet-800 px-3 py-1 rounded-md text-xs font-bold border border-violet-200 shadow-sm">💎 {compName}</span>;
    if (compName.includes('مقاول')) return <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-md text-xs font-bold border border-rose-200 shadow-sm">👷 {compName}</span>;
    return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-bold shadow-sm">{compName}</span>;
  };

  const getJobTitleBadge = (title: string) => {
    if (!title || title === 'غير محدد') return '-';
    return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-300 font-semibold shadow-sm">{title}</span>;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(filteredEmployees.map(emp => emp.id));
    else setSelectedIds([]);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  async function handleDeleteSelected() {
    if (!confirm('هل أنت متأكد من حذف الموظفين المحددين؟')) return;
    try {
      await supabase.from('employees').delete().in('id', selectedIds);
      showToast('تم حذف الموظفين بنجاح!', 'success');
      setSelectedIds([]); fetchEmployees();
    } catch (error) { showToast('حدث خطأ أثناء الحذف', 'error'); }
  }

  const resetForm = () => {
    setEditId(null); setEmpNumber(''); setEmpName(''); setJobTitle('');
    setSelectedCompany(''); setSelectedShift('');
    setSelectedDepartment(userRole === 'ADMIN' ? '' : (userDeptId || ''));
  };

  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]+$/.test(empNumber)) return showToast('الرقم الوظيفي أرقام فقط!', 'error');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('employees').insert([{
        emp_number: empNumber, name: empName, job_title: jobTitle || 'غير محدد',
        company_id: selectedCompany || null, 
        department_id: userRole === 'MANAGER' ? userDeptId : selectedDepartment || null, 
        shift_id: selectedShift || null
      }]);
      if (error) throw error;
      setShowSingleModal(false); showToast('تم الحفظ بنجاح!', 'success');
      resetForm(); fetchEmployees();
    } catch (error: any) {
      if (error.code === '23505') showToast('الرقم مسجل مسبقاً!', 'error');
    } finally { setIsSubmitting(false); }
  }

  const openEditModal = (e: React.MouseEvent, emp: any) => {
    e.stopPropagation();
    setEditId(emp.id); setEmpNumber(emp.emp_number); setEmpName(emp.name); setJobTitle(emp.job_title || '');
    setSelectedCompany(emp.company_id || ''); setSelectedDepartment(emp.department_id || ''); setSelectedShift(emp.shift_id || '');
    setShowEditModal(true);
  };

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('employees').update({
        emp_number: empNumber, name: empName, job_title: jobTitle || 'غير محدد',
        company_id: selectedCompany || null, 
        department_id: userRole === 'MANAGER' ? userDeptId : selectedDepartment || null, 
        shift_id: selectedShift || null
      }).eq('id', editId);
      if (error) throw error;
      setShowEditModal(false); showToast('تم التحديث بنجاح!', 'success');
      resetForm(); fetchEmployees();
    } catch (error: any) { showToast('حدث خطأ أثناء التحديث.', 'error'); } 
    finally { setIsSubmitting(false); }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['الرقم الوظيفي', 'الاسم', 'المسمى الوظيفي', 'الشركة', 'القسم', 'الوردية'],['10001', 'أحمد محمد', 'مراقب سلامة', 'انيرجيا', 'السلامة والصحة المهنية', 'صباحي']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "نموذج_إضافة_الموظفين.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsSubmitting(true);
        const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]);
        
        const employeesToInsert = data.map((row: any) => {
          const deptToAssign = userRole === 'ADMIN' 
            ? departments.find(d => d.name === row['القسم'])?.id || null 
            : userDeptId;

          return {
            emp_number: String(row['الرقم الوظيفي']), name: row['الاسم'], job_title: row['المسمى الوظيفي'] || 'غير محدد',
            company_id: companies.find(c => c.name === row['الشركة'])?.id || null, 
            department_id: deptToAssign, 
            shift_id: shifts.find(s => s.name === row['الوردية'])?.id || null
          };
        }).filter(emp => emp.emp_number && emp.name && emp.emp_number !== 'undefined');

        const { error } = await supabase.from('employees').insert(employeesToInsert);
        if (error) throw error;
        setShowExcelModal(false); showToast(`تم إضافة الموظفين بنجاح!`, 'success');
        fetchEmployees();
      } catch (error: any) { showToast('حدث خطأ في قراءة الملف.', 'error'); } 
      finally { setIsSubmitting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  // حسابات البروفايل
  const totalLeaves = profileData.leaves.reduce((sum: number, req: any) => sum + (req.total_days || 0), 0);
  const totalOTHours = profileData.ot.reduce((sum: number, req: any) => sum + (parseFloat(req.final_approved_hours) || 0), 0);
  const totalAbsences = profileData.absences.length;
  const totalPenalties = profileData.penalties.length;

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];
  const pieData = [
    { name: 'أيام الحضور (تقريبي)', value: 300 - totalLeaves - totalAbsences },
    { name: 'إجازات', value: totalLeaves },
    { name: 'غياب', value: totalAbsences },
  ];

  return (
    <div className="flex flex-col space-y-4 relative pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800 border-r-4 border-green-500' : 'bg-red-100 text-red-800 border-r-4 border-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {currentView === 'LIST' && (
        <div className="animate-in slide-in-from-bottom-4 space-y-4 px-4 md:px-6 mt-4 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">إدارة الموظفين</h1>
              <p className="text-gray-500 text-sm mt-1">
                إجمالي: {filteredEmployees.length} موظف {userRole === 'MANAGER' && '(في إدارتك)'}. <span className="font-bold text-blue-600">اضغط على أي موظف لفتح الملف الشامل.</span>
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                <>
                  {selectedIds.length > 0 && (
                    <button onClick={handleDeleteSelected} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition border border-red-200 font-bold">
                      <Trash2 size={18} /><span>حذف المحدد ({selectedIds.length})</span>
                    </button>
                  )}
                  <div className="relative flex-1 md:flex-none">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-full flex items-center justify-center gap-2 bg-[var(--color-navy-500)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold">
                      <span>+ إضافة</span><ChevronDown size={18} />
                    </button>
                    {isMenuOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border overflow-hidden z-10">
                        <button onClick={() => { setIsMenuOpen(false); resetForm(); setShowSingleModal(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-right hover:bg-gray-50 border-b text-gray-700 font-bold">
                          <UserPlus size={18} className="text-[var(--color-navy-500)]" /><span>موظف فردي</span>
                        </button>
                        <button onClick={() => { setIsMenuOpen(false); setShowExcelModal(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-right hover:bg-gray-50 text-gray-700 font-bold">
                          <FileSpreadsheet size={18} className="text-green-600" /><span>شيت إكسل</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* شريط الفلاتر */}
          <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-[var(--color-navy-900)] font-semibold">
              <Filter size={18} /> الفرز حسب:
            </div>
            
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px] font-bold">
              <option value="">كل الشركات</option>
              {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>

            {userRole !== 'MANAGER' && (
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px] font-bold">
                <option value="">كل الأقسام</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            )}

            <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px] font-bold">
              <option value="">كل الورديات</option>
              {shifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px] font-bold">
              <option value="">كل المهن</option>
              {uniqueJobTitles.map((title: any, idx) => <option key={idx} value={title}>{title}</option>)}
            </select>

            {(filterCompany || filterDepartment || filterShift || filterJobTitle) && (
              <button onClick={() => { setFilterCompany(''); setFilterDepartment(''); setFilterShift(''); setFilterJobTitle(''); }} className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-semibold transition mr-auto">
                <XCircle size={16} /> مسح الفلاتر
              </button>
            )}
          </div>

          {/* Employee Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)]">
                    {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                      <th className="p-4 w-12 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-[var(--color-navy-500)]" checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0} onChange={handleSelectAll} /></th>
                    )}
                    <th className="p-4 font-semibold">الرقم الوظيفي</th>
                    <th className="p-4 font-semibold">الاسم</th>
                    <th className="p-4 font-semibold">المهنة</th>
                    <th className="p-4 font-semibold">الشركة</th>
                    <th className="p-4 font-semibold">القسم</th>
                    <th className="p-4 font-semibold">الوردية</th>
                    <th className="p-4 font-semibold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={userRole === 'ADMIN' || userRole === 'MANAGER' ? 8 : 7} className="p-8 text-center text-gray-500 font-bold">جاري تحميل البيانات...</td></tr> : 
                  filteredEmployees.length === 0 ? <tr><td colSpan={userRole === 'ADMIN' || userRole === 'MANAGER' ? 8 : 7} className="p-8 text-center text-gray-500 font-bold">لا يوجد موظفين يطابقون الفلتر الحالي.</td></tr> :
                  filteredEmployees.map((emp) => (
                    <tr 
                      key={emp.id} 
                      onClick={() => loadEmployee360(emp)}
                      className={`border-b transition cursor-pointer ${selectedIds.includes(emp.id) ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}
                    >
                      {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                        <td className="p-4 text-center">
                          <input type="checkbox" className="w-4 h-4 cursor-pointer accent-[var(--color-navy-500)]" checked={selectedIds.includes(emp.id)} onChange={(e) => handleSelect(e, emp.id)} />
                        </td>
                      )}
                      <td className="p-4 font-bold text-gray-800">{emp.emp_number}</td>
                      <td className="p-4 font-black text-[var(--color-navy-900)] flex items-center gap-2 group">
                        {emp.name}
                        <ArrowRight size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                      </td>
                      <td className="p-4">{getJobTitleBadge(emp.job_title)}</td>
                      <td className="p-4">{getCompanyBadge(emp.companies?.name)}</td>
                      <td className="p-4 text-gray-700 font-bold">{emp.departments?.name || '-'}</td>
                      <td className="p-4">{getShiftBadge(emp.shifts?.name)}</td>
                      <td className="p-4 text-center">
                        {(userRole === 'ADMIN' || userRole === 'MANAGER') ? (
                          <button onClick={(e) => openEditModal(e, emp)} className="text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 shadow-sm">تعديل</button>
                        ) : (
                          <span className="text-gray-400 text-xs font-bold bg-gray-100 px-2 py-1 rounded">عرض فقط</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* شاشة ملف الموظف الشامل (360° Profile) */}
      {/* ========================================== */}
      {currentView === 'PROFILE' && selectedEmp && (
        <div className="space-y-6 animate-in slide-in-from-right-4 px-4 md:px-6 mt-4 max-w-7xl mx-auto w-full">
          
          <button onClick={() => setCurrentView('LIST')} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border transition w-max">
            <ArrowRight size={18}/> العودة لقائمة الموظفين
          </button>

          {/* ההيدر التعريفي */}
          <div className="bg-gradient-to-l from-[var(--color-navy-900)] to-blue-800 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/20 shrink-0 z-10">
              <User size={50} className="text-white" />
            </div>
            <div className="text-center md:text-right z-10 flex-1">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-black">{selectedEmp.name}</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1"><CheckCircle2 size={14}/> نشط</span>
              </div>
              <p className="text-blue-200 text-lg font-bold flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg"><Briefcase size={16}/> {selectedEmp.job_title}</span>
                <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg"><Building2 size={16}/> {selectedEmp.departments?.name}</span>
                <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg font-mono">#{selectedEmp.emp_number}</span>
              </p>
              {/* كروت تفصيلية للشركة والوردية بتصميم فخم */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                  <BadgeCent size={16} className="text-gray-500"/>
                  <span className="text-gray-800">الشركة:</span>
                  {getCompanyBadge(selectedEmp.companies?.name)}
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                  <Clock size={16} className="text-gray-500"/>
                  <span className="text-gray-800">الوردية:</span>
                  {getShiftBadge(selectedEmp.shifts?.name)}
                </div>
              </div>
            </div>
            <div className="absolute left-0 top-0 opacity-10 transform -translate-x-1/4 -translate-y-1/4"><Activity size={250} /></div>
          </div>

          {profileData.loading ? (
            <div className="text-center py-20 font-bold text-gray-400 bg-white rounded-2xl shadow-sm border">جاري تجميع بيانات الموظف (360° Profile)...</div>
          ) : (
            <>
              {/* كروت الإحصائيات الشاملة */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border-t-4 border-emerald-500 hover:-translate-y-1 transition transform">
                  <div className="flex justify-between items-start"><p className="text-gray-500 text-xs font-bold mb-1">إجمالي الإضافي المعتمد</p><div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600"><Clock size={16}/></div></div>
                  <h3 className="text-2xl font-black text-gray-800 mt-1">{totalOTHours} <span className="text-xs text-gray-400">ساعة</span></h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-t-4 border-blue-500 hover:-translate-y-1 transition transform">
                  <div className="flex justify-between items-start"><p className="text-gray-500 text-xs font-bold mb-1">أيام الإجازات المستهلكة</p><div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><CalendarDays size={16}/></div></div>
                  <h3 className="text-2xl font-black text-gray-800 mt-1">{totalLeaves} <span className="text-xs text-gray-400">يوم</span></h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-t-4 border-orange-500 hover:-translate-y-1 transition transform">
                  <div className="flex justify-between items-start"><p className="text-gray-500 text-xs font-bold mb-1">مرات الاستئذان المعتمدة</p><div className="bg-orange-50 p-1.5 rounded-lg text-orange-600"><Activity size={16}/></div></div>
                  <h3 className="text-2xl font-black text-gray-800 mt-1">{profileData.perms.length} <span className="text-xs text-gray-400">مرات</span></h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-t-4 border-rose-500 hover:-translate-y-1 transition transform">
                  <div className="flex justify-between items-start"><p className="text-gray-500 text-xs font-bold mb-1">أيام الغياب</p><div className="bg-rose-50 p-1.5 rounded-lg text-rose-600"><UserX size={16}/></div></div>
                  <h3 className="text-2xl font-black text-gray-800 mt-1">{totalAbsences} <span className="text-xs text-gray-400">يوم</span></h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-t-4 border-[var(--color-navy-900)] hover:-translate-y-1 transition transform">
                  <div className="flex justify-between items-start"><p className="text-gray-500 text-xs font-bold mb-1">الجزاءات الموقعة</p><div className="bg-slate-100 p-1.5 rounded-lg text-slate-800"><Scale size={16}/></div></div>
                  <h3 className="text-2xl font-black text-gray-800 mt-1">{totalPenalties} <span className="text-xs text-gray-400">جزاء</span></h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الرسم البياني لنسبة الالتزام */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border lg:col-span-1 flex flex-col">
                  <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-4 border-b pb-2 flex items-center gap-2"><ShieldAlert size={16} className="text-blue-500"/> مؤشر التواجد والانضباط</h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData.filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                          {pieData.filter(d=>d.value>0).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', fontWeight: 'bold', border: 'none', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-600"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> حضور</div>
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-600"><span className="w-3 h-3 rounded-full bg-blue-500"></span> إجازات</div>
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-600"><span className="w-3 h-3 rounded-full bg-rose-500"></span> غياب</div>
                  </div>
                </div>

                {/* السجلات التفصيلية */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* سجل الجزاءات */}
                  <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex items-center gap-2">
                      <Scale className="text-rose-800" size={18}/> <h3 className="font-black text-rose-900 text-sm">أرشيف الجزاءات</h3>
                    </div>
                    <div className="p-0">
                      {profileData.penalties.length === 0 ? <p className="p-4 text-center text-xs font-bold text-gray-400">سجل الموظف خالي من الجزاءات. أداء ممتاز! 🌟</p> : (
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50 text-gray-500 sticky top-0"><tr><th className="p-3">التاريخ</th><th className="p-3">النوع</th><th className="p-3">القرار</th></tr></thead>
                            <tbody>
                              {profileData.penalties.map((p:any) => (
                                <tr key={p.id} className="border-b last:border-0 hover:bg-rose-50/30">
                                  <td className="p-3 font-bold">{p.date_of_penalty}</td>
                                  <td className="p-3 font-black text-rose-700">{p.type_of_penalty}</td>
                                  <td className="p-3 text-gray-600 font-bold">{p.penalty_decision}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* سجل الإجازات */}
                  <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-center gap-2">
                      <CalendarDays className="text-blue-600" size={18}/> <h3 className="font-black text-blue-900 text-sm">سجل الإجازات المعتمدة</h3>
                    </div>
                    <div className="p-0">
                      {profileData.leaves.length === 0 ? <p className="p-4 text-center text-xs font-bold text-gray-400">لم يقم الموظف باستهلاك أي إجازات.</p> : (
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50 text-gray-500 sticky top-0"><tr><th className="p-3">النوع</th><th className="p-3">من</th><th className="p-3">إلى</th><th className="p-3 text-center">المدة</th></tr></thead>
                            <tbody>
                              {profileData.leaves.map((l:any) => (
                                <tr key={l.id} className="border-b last:border-0 hover:bg-blue-50/30">
                                  <td className="p-3 font-black text-blue-700">{l.leave_type === 'annual' ? 'سنوية' : l.leave_type === 'medical' ? 'مرضي' : l.leave_type}</td>
                                  <td className="p-3 font-bold">{l.start_date}</td>
                                  <td className="p-3 font-bold">{l.end_date}</td>
                                  <td className="p-3 text-center font-black bg-blue-50/50 text-blue-800">{l.total_days} أيام</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* المودالز (تظهر للأدمن والمدير فقط) */}
      {currentView === 'LIST' && (userRole === 'ADMIN' || userRole === 'MANAGER') && (showSingleModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--color-navy-900)]">{showEditModal ? 'تعديل الموظف' : 'إضافة موظف'}</h2>
              <button onClick={() => { setShowSingleModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={showEditModal ? handleUpdateEmployee : handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الرقم الوظيفي *</label>
                <input type="text" value={empNumber} onChange={(e) => setEmpNumber(e.target.value)} className="w-full border rounded-lg p-2 outline-none font-bold" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم رباعي *</label>
                <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} className="w-full border rounded-lg p-2 outline-none font-bold" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المسمى الوظيفي *</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg p-2 outline-none font-bold" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الشركة *</label>
                  <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full border rounded-lg p-2 outline-none font-bold" required>
                    <option value="" disabled>اختر...</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">القسم *</label>
                  <select 
                    value={selectedDepartment} 
                    onChange={(e) => setSelectedDepartment(e.target.value)} 
                    disabled={userRole !== 'ADMIN'}
                    className="w-full border rounded-lg p-2 outline-none font-bold disabled:bg-gray-100 disabled:text-gray-500" 
                    required
                  >
                    <option value="" disabled>اختر...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الوردية *</label>
                <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full border rounded-lg p-2 outline-none font-bold" required>
                  <option value="" disabled>اختر...</option>{shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[var(--color-navy-500)] text-white py-2.5 rounded-lg mt-4 disabled:opacity-50 font-bold shadow-md">
                {isSubmitting ? 'جاري الحفظ...' : (showEditModal ? 'تحديث البيانات' : 'حفظ الموظف')}
              </button>
            </form>
          </div>
        </div>
      )}

      {currentView === 'LIST' && (userRole === 'ADMIN' || userRole === 'MANAGER') && showExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--color-navy-900)]">إضافة موظفين (Excel)</h2>
              <button onClick={() => setShowExcelModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} />
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition">
              <Upload size={32} className="mx-auto text-[var(--color-navy-500)] mb-3" />
              <p className="text-gray-800 font-bold mb-1">{isSubmitting ? 'جاري المعالجة...' : 'اضغط لاختيار ملف إكسل'}</p>
              {userRole === 'MANAGER' && <p className="text-xs text-orange-600 mt-2 font-bold">* سيتم إدراج جميع الموظفين في الملف تحت إدارتك تلقائياً.</p>}
            </div>
            <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 mt-6 rounded-lg hover:bg-green-700 font-bold shadow-md">
              <FileSpreadsheet size={18} /><span>تحميل النموذج المعتمد</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}