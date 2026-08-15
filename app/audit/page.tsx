'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Filter, FileWarning, CheckCircle, Clock, Search, XCircle, CheckSquare, Loader2 } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import ForbiddenOverlay from '@/components/ForbiddenOverlay';

function AuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [calculations, setCalculations] = useState<any[]>([]);
  const [selectedConflicts, setSelectedConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const hasRunRef = useRef(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'CONFLICT');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterCompany, setFilterCompany] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    document.title = 'التدقيق والاعتماد | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);    
    setUserRole(user.role);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) setUserDeptId(data.department_id);
      
      hasRunRef.current = false; 
      if (user.role !== 'DATA_ENTRY') {
        autoRunAuditEngine(user.role, data?.department_id);
      } else {
        setLoading(false);
      }
    }
    initUser();
  }, [selectedMonth, selectedYear, router]);

  async function fetchCalculations(role: string | null, deptId: string | null) {
    try {
      let query = supabase.from('ot_calculations')
        .select(`*, employees!inner(name, job_title, department_id, companies(name), shifts(name))`)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('date', { ascending: false });

      if (role === 'MANAGER' && deptId) {
        query = query.eq('employees.department_id', deptId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCalculations(data || []);
      setSelectedConflicts([]);
    } catch (error: any) {
      showToast('حدث خطأ أثناء تحميل البيانات.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const getMins = (timeStr: string | null) => {
    if (!timeStr) return 0;
    if (timeStr.includes('T') && timeStr.includes('Z')) {
        const d = new Date(timeStr);
        const saudiTime = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
        return saudiTime.getHours() * 60 + saudiTime.getMinutes();
    }
    const timePart = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr.substring(0, 5);
    if (!timePart || !timePart.includes(':')) return 0;
    const [h, m] = timePart.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const formatHM = (decimalHrs: number) => {
    if (!decimalHrs || decimalHrs <= 0) return '0';
    const totalMins = Math.round(decimalHrs * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m} دقيقة`;
    if (m === 0) return `${h} ساعة`;
    return `${h} س و ${m} د`;
  };

  const formatDiffHM = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m} دقيقة`;
    if (m === 0) return `${h} ساعة`;
    return `${h} س و ${m} د`;
  };

  // 🔴 دالة التقريب المحاسبية الخاصة بالاعتماد النهائي (التقريب من الدقيقة 45)
  const roundToCustomHour = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    return m >= 45 ? h + 1 : h;
  };

  const autoRunAuditEngine = async (role: string | null, deptId: string | null) => {
    if (role !== 'ADMIN' && role !== 'MANAGER') {
        setLoading(false);
        return;
    }
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    setLoading(true);

    try {
      let deleteQuery = supabase.from('ot_calculations')
          .delete()
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .neq('status', 'RESOLVED');

      if (role === 'MANAGER' && deptId) {
        const { data: deptEmps } = await supabase.from('employees').select('emp_number').eq('department_id', deptId);
        const empNumbers = deptEmps?.map(e => e.emp_number) || [];
        if(empNumbers.length > 0) deleteQuery = deleteQuery.in('emp_number', empNumbers);
      }
      await deleteQuery;

      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let assignQuery = supabase.from('ot_assignments').select(`date, day_end_time, night_end_time, department_id, ot_assignment_employees(emp_number, ot_end_time, shift_snapshot, employees!inner(shifts(name), companies(name), department_id))`).gte('date', startDate).lte('date', endDate);
      if (role === 'MANAGER' && deptId) assignQuery = assignQuery.eq('department_id', deptId);
      const { data: rawAssignments } = await assignQuery;

      let attendQuery = supabase.from('attendance_records').select(`emp_number, date, first_in, last_out, employees!inner(department_id)`).gte('date', startDate).lte('date', endDate);
      if (role === 'MANAGER' && deptId) attendQuery = attendQuery.eq('employees.department_id', deptId);
      const { data: attendances } = await attendQuery;

      let resolvedQuery = supabase.from('ot_calculations').select('emp_number, date').eq('month', selectedMonth).eq('year', selectedYear).eq('status', 'RESOLVED');
      const { data: resolvedData } = await resolvedQuery;
      
      const resolvedSet = new Set(resolvedData?.map(r => `${r.emp_number}_${r.date}`) || []);
      const processedSet = new Set(); 

      const auditResults: any[] = [];

      rawAssignments?.forEach(assign => { 
        assign.ot_assignment_employees.forEach((emp: any) => { 
          
          const uniqueKey = `${emp.emp_number}_${assign.date}`;
          if (resolvedSet.has(uniqueKey) || processedSet.has(uniqueKey)) return;
          processedSet.add(uniqueKey);

          const shift = emp.shift_snapshot || emp.employees?.shifts?.name || '';
          const companyName = emp.employees?.companies?.name || '';
          
          const isNight = shift.includes('ليل') || shift.includes('مسائي') || shift.toLowerCase().includes('night');
          const isContractor = companyName.includes('مقاول') || companyName.toLowerCase().includes('contractor');
          const isFriday = new Date(assign.date + 'T12:00:00Z').getDay() === 5; 

          const shiftStartMins = isNight ? 19 * 60 : 7 * 60;
          const basicEndMins = isNight ? 4 * 60 : 16 * 60;
          const assignEndStr = emp.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5) || '';
          const assignEndMins = getMins(assignEndStr);

          let assignedOTHours = 0;
          
          if (isContractor || isFriday) {
              let cAssignDiff = assignEndMins - shiftStartMins;
              if (cAssignDiff < 0) cAssignDiff += 24 * 60;
              let breakMins = (!isNight && isFriday) ? 120 : 60;
              assignedOTHours = Math.max(0, cAssignDiff - breakMins) / 60;
          } else {
              let nAssignDiff = assignEndMins - basicEndMins;
              if (nAssignDiff < -360) nAssignDiff += 24 * 60;
              assignedOTHours = Math.max(0, nAssignDiff) / 60;
          }

          const attendance = attendances?.find(a => String(a.emp_number) === String(emp.emp_number) && a.date === assign.date);
          
          let status = 'MATCHED';
          let exceptionType = 'سليم (مطابق)';
          let finalApprovedMins = assignedOTHours * 60;
          let attendedOTHours = 0;

          if (!attendance || (!attendance.last_out && !attendance.first_in)) {
            status = 'CONFLICT'; exceptionType = 'غياب / لم يسجل بصمات'; finalApprovedMins = 0;
          } else if (!attendance.last_out) {
            status = 'CONFLICT'; exceptionType = 'بدون بصمة انصراف'; finalApprovedMins = 0;
          } else if (!attendance.first_in) {
            status = 'CONFLICT'; exceptionType = 'بدون بصمة دخول'; finalApprovedMins = 0;
          } else {
            let inMins = getMins(attendance.first_in);
            let outMins = getMins(attendance.last_out);

            if (isContractor || isFriday) {
                if (!isNight && inMins < 7 * 60) inMins = 7 * 60;
                else if (isNight && inMins >= 12 * 60 && inMins < 19 * 60) inMins = 19 * 60;

                let cAttendDiff = outMins - inMins;
                if (cAttendDiff < 0) cAttendDiff += 24 * 60;

                let breakMins = (!isNight && isFriday) ? 120 : 60;
                attendedOTHours = Math.max(0, cAttendDiff - breakMins) / 60;
            } else {
                let nAttendDiff = outMins - basicEndMins;
                if (nAttendDiff < -360) nAttendDiff += 24 * 60;
                attendedOTHours = Math.max(0, nAttendDiff) / 60;
            }

            const diffMins = Math.round((assignedOTHours - attendedOTHours) * 60);

            if (diffMins > 15) { 
              status = 'CONFLICT'; exceptionType = `انصراف مبكر بـ ${formatDiffHM(diffMins)}`; finalApprovedMins = 0;
            } else if (diffMins < -15) { 
              status = 'CONFLICT'; exceptionType = `تجاوز التكليف بـ ${formatDiffHM(Math.abs(diffMins))}`; finalApprovedMins = 0;
            } else { 
              status = 'MATCHED'; exceptionType = 'سليم (ضمن السماحية)'; finalApprovedMins = assignedOTHours * 60;
            }
          }

          // 🔴 تطبيق دالة التقريب على الساعات المعتمدة أوتوماتيكياً
          const finalRoundedHours = status === 'MATCHED' ? roundToCustomHour(finalApprovedMins) : 0;

          auditResults.push({
            emp_number: emp.emp_number, date: assign.date, month: selectedMonth, year: selectedYear,
            timesheet_hours: Math.round(assignedOTHours * 100) / 100, 
            attendance_in: attendance?.first_in || null, attendance_out: attendance?.last_out || null,
            assigned_end_time: assignEndStr, 
            final_approved_hours: finalRoundedHours, 
            exception_type: exceptionType, status: status
          });
        }); 
      });

      if(auditResults.length > 0) {
        const { error: insertError } = await supabase.from('ot_calculations').insert(auditResults);
        if (insertError) throw insertError;
      }
      
      await fetchCalculations(role, deptId);

    } catch (error) { 
        console.error(error); 
        showToast('حدث خطأ أثناء فحص البيانات آلياً.', 'error'); 
        setLoading(false);
    }
  };

  const handleSelectConflict = (id: string) => {
    if (selectedConflicts.includes(id)) setSelectedConflicts(selectedConflicts.filter(c => c !== id));
    else setSelectedConflicts([...selectedConflicts, id]);
  };

  const resolveConflicts = async (ids: string[], choice: 'ATTENDANCE' | 'ASSIGNMENT') => {
    try {
      const recordsToUpdate = calculations.filter(c => ids.includes(c.id));
      
      for (const record of recordsToUpdate) {
        let approvedMins = 0;

        if (choice === 'ASSIGNMENT') {
          // جلب عدد الدقائق للتكليف
          approvedMins = Math.round(record.timesheet_hours * 60);
        } else {
          if (record.attendance_in && record.attendance_out) {
            const shiftName = record.employees?.shifts?.name || '';
            const companyName = record.employees?.companies?.name || '';
            const isNight = shiftName.includes('ليل') || shiftName.includes('مسائي') || shiftName.toLowerCase().includes('night');
            const isContractor = companyName.includes('مقاول') || companyName.toLowerCase().includes('contractor');
            const isFriday = new Date(record.date + 'T12:00:00Z').getDay() === 5;
            const basicEndMins = isNight ? 4 * 60 : 16 * 60;

            let inMins = getMins(record.attendance_in);
            let outMins = getMins(record.attendance_out);

            let attendedOTMins = 0;
            if (isContractor || isFriday) {
                if (!isNight && inMins < 7 * 60) inMins = 7 * 60;
                else if (isNight && inMins >= 12 * 60 && inMins < 19 * 60) inMins = 19 * 60;

                let cAttendDiff = outMins - inMins;
                if (cAttendDiff < 0) cAttendDiff += 24 * 60;

                let breakMins = (!isNight && isFriday) ? 120 : 60;
                attendedOTMins = Math.max(0, cAttendDiff - breakMins);
            } else {
                let nAttendDiff = outMins - basicEndMins;
                if (nAttendDiff < -360) nAttendDiff += 24 * 60;
                attendedOTMins = Math.max(0, nAttendDiff);
            }
            approvedMins = attendedOTMins;
          } else {
            approvedMins = 0;
          }
        }

        // 🔴 تطبيق دالة التقريب على الساعات عند الحل اليدوي من المدير
        const finalRoundedHours = roundToCustomHour(approvedMins);

        await supabase.from('ot_calculations').update({
          status: 'RESOLVED',
          final_approved_hours: finalRoundedHours,
          exception_type: `تم الحل - اعتُمد ${choice === 'ASSIGNMENT' ? 'التكليف' : 'البصمة'}`
        }).eq('id', record.id);
      }

      showToast('تم حل التعارض واعتماد الساعات بنجاح.', 'success');
      setSelectedConflicts([]);
      fetchCalculations(userRole, userDeptId);
    } catch (error) {
      showToast('حدث خطأ أثناء الاعتماد.', 'error');
    }
  };

  const uniqueCompanies = Array.from(new Set(calculations.map(c => c.employees?.companies?.name))).filter(Boolean);

  const deduplicatedCalculations: any[] = [];
  const seenIds = new Set();
  calculations.forEach(c => {
    const k = `${c.emp_number}_${c.date}`;
    if (!seenIds.has(k)) {
        seenIds.add(k);
        deduplicatedCalculations.push(c);
    }
  });

  const displayedCalculations = deduplicatedCalculations
    .filter(c => {
      const matchStatus = filterStatus === 'ALL' || c.status === filterStatus || (filterStatus === 'CONFLICT' && c.status === 'RESOLVED'); 
      const matchSearch = (c.employees?.name || '').includes(searchQuery) || (c.emp_number || '').includes(searchQuery);
      const matchCompany = filterCompany === '' || c.employees?.companies?.name === filterCompany;
      return matchStatus && matchSearch && matchCompany;
    })
    .sort((a, b) => {
      const nameCompare = (a.employees?.name || '').localeCompare(b.employees?.name || '', 'ar');
      if (nameCompare !== 0) return nameCompare;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const extractTimeForDisplay = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="relative w-full min-h-screen">
      
      {userRole === 'DATA_ENTRY' && (
        <ForbiddenOverlay userDeptId={userDeptId} />
      )}

      <div className={`flex flex-col space-y-6 pb-10 transition-all duration-500 ${userRole === 'DATA_ENTRY' ? 'blur-[12px] opacity-30 pointer-events-none select-none grayscale-[50%]' : 'animate-in fade-in'}`}>
        
        {toast.show && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">لوحة المطابقة والاعتماد</h1>
            <p className="text-gray-500 text-sm mt-1">يتم جلب التعارضات بين البصمة والتكاليف بشكل <span className="font-bold text-green-600">تلقائي وفوري</span>.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">شهر:</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="border border-gray-300 rounded-md p-1.5 outline-none font-bold bg-white text-blue-800">
                {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">سنة:</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="border border-gray-300 rounded-md p-1.5 outline-none font-bold bg-white text-blue-800">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            {loading && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md font-bold text-sm">
                  <Loader2 size={16} className="animate-spin" /> جاري التحديث...
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-4 border">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="بحث باسم الموظف أو الرقم..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full border border-gray-300 rounded-lg pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-700" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-700 bg-orange-50 text-orange-900 border-orange-200">
            <option value="CONFLICT">عرض التعارضات فقط (تتطلب تدخل)</option>
            <option value="ALL">عرض كل السجلات</option>
            <option value="MATCHED">عرض السليم والمطابق فقط</option>
          </select>
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-bold text-gray-700">
            <option value="">كل الشركات</option>
            {uniqueCompanies.map((c: any) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {selectedConflicts.length > 0 && userRole !== 'FACTORY_MANAGER' && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 font-bold text-orange-800">
              <CheckSquare size={20} /> تم تحديد ({selectedConflicts.length}) تعارضات
            </div>
            <div className="flex gap-3">
              <button onClick={() => resolveConflicts(selectedConflicts, 'ASSIGNMENT')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm text-sm">اعتماد التكليف للمحدد</button>
              <button onClick={() => resolveConflicts(selectedConflicts, 'ATTENDANCE')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm text-sm">اعتماد البصمة للمحدد</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm whitespace-nowrap">
                  {userRole !== 'FACTORY_MANAGER' && <th className="p-4 w-12 text-center"></th>}
                  <th className="p-4 font-bold">التاريخ والموظف</th>
                  <th className="p-4 font-bold text-center border-r bg-gray-50 text-indigo-800">ساعات الأوفر تايم (تكليف)</th>
                  <th className="p-4 font-bold text-center border-l bg-gray-50 text-emerald-800">الانصراف (من البصمة)</th>
                  <th className="p-4 font-bold text-center">حالة المطابقة</th>
                  <th className="p-4 font-black text-center bg-gray-200">القرار المعتمد النهائي</th>
                </tr>
              </thead>
              <tbody>
                {loading && calculations.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-bold">جاري الفحص التلقائي وتحميل البيانات...</td></tr> : 
                 displayedCalculations.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-bold">لا يوجد بيانات تطابق الفلاتر. الأداء ممتاز!</td></tr> :
                 displayedCalculations.map((calc, idx) => (
                    <tr key={idx} className={`border-b transition whitespace-nowrap ${calc.status === 'CONFLICT' ? 'bg-red-50/30' : 'hover:bg-gray-50'}`}>
                      {userRole !== 'FACTORY_MANAGER' && (
                        <td className="p-4 text-center">
                          {calc.status === 'CONFLICT' && (
                            <input type="checkbox" className="w-4 h-4 cursor-pointer accent-orange-500" checked={selectedConflicts.includes(calc.id)} onChange={() => handleSelectConflict(calc.id)} />
                          )}
                        </td>
                      )}
                      <td className="p-3">
                        <div className="text-sm font-bold text-gray-500 mb-1">{new Date(calc.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                        <div className="font-black text-[var(--color-navy-800)] text-sm">{calc.employees?.name}</div>
                        <div className="text-xs font-bold text-gray-500 mt-1">{calc.emp_number} - {calc.employees?.companies?.name} <span className="mr-2 text-indigo-500">({calc.employees?.shifts?.name})</span></div>
                      </td>
                      <td className="p-3 text-center border-r bg-gray-50">
                        <div className="font-black text-xl text-indigo-700">{formatHM(calc.timesheet_hours)}</div>
                        <div className="text-xs font-bold text-gray-500 mt-1">مكلف لـ {calc.assigned_end_time}</div>
                      </td>
                      <td className="p-3 text-center border-l bg-gray-50">
                        {calc.attendance_out || calc.attendance_in ? 
                          <div className="flex flex-col items-center">
                            {calc.attendance_out ? (
                              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg dir-ltr inline-block border border-emerald-200 shadow-sm mb-1">
                                {extractTimeForDisplay(calc.attendance_out)}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg dir-ltr inline-block border border-red-200 shadow-sm mb-1">
                                بدون بصمة انصراف
                              </span>
                            )}
                            {calc.attendance_in ? (
                              <span className="text-[10px] text-gray-500 font-bold">(دخول: {extractTimeForDisplay(calc.attendance_in)})</span>
                            ) : (
                              <span className="text-[10px] text-red-500 font-bold">(بدون بصمة دخول)</span>
                            )}
                          </div> : 
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">غياب / لم يسجل</span>
                        }
                      </td>
                      <td className="p-3 text-center">
                        {calc.status === 'MATCHED' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-max mx-auto border border-green-200"><CheckCircle2 size={14} /> {calc.exception_type}</span>}
                        {calc.status === 'RESOLVED' && <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-max mx-auto border border-blue-200"><CheckCircle size={14} /> {calc.exception_type}</span>}
                        {calc.status === 'CONFLICT' && (
                          <div className="flex flex-col gap-2 items-center">
                            <span className="text-red-600 font-bold text-xs">{calc.exception_type}</span>
                            {userRole !== 'FACTORY_MANAGER' && (
                              <div className="flex gap-1 mt-1">
                                <button onClick={() => resolveConflicts([calc.id], 'ASSIGNMENT')} className="text-[10px] bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-2 py-1 rounded font-bold transition">اعتماد التكليف</button>
                                <button onClick={() => resolveConflicts([calc.id], 'ATTENDANCE')} className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2 py-1 rounded font-bold transition">اعتماد البصمة</button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center bg-gray-100 border-r border-gray-200 font-black text-xl">
                        {calc.status === 'CONFLICT' ? <span className="text-gray-300">-</span> : <span className="text-green-700">{formatHM(calc.final_approved_hours)}</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--color-navy-500)] font-bold text-xl">جاري التحميل...</div>}>
      <AuditContent />
    </Suspense>
  );
}