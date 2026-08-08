'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Play, Filter, FileWarning, CheckCircle, Clock, Search, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function AuditContent() {
  const searchParams = useSearchParams();

  const [calculations, setCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // قراءة الفلاتر من الرابط (لو كانت موجودة)
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'ALL');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterExceptionType, setFilterExceptionType] = useState(searchParams.get('type') || '');
  const [filterCompany, setFilterCompany] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    document.title = 'التدقيق والمطابقة | OT Audit';
    fetchCalculations();
  }, [selectedMonth, selectedYear]);

  async function fetchCalculations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ot_calculations')
        .select(`*, employees!inner(name, job_title, companies(name))`)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('date', { ascending: false });

      if (error) throw error;
      setCalculations(data || []);
    } catch (error: any) {
      console.error("تفاصيل الخطأ:", error);
    } finally {
      setLoading(false);
    }
  }

  const runAuditEngine = async () => {
    if (!confirm(`هل أنت متأكد من بدء المطابقة لشهر ${selectedMonth}/${selectedYear}؟`)) return;
    setIsAuditing(true);
    try {
      await supabase.from('ot_calculations').delete().eq('month', selectedMonth).eq('year', selectedYear);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`;

      const { data: timesheets } = await supabase.from('timesheet_records').select('*').gte('date', startDate).lte('date', endDate);
      if (!timesheets || timesheets.length === 0) {
        showToast('لا يوجد تايم شيت مرفوع لهذا الشهر!', 'error'); setIsAuditing(false); return;
      }

      const { data: attendances } = await supabase.from('attendance_records').select('*').gte('date', startDate).lte('date', endDate);
      const { data: rawAssignments } = await supabase.from('ot_assignments').select(`date, end_time, ot_assignment_employees(emp_number)`).gte('date', startDate).lte('date', endDate);
      
      const flatAssignments: any[] = [];
      rawAssignments?.forEach(assign => { assign.ot_assignment_employees.forEach((emp: any) => { flatAssignments.push({ emp_number: emp.emp_number, date: assign.date, end_time: assign.end_time }); }); });

      const auditResults = timesheets.map(ts => {
        const attendance = attendances?.find(a => a.emp_number === ts.emp_number && a.date === ts.date);
        const assignment = flatAssignments.find(a => a.emp_number === ts.emp_number && a.date === ts.date);

        let exceptionType = 'مطابق'; let status = 'MATCHED'; let finalHours = ts.recorded_hours;
        if (!attendance || !attendance.last_out) { exceptionType = 'بدون بصمة انصراف'; status = 'EXCEPTION'; finalHours = 0; }
        else if (!assignment) { exceptionType = 'بدون تكليف مسبق'; status = 'EXCEPTION'; finalHours = 0; }
        else { exceptionType = 'مطابق'; status = 'MATCHED'; finalHours = ts.recorded_hours; }

        return {
          emp_number: ts.emp_number, date: ts.date, month: selectedMonth, year: selectedYear,
          timesheet_hours: ts.recorded_hours, attendance_in: attendance?.first_in || null, attendance_out: attendance?.last_out || null,
          assigned_end_time: assignment?.end_time || null, final_approved_hours: finalHours, exception_type: exceptionType, status: status
        };
      });

      const { error: insertError } = await supabase.from('ot_calculations').insert(auditResults);
      if (insertError) throw insertError;
      showToast('تمت عملية المطابقة بنجاح!', 'success'); fetchCalculations();
    } catch (error) { showToast('حدث خطأ أثناء العملية.', 'error'); } 
    finally { setIsAuditing(false); }
  };

  const uniqueCompanies = Array.from(new Set(calculations.map(c => c.employees?.companies?.name))).filter(Boolean);
  const uniqueExceptions = Array.from(new Set(calculations.map(c => c.exception_type))).filter(Boolean);

  const displayedCalculations = calculations.filter(c => {
    const matchStatus = filterStatus === 'ALL' || c.status === filterStatus;
    const matchSearch = (c.employees?.name || '').includes(searchQuery) || (c.emp_number || '').includes(searchQuery);
    const matchCompany = filterCompany === '' || c.employees?.companies?.name === filterCompany;
    const matchException = filterExceptionType === '' || c.exception_type === filterExceptionType;
    return matchStatus && matchSearch && matchCompany && matchException;
  });

  const totalRecords = calculations.length;
  const matchedRecords = calculations.filter(c => c.status === 'MATCHED').length;
  const exceptionRecords = calculations.filter(c => c.status === 'EXCEPTION').length;

  return (
    <div className="flex flex-col space-y-6 relative">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">التدقيق والمطابقة (Audit Engine)</h1>
          <p className="text-gray-500 text-sm mt-1">مطابقة التايم شيت مع سجلات البصمة والتكليفات المسبقة آلياً</p>
        </div>
        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">شهر:</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="border rounded-md p-1 outline-none font-bold bg-white">
              {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">سنة:</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="border rounded-md p-1 outline-none font-bold bg-white">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={runAuditEngine} disabled={isAuditing} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold shadow-md disabled:opacity-50">
            <Play size={18} className={isAuditing ? 'animate-pulse' : ''} /> {isAuditing ? 'جاري المطابقة...' : 'ابدأ المطابقة الذكية'}
          </button>
        </div>
      </div>

      {calculations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border-r-4 border-blue-500 flex items-center justify-between">
            <div><p className="text-gray-500 text-sm font-semibold">إجمالي السجلات المفحوصة</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{totalRecords}</h3></div>
            <div className="bg-blue-50 p-3 rounded-full text-blue-500"><Clock size={24} /></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-r-4 border-green-500 flex items-center justify-between">
            <div><p className="text-gray-500 text-sm font-semibold">المطابق (سليم)</p><h3 className="text-2xl font-bold text-green-600 mt-1">{matchedRecords}</h3></div>
            <div className="bg-green-50 p-3 rounded-full text-green-500"><CheckCircle size={24} /></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-r-4 border-red-500 flex items-center justify-between">
            <div><p className="text-gray-500 text-sm font-semibold">الاستثناءات (مرفوض)</p><h3 className="text-2xl font-bold text-red-600 mt-1">{exceptionRecords}</h3></div>
            <div className="bg-red-50 p-3 rounded-full text-red-500"><FileWarning size={24} /></div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="بحث باسم الموظف أو الرقم..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)]" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] font-semibold">
          <option value="ALL">كل الحالات</option>
          <option value="MATCHED">المطابق فقط (سليم)</option>
          <option value="EXCEPTION">الاستثناءات فقط</option>
        </select>
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)]">
          <option value="">كل الشركات</option>
          {uniqueCompanies.map((c: any) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterExceptionType} onChange={(e) => setFilterExceptionType(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)]">
          <option value="">كل أنواع الاستثناءات</option>
          {uniqueExceptions.map((ex: any) => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        
        {(searchQuery || filterCompany || filterExceptionType || filterStatus !== 'ALL') && (
          <button onClick={() => { setSearchQuery(''); setFilterCompany(''); setFilterExceptionType(''); setFilterStatus('ALL'); }} className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-semibold transition">
            <XCircle size={16} /> تفريغ الفلاتر
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                <th className="p-4 font-semibold">التاريخ</th>
                <th className="p-4 font-semibold">الموظف</th>
                <th className="p-4 font-semibold text-center border-r">ساعات الشيت</th>
                <th className="p-4 font-semibold text-center text-blue-700">بصمة الانصراف</th>
                <th className="p-4 font-semibold text-center text-purple-700 border-l">تكليف الانصراف</th>
                <th className="p-4 font-semibold text-center">نوع الاستثناء</th>
                <th className="p-4 font-semibold text-center bg-gray-100">المعتمد</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr> : 
               displayedCalculations.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-gray-500">لا يوجد بيانات تطابق الفلاتر الحالية.</td></tr> :
               displayedCalculations.map((calc, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                    <td className="p-3 text-sm font-bold text-gray-700 whitespace-nowrap">{new Date(calc.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</td>
                    <td className="p-3"><div className="font-bold text-[var(--color-navy-800)] text-sm">{calc.employees?.name}</div><div className="text-xs text-gray-500">{calc.emp_number} - {calc.employees?.companies?.name}</div></td>
                    <td className="p-3 text-center border-r"><span className="font-bold text-lg text-gray-800">{calc.timesheet_hours}</span></td>
                    <td className="p-3 text-center">{calc.attendance_out ? <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded dir-ltr inline-block border border-blue-100">{new Date(calc.attendance_out).toISOString().substring(11, 16)}</span> : <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">لا يوجد</span>}</td>
                    <td className="p-3 text-center border-l">{calc.assigned_end_time ? <span className="text-sm font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded dir-ltr inline-block border border-purple-100">{calc.assigned_end_time.substring(0, 5)}</span> : <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">لا يوجد</span>}</td>
                    <td className="p-3 text-center">{calc.status === 'MATCHED' ? <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-max mx-auto border border-green-200"><CheckCircle2 size={14} /> مطابق</span> : <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-max mx-auto border border-red-200 shadow-sm"><AlertCircle size={14} /> {calc.exception_type}</span>}</td>
                    <td className="p-3 text-center bg-gray-100 font-bold text-lg">{calc.final_approved_hours > 0 ? <span className="text-green-700">{calc.final_approved_hours}</span> : <span className="text-red-600">0</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--color-navy-500)] font-bold text-xl">جاري تحميل لوحة التدقيق...</div>}>
      <AuditContent />
    </Suspense>
  );
}