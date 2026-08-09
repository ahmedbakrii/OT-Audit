'use client';

import { useEffect, useState, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, AlertCircle, Users, Calendar, Filter, Save, Trash2, Search, Eye, X, Printer,
  Building2, SunMoon, Briefcase, Edit, Activity, Timer, AlertTriangle, UserX, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useRouter } from 'next/navigation';

export default function AssignmentsPage() {
  const router = useRouter();

  const todayStr = new Date().toISOString().split('T')[0];

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [calculations, setCalculations] = useState<any[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => { setToast({ show: false, message: '', type: 'success' }); }, 4000);
  };

  const [departments, setDepartments] = useState<any[]>([]);

  // ==========================================
  // فلاتر الصفحة العلوية (Dashboard Filters)
  // ==========================================
  const [filterStartDate, setFilterStartDate] = useState(todayStr);
  const [filterEndDate, setFilterEndDate] = useState(todayStr);
  const [filterAdminDept, setFilterAdminDept] = useState('');

  // ==========================================
  // بيانات فورم الإدخال (Create/Edit Form)
  // ==========================================
  const [formDate, setFormDate] = useState(todayStr);
  const [formDept, setFormDept] = useState('');
  
  const [dayEndHour, setDayEndHour] = useState('20');
  const [dayEndMinute, setDayEndMinute] = useState('00');
  const [nightEndHour, setNightEndHour] = useState('08');
  const [nightEndMinute, setNightEndMinute] = useState('00');

  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmpNumbers, setSelectedEmpNumbers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // فلاتر الموظفين داخل الفورم
  const [searchEmp, setSearchEmp] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');

  const [printDate, setPrintDate] = useState(todayStr);
  const [viewAssignment, setViewAssignment] = useState<any | null>(null);

  const [stats, setStats] = useState({
    totalHours: 0,
    topDept: { name: '-', hours: 0 },
    topExcDept: { name: '-', count: 0 },
    topEmp: { name: '-', hours: 0 }
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    document.title = 'إدارة التكليفات | OT Audit';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }

    const user = JSON.parse(userStr);
    setUserRole(user.role);

    async function fetchUserDetails() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setFormDept(data.department_id);
      }
      fetchLookups(user.role, data?.department_id);
    }
    fetchUserDetails();
  }, [router]);

  useEffect(() => {
    if (userRole) {
      fetchPageData();
    }
  }, [filterStartDate, filterEndDate, filterAdminDept, userRole, userDeptId]);

  async function fetchLookups(role: string | null, deptId: string | null) {
    let query = supabase.from('departments').select('id, name');
    if (role !== 'ADMIN' && role !== 'FACTORY_MANAGER' && deptId) {
      query = query.eq('id', deptId);
    }
    const { data } = await query;
    if (data) setDepartments(data);
  }

  async function fetchPageData() {
    try {
      setLoading(true);
      const activeDeptId = (userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') ? filterAdminDept : userDeptId;

      let assignQuery = supabase.from('ot_assignments').select(`
          id, date, day_end_time, night_end_time, status, created_at, department_id, departments(name),
          ot_assignment_employees(emp_number, employees(name, job_title, companies(name), shifts(name)))
        `).gte('date', filterStartDate).lte('date', filterEndDate).order('date', { ascending: false });

      if (activeDeptId) assignQuery = assignQuery.eq('department_id', activeDeptId);

      let calcQuery = supabase.from('ot_calculations').select(`
          status, employees!inner(department_id, departments(name))
        `).gte('date', filterStartDate).lte('date', filterEndDate).eq('status', 'EXCEPTION');

      if (activeDeptId) calcQuery = calcQuery.eq('employees.department_id', activeDeptId);

      const [{ data: assignsData }, { data: calcsData }] = await Promise.all([assignQuery, calcQuery]);
      
      const fetchedAssignments = assignsData || [];
      setAssignments(fetchedAssignments);
      setCalculations(calcsData || []);
      setSelectedAssignments([]);

      let totalAssignedMins = 0;
      let deptMins: Record<string, number> = {};
      let empMins: Record<string, number> = {};

      fetchedAssignments.forEach(a => {
        const dName = (a as any).departments?.name || 'أخرى';
        (a as any).ot_assignment_employees?.forEach((e: any) => {
          const shiftName = e.employees?.shifts?.name || '';
          const isNight = shiftName.includes('ليل') || shiftName.includes('مسا');
          const basicEnd = isNight ? '04:00' : '16:00';
          const actualEnd = (isNight ? a.night_end_time : a.day_end_time)?.substring(0, 5) || '';

          const getMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          let diff = getMins(actualEnd) - getMins(basicEnd);
          if (diff < 0) diff += 24 * 60;

          totalAssignedMins += diff;
          deptMins[dName] = (deptMins[dName] || 0) + diff;

          const eName = e.employees?.name || e.emp_number;
          empMins[eName] = (empMins[eName] || 0) + diff;
        });
      });

      let topD = { name: '-', hours: 0 };
      Object.entries(deptMins).forEach(([name, mins]) => {
        if (mins > topD.hours * 60) topD = { name, hours: Math.round((mins / 60) * 10) / 10 };
      });

      let topE = { name: '-', hours: 0 };
      Object.entries(empMins).forEach(([name, mins]) => {
        if (mins > topE.hours * 60) topE = { name, hours: Math.round((mins / 60) * 10) / 10 };
      });

      let deptExc: Record<string, number> = {};
      (calcsData || []).forEach(c => {
        const dName = (c as any).employees?.departments?.name || 'أخرى';
        deptExc[dName] = (deptExc[dName] || 0) + 1;
      });

      let topExc = { name: '-', count: 0 };
      Object.entries(deptExc).forEach(([name, count]) => {
        if (count > topExc.count) topExc = { name, count };
      });

      setStats({
        totalHours: Math.round((totalAssignedMins / 60) * 10) / 10,
        topDept: topD,
        topEmp: topE,
        topExcDept: topExc
      });

      setChartData(Object.keys(deptMins).map(k => ({ name: k, value: Math.round((deptMins[k]/60)*10)/10 })));

    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  useEffect(() => {
    if (formDept) fetchEmployeesForForm();
    else { setAvailableEmployees([]); setSelectedEmpNumbers([]); }
  }, [formDept]);

  async function fetchEmployeesForForm() {
    try {
      const { data, error } = await supabase.from('employees').select(`emp_number, name, job_title, companies(name), shifts(name)`).eq('department_id', formDept);
      if (error) throw error;
      setAvailableEmployees(data || []);
      if (!editingAssignmentId) setSelectedEmpNumbers([]);
    } catch (error) { console.error(error); }
  }

  const uniqueCompanies = Array.from(new Set(availableEmployees.map((e: any) => e.companies?.name))).filter(Boolean);
  const uniqueShifts = Array.from(new Set(availableEmployees.map((e: any) => e.shifts?.name))).filter(Boolean);
  const uniqueJobTitles = Array.from(new Set(availableEmployees.map((e: any) => e.job_title))).filter(Boolean);

  const displayedEmployees = availableEmployees.filter(emp => {
    const matchSearch = emp.name?.includes(searchEmp) || emp.emp_number?.includes(searchEmp);
    const matchComp = filterCompany ? (emp as any).companies?.name === filterCompany : true;
    const matchShift = filterShift ? (emp as any).shifts?.name === filterShift : true;
    const matchJob = filterJobTitle ? emp.job_title === filterJobTitle : true;
    return matchSearch && matchComp && matchShift && matchJob;
  });

  const displayedAssignments = assignments;

  const handleSelectAllDisplayed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const displayedIds = displayedEmployees.map(emp => emp.emp_number);
    if (e.target.checked) {
      setSelectedEmpNumbers(Array.from(new Set([...selectedEmpNumbers, ...displayedIds])));
    } else {
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => !displayedIds.includes(id)));
    }
  };

  const handleSelectEmp = (empNumber: string) => {
    if (selectedEmpNumbers.includes(empNumber)) {
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => id !== empNumber));
    } else {
      setSelectedEmpNumbers([...selectedEmpNumbers, empNumber]);
    }
  };

  const handleCreateOrUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'FACTORY_MANAGER') return; 

    if (userRole === 'DATA_ENTRY' && formDate < todayStr) {
      return showToast('غير مسموح لمدخل البيانات إضافة أو تعديل تكليفات لتواريخ سابقة!', 'error');
    }

    if (selectedEmpNumbers.length === 0) {
      return showToast('يجب تحديد موظف واحد على الأقل!', 'error');
    }

    setIsSubmitting(true);

    try {
      if (editingAssignmentId) {
        await supabase
          .from('ot_assignments')
          .update({
            date: formDate,
            department_id: formDept,
            day_end_time: `${dayEndHour}:${dayEndMinute}:00`,
            night_end_time: `${nightEndHour}:${nightEndMinute}:00`
          })
          .eq('id', editingAssignmentId);

        await supabase.from('ot_assignment_employees').delete().eq('assignment_id', editingAssignmentId);

        const empRecords = selectedEmpNumbers.map(emp_number => ({
          assignment_id: editingAssignmentId,
          emp_number
        }));

        await supabase.from('ot_assignment_employees').insert(empRecords);
        showToast('تم تعديل التكليف بنجاح!', 'success');
        setEditingAssignmentId(null);

      } else {
        const { data: assignment, error: assignError } = await supabase
          .from('ot_assignments')
          .insert([{
            date: formDate,
            department_id: formDept,
            day_end_time: `${dayEndHour}:${dayEndMinute}:00`,
            night_end_time: `${nightEndHour}:${nightEndMinute}:00`,
            status: 'APPROVED'
          }])
          .select()
          .single();

        if (assignError) throw assignError;

        const empRecords = selectedEmpNumbers.map(emp_number => ({
          assignment_id: assignment.id,
          emp_number
        }));

        await supabase.from('ot_assignment_employees').insert(empRecords);
        showToast('تم اعتماد التكليف بنجاح!', 'success');
      }

      setSelectedEmpNumbers([]);
      fetchPageData();

    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء حفظ التكليف.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (assign: any) => {
    if (userRole === 'FACTORY_MANAGER') return;
    
    if (userRole === 'DATA_ENTRY' && assign.date < todayStr) {
      return showToast('غير مصرح لك بتعديل تكليفات الأيام السابقة.', 'error');
    }

    setEditingAssignmentId(assign.id);
    
    setFormDate(assign.date);
    setPrintDate(assign.date); 
    setFilterStartDate(assign.date);
    setFilterEndDate(assign.date);

    setFormDept(assign.department_id);

    if (assign.day_end_time) {
      const [dh, dm] = assign.day_end_time.split(':');
      setDayEndHour(dh);
      setDayEndMinute(dm);
    }

    if (assign.night_end_time) {
      const [nh, nm] = assign.night_end_time.split(':');
      setNightEndHour(nh);
      setNightEndMinute(nm);
    }

    const empIds = assign.ot_assignment_employees?.map((e: any) => e.emp_number) || [];
    setSelectedEmpNumbers(empIds);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingAssignmentId(null);
    setSelectedEmpNumbers([]);
    setFormDate(todayStr);
  };

  const handleSelectAssignment = (id: string) => {
    if (selectedAssignments.includes(id)) {
      setSelectedAssignments(selectedAssignments.filter(aId => aId !== id));
    } else {
      setSelectedAssignments([...selectedAssignments, id]);
    }
  };

  const handleSelectAllAssignments = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const selectable = displayedAssignments.filter(a => {
        if (userRole === 'DATA_ENTRY' && a.date < todayStr) return false;
        return true;
      }).map(a => a.id);
      setSelectedAssignments(selectable);
    } else {
      setSelectedAssignments([]);
    }
  };

  const handleBulkDelete = async () => {
    if (userRole === 'FACTORY_MANAGER' || selectedAssignments.length === 0) return;

    if (!confirm(`هل أنت متأكد من حذف ${selectedAssignments.length} تكليف بشكل نهائي؟`)) {
      return;
    }

    try {
      setLoading(true);
      await supabase.from('ot_assignments').delete().in('id', selectedAssignments);
      showToast('تم حذف التكليفات المحددة بنجاح.', 'success');
      fetchPageData();
    } catch (error) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (userRole === 'FACTORY_MANAGER') return; 
    if (!confirm('هل أنت متأكد من إلغاء هذا التكليف بالكامل؟')) return;

    try {
      await supabase.from('ot_assignments').delete().eq('id', id);
      showToast('تم إلغاء التكليف بنجاح.', 'success');
      fetchPageData();
    } catch (error) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  const preparePrintData = (assignmentsToPrint: any[], targetDate: string, targetDeptName: string) => {
    const employeeMap = new Map();

    assignmentsToPrint.forEach(a => {
      a.ot_assignment_employees?.forEach((emp: any) => {
        const shiftName = emp.employees?.shifts?.name || '';
        const isNight = shiftName.includes('ليل') || shiftName.includes('مسا');
        const isDay = !isNight;
        const basicEnd = isDay ? '16:00' : '04:00';
        const actualEnd = (isDay ? a.day_end_time : a.night_end_time)?.substring(0, 5) || '';

        const getMins = (t: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };

        let otDuration = getMins(actualEnd) - getMins(basicEnd);
        if (otDuration < 0) otDuration += 24 * 60;

        if (employeeMap.has(emp.emp_number)) {
          const existing = employeeMap.get(emp.emp_number);
          if (otDuration > existing.otDuration) {
            employeeMap.set(emp.emp_number, {
              ...emp,
              companyName: emp.employees?.companies?.name || 'أخرى',
              basicEnd,
              actualEnd,
              otDuration
            });
          }
        } else {
          employeeMap.set(emp.emp_number, {
            ...emp,
            companyName: emp.employees?.companies?.name || 'أخرى',
            basicEnd,
            actualEnd,
            otDuration
          });
        }
      });
    });

    const sortedEmployees = Array.from(employeeMap.values()).sort((a: any, b: any) => {
      if (a.companyName < b.companyName) return -1;
      if (a.companyName > b.companyName) return 1;
      return b.otDuration - a.otDuration;
    });

    setViewAssignment({
      date: targetDate,
      departmentName: targetDeptName,
      employees: sortedEmployees,
      isViewOnly: false
    });

    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handlePrintDaily = () => {
    const dailyAssignments = assignments.filter(a => a.date === printDate);
    if (dailyAssignments.length === 0) {
      return showToast('لا يوجد تكليفات مسجلة في هذا اليوم لطباعتها.', 'error');
    }
    const deptName = (userRole === 'MANAGER' || filterAdminDept) ? ((dailyAssignments[0] as any).departments?.name || '') : 'جميع إدارات المصنع';
    preparePrintData(dailyAssignments, printDate, deptName);
  };

  const isNightFilterActive = filterShift === '' || filterShift.includes('ليل') || filterShift.includes('مسا');
  const isDayFilterActive = filterShift === '' || (!filterShift.includes('ليل') && !filterShift.includes('مسا'));

  return (
    <div className="flex flex-col space-y-6 relative pb-10">

      {/* =====================================================
          OFFICIAL PRINT FORM
          ===================================================== */}
      {viewAssignment && !viewAssignment.isViewOnly && (
          <div className="assignment-print" dir="rtl">
            <table className="assignment-header">
              <tbody>
                <tr>
                  <td className="header-company">
                    <img src="/logo.png" alt="Logo" className="company-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="company-ar">Energya Steel Solutions</div>
                    <div className="company-dept">إدارة الموارد البشرية - شئون العاملين</div>
                  </td>
                  <td className="header-title">
                    <div className="title-en">Overtime Approval</div>
                    <div className="title-ar">نموذج تكليف عمل إضافي</div>
                  </td>
                  <td className="header-form">
                    <div>Form No:</div>
                    <div className="form-number">HHE-HR-FO-029</div>
                    <div>Issue A/1</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="assignment-info">
              <tbody>
                <tr>
                  <td className="info-left">
                    <span>Date</span><span dir="rtl">(التاريخ)</span> : <span className="info-value">{new Date(viewAssignment.date).toLocaleDateString('en-GB')}</span>
                  </td>
                  <td className="info-right">
                    <span>Day</span><span dir="rtl">(اليوم)</span> : <span className="info-value">{new Date(viewAssignment.date).toLocaleDateString('ar-EG', { weekday: 'long' })}</span>
                  </td>
                </tr>
                <tr>
                  <td className="info-left">
                    <span>Department</span><span dir="rtl">(الإدارة)</span> : <span className="info-value">{viewAssignment.departmentName || ''}</span>
                  </td>
                  <td className="info-right">
                    <span>Section</span><span dir="rtl">(القسم)</span> : <span className="info-value">{viewAssignment.departmentName || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="assignment-table">
              <colgroup>
                <col className="col-no" /><col className="col-id" /><col className="col-name" /><col className="col-title" /><col className="col-time" /><col className="col-time" />
              </colgroup>
              <thead>
                <tr>
                  <th>م</th><th><div>Emp. ID</div><div>رقم الوظيفي</div></th><th><div>Name</div><div>الإســــــم</div></th><th><div>Title</div><div>الوظيفة</div></th><th><div>From</div><div>من الساعة</div></th><th><div>To</div><div>إلى الساعة</div></th>
                </tr>
              </thead>
              <tbody>
                {viewAssignment.employees?.map((empRecord: any, idx: number) => (
                  <tr key={idx} className="break-inside-avoid">
                    <td>{idx + 1}</td><td>{empRecord.emp_number}</td><td className="employee-name">{empRecord.employees?.name}</td><td className="employee-job">{empRecord.employees?.job_title}</td><td dir="ltr">{empRecord.basicEnd}</td><td dir="ltr">{empRecord.actualEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="signature-table break-inside-avoid">
              <tbody>
                <tr>
                  <td><div className="signature-title"><div>Direct Manager</div><div dir="rtl">(الرئيس المباشر)</div></div><div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div><div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div></td>
                  <td><div className="signature-title"><div>Head of Dept.</div><div dir="rtl">(المسئول المهندس)</div></div><div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div><div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div></td>
                  <td><div className="signature-title"><div>Department Manager</div><div dir="rtl">(مدير الإدارة)</div></div><div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div><div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      {/* =====================================================
          TOP FILTERS (NEW)
          ===================================================== */}
      <div className="print:hidden bg-white p-5 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-[var(--color-navy-900)] flex items-center gap-2"><Filter size={20} className="text-[var(--color-navy-500)]" /> فلتر عرض التكليفات</h2>
        <div className="flex flex-wrap items-center gap-4">
          {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-1.5 px-3">
              <span className="text-sm font-bold text-blue-900">الإدارة:</span>
              <select value={filterAdminDept} onChange={(e) => setFilterAdminDept(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-blue-800">
                <option value="">كل الإدارات</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">من:</span>
            <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setPrintDate(e.target.value); }} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">إلى:</span>
            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
        </div>
      </div>

      {/* =====================================================
          DASHBOARD CARDS (SMART METRICS) - مخفية لمدخل البيانات
          ===================================================== */}
      {userRole !== 'DATA_ENTRY' && (
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-500 transform transition hover:-translate-y-1">
            <p className="text-gray-500 text-sm font-bold mb-1">إجمالي ساعات التكليفات</p>
            <div className="flex justify-between items-center mt-2">
              <h3 className="text-3xl font-black text-blue-600">{loading ? '...' : stats.totalHours} <span className="text-sm">ساعة</span></h3>
              <Timer size={28} className="text-blue-200" />
            </div>
          </div>

          {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
            <>
              <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-orange-500 transform transition hover:-translate-y-1">
                <p className="text-gray-500 text-sm font-bold mb-1">الإدارة الأعلى إضافي</p>
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <h3 className="text-xl font-black text-orange-600 truncate max-w-[120px]">{loading ? '...' : stats.topDept.name}</h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">{stats.topDept.hours} ساعة</p>
                  </div>
                  <Activity size={28} className="text-orange-200" />
                </div>
              </div>
              
              <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-red-500 transform transition hover:-translate-y-1">
                <p className="text-gray-500 text-sm font-bold mb-1">إدارة غير منضبطة (مخالفات)</p>
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <h3 className="text-xl font-black text-red-600 truncate max-w-[120px]">{loading ? '...' : stats.topExcDept.name}</h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">{stats.topExcDept.count} مخالفة بصمة</p>
                  </div>
                  <AlertTriangle size={28} className="text-red-200" />
                </div>
              </div>
            </>
          )}

          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-rose-600 transform transition hover:-translate-y-1">
            <p className="text-gray-500 text-sm font-bold mb-1">عامل شاذ (مراجعة الساعات)</p>
            <div className="flex justify-between items-center mt-2">
              <div>
                <h3 className="text-lg font-black text-rose-600 truncate max-w-[140px]">{loading ? '...' : stats.topEmp.name}</h3>
                <p className="text-xs font-bold text-gray-400 mt-1">مسجل {stats.topEmp.hours} ساعة</p>
              </div>
              <UserX size={28} className="text-rose-200" />
            </div>
          </div>
        </div>
      )}

      {/* رسم بياني لمدير المصنع والأدمن */}
      {(userRole === 'FACTORY_MANAGER' || userRole === 'ADMIN') && chartData.length > 0 && (
        <div className="print:hidden bg-white p-6 rounded-xl shadow-sm border mb-4">
          <h3 className="font-bold text-[var(--color-navy-900)] mb-4 border-b pb-2 flex items-center gap-2"><BarChart3 size={18} /> توزيع الساعات المطلوبة على الإدارات</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#9ca3af' }} />
                <RechartsTooltip cursor={{fill: '#fef2f2'}} contentStyle={{ borderRadius: '10px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =====================================================
          MAIN SCREEN (FORM & TABLE)
          ===================================================== */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-12 gap-6">

        {userRole !== 'FACTORY_MANAGER' && (
          <div className={`lg:col-span-4 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${editingAssignmentId ? 'border-2 border-orange-400 shadow-orange-100' : ''}`}>
            <div className={`p-4 border-b flex justify-between items-center font-semibold ${editingAssignmentId ? 'bg-orange-50 text-orange-900' : 'bg-gray-50 text-[var(--color-navy-900)]'}`}>
              <div className="flex items-center gap-2">
                {editingAssignmentId ? <Edit size={18} /> : <Filter size={18} />}
                {editingAssignmentId ? 'تعديل التكليف' : 'إنشاء تكليف مجمع'}
              </div>
              {editingAssignmentId && (
                <button onClick={cancelEditing} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition">إلغاء التعديل</button>
              )}
            </div>

            <form onSubmit={handleCreateOrUpdateAssignment} className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التكليف *</label>
                <div className="relative">
                  <Calendar size={18} className="absolute right-3 top-2.5 text-gray-400" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormDate(val);
                      setPrintDate(val); 
                      setFilterStartDate(val);
                      setFilterEndDate(val);
                    }}
                    className="w-full border rounded-lg pl-3 pr-10 py-2 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)]"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">القسم * {userRole !== 'ADMIN' && ' (إدارتك فقط)'}</label>
                <select value={formDept} onChange={(e) => setFormDept(e.target.value)} disabled={userRole !== 'ADMIN'} className="w-full border rounded-lg p-2 outline-none disabled:bg-gray-100 disabled:font-bold" required>
                  <option value="" disabled>اختر...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {formDept && (
                <div className="mt-2 flex-1 flex flex-col border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <div className="relative">
                      <Building2 size={14} className="absolute right-2 top-2.5 text-blue-500" />
                      <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="w-full border-blue-200 rounded-lg pl-2 pr-7 py-2 text-xs outline-none font-bold text-blue-900 bg-white"><option value="">كل الشركات</option>{uniqueCompanies.map((c: any) => <option key={c} value={c as string}>{c as string}</option>)}</select>
                    </div>
                    <div className="relative">
                      <SunMoon size={14} className="absolute right-2 top-2.5 text-blue-500" />
                      <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="w-full border-blue-200 rounded-lg pl-2 pr-7 py-2 text-xs outline-none font-bold text-blue-900 bg-white"><option value="">كل الورديات</option>{uniqueShifts.map((s: any) => <option key={s} value={s as string}>{s as string}</option>)}</select>
                    </div>
                    <div className="relative md:col-span-2">
                      <Briefcase size={14} className="absolute right-2 top-2.5 text-blue-500" />
                      <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="w-full border-blue-200 rounded-lg pl-2 pr-7 py-2 text-xs outline-none font-bold text-blue-900 bg-white"><option value="">كل الوظائف</option>{uniqueJobTitles.map((j: any) => <option key={j} value={j as string}>{j as string}</option>)}</select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {(filterShift === '' || (!filterShift.includes('ليل') && !filterShift.includes('مسا'))) && (
                      <div className="p-3 rounded-lg border bg-orange-50 border-orange-200 flex justify-between items-center">
                        <label className="block text-xs font-bold text-orange-700">☀️ انصراف النهار</label>
                        <div className="flex gap-1 dir-ltr">
                          <select value={dayEndMinute} onChange={(e) => setDayEndMinute(e.target.value)} className="border border-orange-300 rounded p-1 text-sm outline-none text-center font-bold bg-white"><option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option></select><span className="self-center font-bold text-orange-500">:</span><select value={dayEndHour} onChange={(e) => setDayEndHour(e.target.value)} className="border border-orange-300 rounded p-1 text-sm outline-none text-center font-bold bg-white">{Array.from({ length: 24 }).map((_, i) => { const h = i.toString().padStart(2, '0'); return <option key={h} value={h}>{h}</option>; })}</select>
                        </div>
                      </div>
                    )}
                    {(filterShift === '' || filterShift.includes('ليل') || filterShift.includes('مسا')) && (
                      <div className="p-3 rounded-lg border bg-indigo-50 border-indigo-200 flex justify-between items-center">
                        <label className="block text-xs font-bold text-indigo-700">🌙 انصراف الليل</label>
                        <div className="flex gap-1 dir-ltr">
                          <select value={nightEndMinute} onChange={(e) => setNightEndMinute(e.target.value)} className="border border-indigo-300 rounded p-1 text-sm outline-none text-center font-bold bg-white"><option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option></select><span className="self-center font-bold text-indigo-500">:</span><select value={nightEndHour} onChange={(e) => setNightEndHour(e.target.value)} className="border border-indigo-300 rounded p-1 text-sm outline-none text-center font-bold bg-white">{Array.from({ length: 24 }).map((_, i) => { const h = i.toString().padStart(2, '0'); return <option key={h} value={h}>{h}</option>; })}</select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-sm font-bold text-[var(--color-navy-900)] mb-3 flex items-center justify-between">
                    <span>الموظفين ({selectedEmpNumbers.length})</span>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-navy-500)] cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-[var(--color-navy-500)]" checked={displayedEmployees.length > 0 && displayedEmployees.every(emp => selectedEmpNumbers.includes(emp.emp_number))} onChange={handleSelectAllDisplayed} /> تحديد المعروض
                    </label>
                  </div>

                  <div className="relative mb-3">
                    <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
                    <input type="text" placeholder="بحث بالاسم أو الرقم..." value={searchEmp} onChange={(e) => setSearchEmp(e.target.value)} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm outline-none" />
                  </div>

                  <div className="flex-1 max-h-56 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1">
                    {displayedEmployees.length === 0 ? (
                      <div className="text-center text-sm text-gray-500 py-4">لا يوجد موظفين.</div>
                    ) : (
                      displayedEmployees.map(emp => (
                        <label key={emp.emp_number} className="flex items-center gap-3 p-2 bg-white hover:bg-blue-50 rounded border cursor-pointer transition shadow-sm">
                          <input type="checkbox" className="w-4 h-4 accent-[var(--color-navy-500)]" checked={selectedEmpNumbers.includes(emp.emp_number)} onChange={() => handleSelectEmp(emp.emp_number)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-gray-800 truncate">{emp.name}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${emp.shifts?.name?.includes('نهار') || emp.shifts?.name?.includes('صباح') ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {emp.shifts?.name || '-'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 truncate">{emp.job_title}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={isSubmitting || selectedEmpNumbers.length === 0 || (userRole === 'DATA_ENTRY' && formDate < todayStr)} className={`w-full text-white py-3 rounded-lg mt-4 transition font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${editingAssignmentId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                <Save size={18} /> {isSubmitting ? 'جاري الحفظ...' : (editingAssignmentId ? 'حفظ التعديلات' : 'اعتماد التكليف')}
              </button>
            </form>
          </div>
        )}

        <div className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${userRole === 'FACTORY_MANAGER' ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
          <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-navy-900)]">
              <Users size={18} /> سجل التكليفات للفترة المحددة
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {userRole !== 'FACTORY_MANAGER' && selectedAssignments.length > 0 && (
                <button onClick={handleBulkDelete} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm border border-red-200">
                  <Trash2 size={16} /> حذف ({selectedAssignments.length})
                </button>
              )}

              <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                {userRole !== 'FACTORY_MANAGER' && (
                  <>
                    <span className="text-sm font-bold text-blue-900">تاريخ الطباعة:</span>
                    <input type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} className="border rounded p-1 text-sm font-bold outline-none" />
                  </>
                )}
                <button onClick={handlePrintDaily} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm">
                  <Printer size={16} /> طباعة {userRole === 'FACTORY_MANAGER' ? 'التقرير المجمع' : 'مجمعة'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[800px]">
            <table className="w-full text-right border-collapse">
              <thead className="bg-[var(--color-neutral-100)] sticky top-0 shadow-sm z-10">
                <tr className="border-b text-[var(--color-navy-800)] text-sm">
                  {userRole !== 'FACTORY_MANAGER' && (
                    <th className="p-3 text-center w-8">
                      <input type="checkbox" className="w-4 h-4 accent-red-500 cursor-pointer" checked={selectedAssignments.length === displayedAssignments.length && displayedAssignments.length > 0} onChange={handleSelectAllAssignments} />
                    </th>
                  )}
                  <th className="p-3 font-semibold whitespace-nowrap">التاريخ والقسم</th>
                  <th className="p-3 font-semibold text-center w-24">الانصراف الفعلي</th>
                  <th className="p-3 font-semibold w-1/2">الموظفين المكلفين</th>
                  <th className="p-3 font-semibold text-center w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={userRole === 'FACTORY_MANAGER' ? 4 : 5} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr>
                ) : displayedAssignments.length === 0 ? (
                  <tr><td colSpan={userRole === 'FACTORY_MANAGER' ? 4 : 5} className="p-8 text-center text-gray-500 font-bold">لا يوجد تكليفات مسجلة في هذه الفترة.</td></tr>
                ) : (
                  displayedAssignments.map(assign => {
                    const isEditableByDataEntry = userRole === 'DATA_ENTRY' ? assign.date >= todayStr : true;
                    const canEditDelete = userRole !== 'FACTORY_MANAGER' && isEditableByDataEntry;

                    return (
                      <tr key={assign.id} className={`border-b transition ${selectedAssignments.includes(assign.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        {userRole !== 'FACTORY_MANAGER' && (
                          <td className="p-3 text-center align-top pt-4">
                            {canEditDelete && (
                              <input type="checkbox" className="w-4 h-4 accent-red-500 cursor-pointer" checked={selectedAssignments.includes(assign.id)} onChange={() => handleSelectAssignment(assign.id)} />
                            )}
                          </td>
                        )}
                        <td className="p-3 align-top pt-4">
                          <div className="font-bold text-gray-800 text-sm whitespace-nowrap">
                            {new Date(assign.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-blue-600 font-bold mt-1">{(assign as any).departments?.name}</div>
                        </td>
                        <td className="p-3 text-center align-top pt-4">
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 w-full text-center">
                              ☀️ {assign.day_end_time?.substring(0, 5)}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-full text-center">
                              🌙 {assign.night_end_time?.substring(0, 5)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {(assign as any).ot_assignment_employees?.map((emp: any, i: number) => (
                              <span key={i} className="bg-white border text-gray-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                {emp.employees?.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center align-top pt-4">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {canEditDelete && (
                              <button onClick={() => startEditing(assign)} className="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 p-1.5 rounded transition" title="تعديل التكليف">
                                <Edit size={16} />
                              </button>
                            )}
                            <button onClick={() => { setViewAssignment({ ...assign, departmentName: (assign as any).departments?.name, isViewOnly: true }); }} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded transition" title="معاينة التكليف">
                              <Eye size={16} />
                            </button>
                            {canEditDelete && (
                              <button onClick={() => handleDeleteAssignment(assign.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition" title="إلغاء التكليف">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =====================================================
          PREVIEW MODAL
          ===================================================== */}
      {viewAssignment && viewAssignment.isViewOnly && (
        <div className="print:hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <h2 className="text-xl font-bold">معاينة التكليف</h2>
              <button onClick={() => setViewAssignment(null)} className="p-2 rounded-full hover:bg-gray-200"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="w-full text-right text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border-b">الرقم</th>
                    <th className="p-2 border-b">الاسم</th>
                    <th className="p-2 border-b">الوظيفة</th>
                  </tr>
                </thead>
                <tbody>
                  {viewAssignment.ot_assignment_employees?.map((emp: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{emp.emp_number}</td>
                      <td className="p-2 font-bold">{emp.employees?.name}</td>
                      <td className="p-2 text-xs">{emp.employees?.job_title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PRINT CSS
          ===================================================== */}
      <style jsx global>{`
        @page { size: A4 portrait; margin: 0; }
        .assignment-print { display: none; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; width: 210mm; min-height: 297mm; background: #ffffff !important; }
          body * { visibility: hidden !important; }
          .assignment-print, .assignment-print * { visibility: visible !important; }
          .assignment-print {
            display: block !important; position: absolute; left: 0; top: 0; width: 210mm; min-height: 297mm; 
            box-sizing: border-box; padding: 10mm 10mm 8mm 10mm; margin: 0; background: white; color: black;
            overflow: visible; font-family: "Times New Roman", Times, serif; font-size: 10pt; direction: rtl;
          }
          .assignment-header { width: 190mm; height: 27mm; margin: 0; border-collapse: collapse; table-layout: fixed; direction: ltr; }
          .assignment-header td { border: 0.35mm solid #000; padding: 1.5mm; vertical-align: middle; color: #000; box-sizing: border-box; }
          .header-company { width: 62mm; text-align: center; direction: rtl; }
          .company-logo { width: 48mm; height: 9mm; object-fit: contain; display: block; margin: 0 auto 1mm auto; }
          .company-ar { font-size: 8pt; font-weight: bold; line-height: 1.1; white-space: nowrap; }
          .company-dept { font-size: 6.5pt; font-weight: bold; line-height: 1.1; white-space: nowrap; }
          .header-title { width: 88mm; text-align: center; direction: ltr; }
          .title-en { font-size: 17pt; font-weight: bold; line-height: 1.1; margin-bottom: 2mm; }
          .title-ar { font-size: 13pt; font-weight: bold; line-height: 1.1; direction: rtl; }
          .header-form { width: 40mm; text-align: center; direction: ltr; font-size: 9.5pt; line-height: 1.45; }
          .form-number { font-weight: bold; font-size: 10pt; }
          .assignment-info { width: 190mm; margin-top: 4mm; border-collapse: collapse; table-layout: fixed; direction: ltr; }
          .assignment-info td { width: 50%; height: 9mm; padding: 0 2mm; vertical-align: middle; border: none; font-size: 10pt; white-space: nowrap; color: #000; }
          .info-left { text-align: left; }
          .info-right { text-align: right; }
          .info-value { font-weight: bold; margin-left: 2mm; margin-right: 2mm; }
          .assignment-table { width: 190mm; margin-top: 3mm; margin-left: 0; border-collapse: collapse; table-layout: fixed; direction: ltr; font-size: 10pt; color: #000; }
          .assignment-table th, .assignment-table td { border: 0.35mm solid #000; padding: 0; box-sizing: border-box; text-align: center; vertical-align: middle; color: #000; }
          .assignment-table thead th { height: 18mm; font-size: 9.5pt; font-weight: bold; line-height: 1.15; }
          .assignment-table thead th div { line-height: 1.2; }
          .assignment-table thead th div:first-child { margin-bottom: 1mm; }
          .assignment-table tbody tr { height: 7.3mm; page-break-inside: avoid; }
          .assignment-table tbody td { height: 7.3mm; font-size: 10pt; line-height: 1; white-space: nowrap; }
          .assignment-table .col-no { width: 12mm; }
          .assignment-table .col-id { width: 29mm; }
          .assignment-table .col-name { width: 58mm; }
          .assignment-table .col-title { width: 35mm; }
          .assignment-table .col-time { width: 28mm; }
          .employee-name { direction: rtl; text-align: right !important; padding-left: 2mm !important; padding-right: 2mm !important; font-weight: bold; overflow: hidden; }
          .employee-job { direction: rtl; text-align: center; overflow: hidden; }
          .signature-table { width: 190mm; margin-top: 10mm; border-collapse: collapse; table-layout: fixed; direction: ltr; }
          .signature-table td { width: 33.333%; border: none; padding: 0 2mm; vertical-align: top; text-align: center; color: #000; font-size: 9.5pt; font-weight: bold; }
          .signature-title { line-height: 1.3; margin-bottom: 3mm; white-space: nowrap; }
          .signature-name { line-height: 1.3; margin-bottom: 7mm; white-space: nowrap; }
          .signature-line { line-height: 1.3; white-space: nowrap; }
          .assignment-header, .assignment-info, .assignment-table, .signature-table { page-break-inside: avoid; }
          .assignment-table tr { page-break-inside: avoid; page-break-after: auto; }
          *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}