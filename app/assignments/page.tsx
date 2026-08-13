'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Clock, CalendarDays, Save, Printer, User, CheckCircle2, AlertCircle, ArrowRight, FileText, XCircle, Search, Edit, Trash2, Filter, LayoutDashboard, FilePlus2, PieChart, Activity, CheckCircle, Timer, AlertTriangle, Users, Building2, SunMoon, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

import AssignmentPrintTemplate, { AssignmentPrintData } from '@/components/assignments/AssignmentPrintTemplate';

export default function AssignmentsPage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split('T')[0];

  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'FORM'>('FORM');

  const [assignments, setAssignments] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);

  const [filterStartDate, setFilterStartDate] = useState(todayStr);
  const [filterEndDate, setFilterEndDate] = useState(todayStr);
  const [deptFilter, setDeptFilter] = useState<string>(''); 

  const [formDate, setFormDate] = useState(todayStr);
  const [formDept, setFormDept] = useState('');
  const [searchEmp, setSearchEmp] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState(''); 
  
  const [dayEndHour, setDayEndHour] = useState('20');
  const [dayEndMinute, setDayEndMinute] = useState('00');
  const [nightEndHour, setNightEndHour] = useState('08');
  const [nightEndMinute, setNightEndMinute] = useState('00');

  const [selectedEmpNumbers, setSelectedEmpNumbers] = useState<string[]>([]);
  const [empTimes, setEmpTimes] = useState<Record<string, string>>({});
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const checkIsNightShift = (shiftName: string) => {
    if (!shiftName) return false;
    const s = shiftName.toLowerCase();
    return s.includes('ليل') || s.includes('مسا') || s.includes('night');
  };

  const calculateOTHours = (isNight: boolean, actualEnd: string) => {
    if (!actualEnd) return 0;
    const basicEnd = isNight ? '04:00' : '16:00';
    const getMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    
    let diff = getMins(actualEnd.substring(0,5)) - getMins(basicEnd);
    if (diff < 0) diff += 24 * 60;
    
    return Math.round((diff / 60) * 10) / 10;
  };

  useEffect(() => {
    document.title = ' التكاليف  | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserId(user.id);

    if (user.role === 'FACTORY_MANAGER' || user.role === 'ADMIN' || user.role === 'MANAGER') setCurrentView('DASHBOARD');
    else setCurrentView('FORM');

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setFormDept(data.department_id); 
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
    else { setAvailableEmployees([]); setSelectedEmpNumbers([]); setEmpTimes({}); }
  }, [formDept]);

  async function loadData() {
    setLoading(true);
    
    // 🔴 الحل السحري: سحب كل الإدارات بغض النظر عن الصلاحية عشان الاسم يظهر للكل
    const { data: depts } = await supabase.from('departments').select('id, name');
    if (depts) setDepartments(depts);

    let query = supabase.from('ot_assignments').select(`
      id, date, day_end_time, night_end_time, status, reason, created_at, department_id, departments(name),
      ot_assignment_employees(emp_number, ot_end_time, shift_snapshot, employees(name, job_title, companies(name), shifts(name)))
    `).gte('date', filterStartDate).lte('date', filterEndDate).order('date', { ascending: false });

    if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') query = query.eq('department_id', userDeptId);
    else if ((userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && deptFilter) query = query.eq('department_id', deptFilter);

    const { data: reqs } = await query;
    if (reqs) setAssignments(reqs);
    setLoading(false);
  }

  async function loadEmployeesForForm() {
    try {
      const { data } = await supabase.from('employees').select('emp_number, name, job_title, companies(name), shifts(name)').eq('department_id', formDept).eq('status', 'ACTIVE').order('name');
      setAvailableEmployees(data || []);
      if (!editingAssignmentId) { setSelectedEmpNumbers([]); setEmpTimes({}); }
    } catch (err) { console.error(err); }
  }

  const handleSelectEmp = (empNumber: string, shiftName: string) => {
    if (selectedEmpNumbers.includes(empNumber)) {
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => id !== empNumber));
    } else {
      setSelectedEmpNumbers([...selectedEmpNumbers, empNumber]);
      const isNight = checkIsNightShift(shiftName);
      setEmpTimes(prev => ({ ...prev, [empNumber]: isNight ? `${nightEndHour}:${nightEndMinute}` : `${dayEndHour}:${dayEndMinute}` }));
    }
  };

  const handleSelectAllDisplayed = (e: React.ChangeEvent<HTMLInputElement>, displayedEmps: any[]) => {
    if (e.target.checked) {
      const newSelected = [...selectedEmpNumbers];
      const newTimes = { ...empTimes };
      displayedEmps.forEach(emp => {
        if (!newSelected.includes(emp.emp_number)) {
          newSelected.push(emp.emp_number);
          const isNight = checkIsNightShift(emp.shifts?.name);
          newTimes[emp.emp_number] = isNight ? `${nightEndHour}:${nightEndMinute}` : `${dayEndHour}:${dayEndMinute}`;
        }
      });
      setSelectedEmpNumbers(newSelected);
      setEmpTimes(newTimes);
    } else {
      const displayedIds = displayedEmps.map(emp => emp.emp_number);
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => !displayedIds.includes(id)));
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmpNumbers.length === 0) return showToast('يجب تحديد موظف واحد على الأقل', 'error');
    if (userRole === 'DATA_ENTRY' && formDate < todayStr) return showToast('لا يمكن التكليف لتواريخ سابقة', 'error');

    setSubmitting(true);
    try {
      let targetAssignId = editingAssignmentId;

      if (editingAssignmentId) {
        await supabase.from('ot_assignments').update({ date: formDate, department_id: formDept, status: 'PENDING' }).eq('id', editingAssignmentId);
        await supabase.from('ot_assignment_employees').delete().eq('assignment_id', editingAssignmentId);
      } else {
        const { data: exist } = await supabase.from('ot_assignments').select('id').eq('date', formDate).eq('department_id', formDept).maybeSingle();
        if (exist) {
          targetAssignId = exist.id;
          await supabase.from('ot_assignments').update({ status: 'PENDING' }).eq('id', targetAssignId);
        } else {
          const { data: newAssign } = await supabase.from('ot_assignments').insert([{
            date: formDate, department_id: formDept, status: 'PENDING',
            day_end_time: `${dayEndHour}:${dayEndMinute}:00`, night_end_time: `${nightEndHour}:${nightEndMinute}:00`
          }]).select().single();
          targetAssignId = newAssign.id;
        }
      }

      const records = selectedEmpNumbers.map(empNum => {
        const emp = availableEmployees.find(e => e.emp_number === empNum);
        const isNight = checkIsNightShift(emp?.shifts?.name);
        const defaultTime = isNight ? `${nightEndHour}:${nightEndMinute}` : `${dayEndHour}:${dayEndMinute}`;
        const finalTime = empTimes[empNum] || defaultTime;
        
        return {
          assignment_id: targetAssignId,
          emp_number: empNum,
          shift_snapshot: emp?.shifts?.name || '',
          ot_end_time: `${finalTime}:00`
        };
      });
      
      if (!editingAssignmentId) {
        const { data: existing } = await supabase.from('ot_assignment_employees').select('emp_number').eq('assignment_id', targetAssignId);
        const existingSet = new Set(existing?.map(e => e.emp_number) || []);
        const newRecords = records.filter(r => !existingSet.has(r.emp_number));
        if (newRecords.length > 0) await supabase.from('ot_assignment_employees').insert(newRecords);
      } else {
        await supabase.from('ot_assignment_employees').insert(records);
      }

      await supabase.from('notifications').insert([{
        title: '🔔 تكليف إضافي بانتظار الاعتماد',
        body: `تم تسجيل تكليف إضافي لعدد ${selectedEmpNumbers.length} موظفين بتاريخ ${formDate}`,
        department_id: formDept,
        target_url: '/approvals' 
      }]);
      window.dispatchEvent(new Event('new_notification'));

      showToast(editingAssignmentId ? 'تم التعديل بنجاح' : 'تم تسجيل التكليف وتم إشعار المدير', 'success');
      resetForm();
      loadData();
    } catch (err) {
      showToast('حدث خطأ أثناء החفظ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (assign: any) => {
    if (assign.status === 'APPROVED' && userRole === 'DATA_ENTRY') return showToast('لا يمكنك تعديل تكليف معتمد', 'error');
    
    setEditingAssignmentId(assign.id);
    setFormDate(assign.date);
    setFormDept(assign.department_id);

    const empIds: string[] = [];
    const timesMap: Record<string, string> = {};
    
    assign.ot_assignment_employees?.forEach((e: any) => {
      empIds.push(e.emp_number);
      const sName = e.shift_snapshot || (Array.isArray(e.employees) ? e.employees[0]?.shifts?.name : e.employees?.shifts?.name) || '';
      const isNight = checkIsNightShift(sName);
      const endTime = e.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5);
      if (endTime) timesMap[e.emp_number] = endTime;
    });

    setSelectedEmpNumbers(empIds);
    setEmpTimes(timesMap);
    setCurrentView('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التكليف بالكامل؟')) return;
    await supabase.from('ot_assignments').delete().eq('id', id);
    showToast('تم الحذف بنجاح', 'success');
    loadData();
  };

  const resetForm = () => {
    setEditingAssignmentId(null); setSelectedEmpNumbers([]); setEmpTimes({}); setFormDate(todayStr);
  };

  const handlePrint = (assign: any) => {
    const employeeMap = new Map();

    assign.ot_assignment_employees?.forEach((emp: any) => {
      const empData = Array.isArray(emp.employees) ? emp.employees[0] : emp.employees;
      const shiftName = emp.shift_snapshot || empData?.shifts?.name || '';
      const isNight = checkIsNightShift(shiftName);
      const basicEnd = isNight ? '04:00' : '16:00';
      const actualEnd = emp.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5) || '';

      const otDuration = calculateOTHours(isNight, actualEnd) * 60;

      employeeMap.set(emp.emp_number, {
        emp_number: emp.emp_number,
        employees: { name: empData?.name, job_title: empData?.job_title },
        companyName: empData?.companies?.name || 'أخرى',
        basicEnd, actualEnd, otDuration
      });
    });

    const allEmployees = Array.from(employeeMap.values()).sort((a: any, b: any) => b.otDuration - a.otDuration);

    const energyaEmps = allEmployees.filter(e => e.companyName.includes('Energya') || e.companyName.includes('انيرجيا'));
    const jawharaEmps = allEmployees.filter(e => e.companyName.includes('Jawhara') || e.companyName.includes('جواهر') || e.companyName.includes('جوهرة'));

    setPrintData({
      date: assign.date,
      departmentName: assign.departments?.name || 'الإدارة',
      energyaEmployees: energyaEmps,
      jawharaEmployees: jawharaEmps
    } as any);
    
    setShowPrintView(true);
  };

  const getDashboardStats = () => {
    let totalMins = 0;
    const deptStats: Record<string, number> = {};
    const empStats: Record<string, number> = {};
    let activeAssignments = 0;

    assignments.forEach(a => {
      if (a.status !== 'APPROVED') return;
      activeAssignments++;
      const dName = a.departments?.name || 'أخرى';
      
      a.ot_assignment_employees?.forEach((e: any) => {
        const empData = Array.isArray(e.employees) ? e.employees[0] : e.employees;
        const shiftName = e.shift_snapshot || empData?.shifts?.name || '';
        const isNight = checkIsNightShift(shiftName);
        const actualEnd = e.ot_end_time?.substring(0, 5) || (isNight ? a.night_end_time : a.day_end_time)?.substring(0, 5) || '';

        const hours = calculateOTHours(isNight, actualEnd);
        const diff = hours * 60;

        totalMins += diff;
        deptStats[dName] = (deptStats[dName] || 0) + diff;
        
        const empName = empData?.name || e.emp_number;
        empStats[empName] = (empStats[empName] || 0) + diff;
      });
    });

    const totalHours = Math.round((totalMins / 60) * 10) / 10;
    const isSingleDept = (userRole === 'MANAGER' || deptFilter !== '');

    const topItems = Object.entries(isSingleDept ? empStats : deptStats)
      .map(([name, mins]) => ({ name, value: Math.round((mins as number / 60) * 10) / 10 }))
      .sort((a, b) => b.value - a.value);

    return { totalHours, activeAssignments, topItems, isSingleDept };
  };

  const dashboardData = getDashboardStats();

  const uniqueCompanies = Array.from(new Set(availableEmployees.map((e: any) => e.companies?.name))).filter(Boolean);
  const uniqueShifts = Array.from(new Set(availableEmployees.map((e: any) => e.shifts?.name))).filter(Boolean);
  const uniqueJobTitles = Array.from(new Set(availableEmployees.map((e: any) => e.job_title))).filter(Boolean); 

  const displayedEmployeesForForm = availableEmployees.filter(emp => {
    const matchSearch = emp.name?.includes(searchEmp) || emp.emp_number?.includes(searchEmp);
    const matchComp = filterCompany ? (emp as any).companies?.name === filterCompany : true;
    const matchShift = filterShift ? (emp as any).shifts?.name === filterShift : true;
    const matchJob = filterJobTitle ? emp.job_title === filterJobTitle : true;
    return matchSearch && matchComp && matchShift && matchJob;
  });

  if (showPrintView && printData) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 relative animate-in zoom-in-95">
        <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border-t-4 border-blue-500">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Printer className="text-blue-500"/> معاينة الطباعة (مفصولة للشركات)</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-[var(--color-navy-900)] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">🖨️ طباعة الأوراق</button>
            <button onClick={() => setShowPrintView(false)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg transition">إغلاق <XCircle size={16}/></button>
          </div>
        </div>
        
        <div className="flex flex-col gap-8 items-center pb-10">
          {printData.energyaEmployees?.length > 0 && (
            <div className="print-page-break">
              <AssignmentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, employees: printData.energyaEmployees, companyType: 'Energya' }} showPrintButton={false} />
            </div>
          )}
          {printData.jawharaEmployees?.length > 0 && (
            <div className="print-page-break mt-8 print:mt-0">
              <AssignmentPrintTemplate data={{ date: printData.date, departmentName: printData.departmentName, employees: printData.jawharaEmployees, companyType: 'Jawhara' }} showPrintButton={false} />
            </div>
          )}
          {(!printData.energyaEmployees?.length && !printData.jawharaEmployees?.length) && (
            <div className="text-center font-bold text-gray-500 py-20 bg-white w-[210mm] rounded-xl border">لا يوجد موظفين تابعين لإنرجيا أو جوهرة لطباعتهم. (مقاول فقط)</div>
          )}
        </div>
        
        <style jsx global>{`
          @media print { .print-page-break { page-break-after: always; } .print-page-break:last-child { page-break-after: auto; } }
        `}</style>
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
            <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${currentView === 'FORM' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FilePlus2 size={18}/> إدارة التكاليف</button>
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
            <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-blue-800 cursor-pointer" />
          </div>
          <div className="flex items-center gap-2 border-l pl-3">
            <span className="text-sm font-semibold text-gray-500">إلى:</span>
            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-blue-800 cursor-pointer" />
          </div>
        </div>
      </div>

      {currentView === 'DASHBOARD' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">إجمالي الساعات المعتمدة</p><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Timer size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{dashboardData.totalHours}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-green-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">عدد التكاليف المعتمدة</p><div className="bg-green-50 p-2 rounded-lg text-green-600"><CheckCircle2 size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{dashboardData.activeAssignments}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500">
              <div className="flex justify-between items-start"><p className="text-gray-500 text-sm font-bold mb-1">بانتظار الاعتماد</p><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Clock size={20}/></div></div>
              <h3 className="text-4xl font-black text-gray-800">{assignments.filter(a => a.status === 'PENDING').length}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-black text-[var(--color-navy-800)] mb-6 border-b pb-2 flex items-center gap-2">
              <Activity size={18} className="text-blue-500"/>
              {dashboardData.isSingleDept ? 'الموظفين الأعلى حصولاً على الإضافي (بهذه الإدارة)' : 'توزيع الساعات الإضافية على إدارات المصنع'}
            </h3>
            
            {dashboardData.topItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 font-bold">لا يوجد بيانات لعرضها في هذه الفترة.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.topItems.slice(0, 10)} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 'bold' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }} />
                    <RechartsTooltip cursor={{fill: '#fef2f2'}} contentStyle={{ borderRadius: '10px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={dashboardData.isSingleDept ? 30 : 50}>
                      {dashboardData.topItems.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'FORM' && (
        <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-t-4 ${editingAssignmentId ? 'border-orange-500' : 'border-[var(--color-navy-500)]'} max-w-6xl mx-auto animate-in slide-in-from-bottom-4`}>
          <div className="flex items-center justify-between mb-8 pb-4 border-b">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
                <Clock className={editingAssignmentId ? 'text-orange-500' : 'text-[var(--color-navy-500)]'} size={32} />
                {editingAssignmentId ? 'تعديل تكليف الإضافي' : 'إنشاء تكليف إضافي جديد'}
              </h1>
              <p className="text-gray-500 text-sm font-bold">تسجيل ساعات الإضافي لتمريرها للاعتماد والطباعة.</p>
            </div>
            {editingAssignmentId && <button onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"><XCircle size={16}/> إلغاء التعديل</button>}
          </div>

          <form onSubmit={handleSaveAssignment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ التكليف</label>
                <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800" disabled={!!editingAssignmentId && userRole === 'DATA_ENTRY'}/>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الإدارة</label>
                {/* 🔴 الحل الجذري للإدارة: Select محمي ويظهر الاسم دايماً */}
                <select 
                  value={formDept} 
                  onChange={(e) => setFormDept(e.target.value)} 
                  disabled={userRole === 'DATA_ENTRY' || userRole === 'MANAGER'} 
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-800 disabled:bg-gray-200 disabled:text-gray-700 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>اختر الإدارة...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {formDept && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[var(--color-navy-900)] text-white p-3 flex justify-between items-center">
                  <span className="font-bold text-sm flex items-center gap-2"><Users size={16}/> تحديد الموظفين والأوقات</span>
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer hover:text-blue-200">
                    <input type="checkbox" className="w-4 h-4 accent-blue-500 rounded" checked={displayedEmployeesForForm.length > 0 && displayedEmployeesForForm.every(emp => selectedEmpNumbers.includes(emp.emp_number))} onChange={(e) => handleSelectAllDisplayed(e, displayedEmployeesForForm)} /> تحديد المعروض
                  </label>
                </div>
                
                <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
                    <input type="text" placeholder="بحث بالاسم أو الرقم..." value={searchEmp} onChange={(e) => setSearchEmp(e.target.value)} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm outline-none" />
                  </div>
                  <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border rounded-lg px-2 py-2 text-sm outline-none font-bold text-gray-700 bg-white"><option value="">كل الشركات</option>{uniqueCompanies.map((c: any) => <option key={c} value={c}>{c}</option>)}</select>
                  <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="border rounded-lg px-2 py-2 text-sm outline-none font-bold text-gray-700 bg-white"><option value="">كل الورديات</option>{uniqueShifts.map((s: any) => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="border rounded-lg px-2 py-2 text-sm outline-none font-bold text-gray-700 bg-white min-w-[120px]"><option value="">كل الوظائف</option>{uniqueJobTitles.map((j: any) => <option key={j} value={j}>{j}</option>)}</select>
                </div>

                <div className="max-h-[350px] overflow-y-auto p-3 space-y-2 bg-gray-100">
                  {displayedEmployeesForForm.length === 0 ? (
                    <div className="text-center font-bold text-gray-400 py-10">لا يوجد موظفين متطابقين مع الفلتر الحالي.</div>
                  ) : (
                    displayedEmployeesForForm.map(emp => {
                      const isNight = checkIsNightShift(emp.shifts?.name);
                      const defaultEnd = isNight ? `${nightEndHour}:${nightEndMinute}` : `${dayEndHour}:${dayEndMinute}`;
                      const actualEnd = empTimes[emp.emp_number] || defaultEnd;
                      const calcHrs = calculateOTHours(isNight, actualEnd);

                      return (
                        <div key={emp.emp_number} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-lg border transition ${selectedEmpNumbers.includes(emp.emp_number) ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-300' : 'bg-white hover:bg-gray-50'}`}>
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <input type="checkbox" className="w-5 h-5 accent-[var(--color-navy-500)] rounded cursor-pointer" checked={selectedEmpNumbers.includes(emp.emp_number)} onChange={() => handleSelectEmp(emp.emp_number, emp.shifts?.name || '')} />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1 w-full items-center">
                              <div className="col-span-1 sm:col-span-1">
                                <p className="text-sm font-black text-[var(--color-navy-900)] truncate" title={emp.name}>{emp.name}</p>
                                <p className="text-xs font-bold text-gray-500">{emp.emp_number}</p>
                              </div>
                              <div className="text-xs font-bold text-gray-600 truncate" title={emp.job_title}>{emp.job_title}</div>
                              <div className="text-xs font-bold text-gray-600 truncate">{emp.companies?.name}</div>
                              <div>
                                <span className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap ${isNight ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>{emp.shifts?.name || 'غير محدد'}</span>
                              </div>
                            </div>
                          </label>

                          {selectedEmpNumbers.includes(emp.emp_number) && (
                            <div className="flex items-center gap-3 bg-white border border-blue-100 p-2 rounded-lg shadow-sm" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-gray-500">انصراف:</span>
                                <input type="time" value={actualEnd} onChange={(e) => setEmpTimes(prev => ({...prev, [emp.emp_number]: e.target.value}))} className="bg-gray-50 border border-gray-200 rounded p-1 text-sm font-black text-blue-700 outline-none w-24 text-center cursor-pointer" required />
                              </div>
                              <div className="bg-rose-50 px-3 py-1.5 rounded border border-rose-100 min-w-[75px] text-center">
                                <span className="text-xs font-black text-rose-600">{calcHrs} ساعة</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={submitting || selectedEmpNumbers.length === 0} className={`text-white px-8 py-3.5 rounded-xl font-black transition disabled:opacity-50 flex items-center gap-2 shadow-lg ${editingAssignmentId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[var(--color-navy-900)] hover:bg-blue-600'}`}>
                <Save size={20} /> {submitting ? 'جاري الحفظ...' : (editingAssignmentId ? 'حفظ التعديلات' : 'إرسال التكليف للاعتماد')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3️⃣ جدول أرشيف التكاليف التفصيلي */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-6xl mx-auto mt-8 mb-8">
        <h2 className="text-xl font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-2"><FileText className="text-gray-400"/> سجل التكاليف التفصيلي</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-bold text-gray-600">
                <th className="p-4">التاريخ والقسم</th>
                <th className="p-4 w-3/5">الموظفين المحسوبين في التكليف</th>
                <th className="p-4 text-center">حالة التكليف</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center font-bold text-gray-400">لا توجد تكليفات مسجلة في هذه الفترة.</td></tr>
              ) : (
                assignments.map((assign) => (
                  <tr key={assign.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 align-top">
                      <div className="font-black text-[var(--color-navy-800)] text-sm mb-1">{new Date(assign.date).toLocaleDateString('en-GB')}</div>
                      <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">{assign.departments?.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {assign.ot_assignment_employees?.map((emp: any, i: number) => {
                          const empData = Array.isArray(emp.employees) ? emp.employees[0] : emp.employees;
                          const sName = emp.shift_snapshot || empData?.shifts?.name || '';
                          const isNight = checkIsNightShift(sName);
                          const endTime = emp.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5) || '';
                          const otHrs = calculateOTHours(isNight, endTime);

                          return (
                            <div key={i} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-2 rounded-md hover:bg-blue-50 transition">
                              <div className="flex flex-col min-w-0 flex-1 pr-2">
                                <span className="text-xs font-bold text-gray-800 truncate" title={empData?.name}>{empData?.name || emp.emp_number}</span>
                                <span className="text-[10px] text-gray-500 truncate" title={`${empData?.job_title} - ${empData?.companies?.name}`}>
                                  {empData?.job_title?.substring(0,12)}.. - {empData?.companies?.name === 'Energya' || empData?.companies?.name === 'انيرجيا' ? 'إنرجيا' : empData?.companies?.name === 'Jawhara' || empData?.companies?.name === 'جواهر' ? 'جواهر' : 'مقاول'}
                                </span>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className={`text-xs font-black ${isNight ? 'text-indigo-600' : 'text-orange-600'}`} dir="ltr">{endTime}</span>
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">{otHrs} س</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-center align-middle">
                      {assign.status === 'PENDING' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto">قيد المراجعة</span>}
                      {assign.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto">معتمد</span>}
                      {assign.status === 'REJECTED' && (
                        <div>
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black block w-max mx-auto mb-1">مرفوض</span>
                          {assign.reason && <span className="text-[10px] font-bold text-gray-500 break-words" title={assign.reason}>السبب: {assign.reason}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        {assign.status === 'APPROVED' && (
                          <button onClick={() => handlePrint(assign)} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition shadow-sm" title="طباعة التكليف"><Printer size={16} /></button>
                        )}
                        {(assign.status === 'PENDING' && (userRole === 'DATA_ENTRY' || userRole === 'MANAGER')) && (
                          <button onClick={() => handleEdit(assign)} className="bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700 p-2 rounded-lg transition shadow-sm" title="تعديل"><Edit size={16} /></button>
                        )}
                        {((assign.status === 'PENDING' && userRole === 'DATA_ENTRY') || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
                          <button onClick={() => handleDelete(assign.id)} className="bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm" title="إلغاء التكليف"><Trash2 size={16} /></button>
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