'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, FileWarning, CheckCircle, TrendingUp, UsersRound, Fingerprint, ClipboardList, ShieldCheck, Filter, AlertTriangle, TimerOff, Timer, X, PieChart as PieIcon, BarChart3 as BarIcon, FileClock } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [userDeptName, setUserDeptName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('');

  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalAssignedEmployees: 0, 
    matchedRecords: 0,
    exceptionRecords: 0,
    totalApprovedHours: 0,
    totalRejectedHours: 0,
    totalAssignedHours: 0,
  });

  const [exceptionData, setExceptionData] = useState<any[]>([]);
  const [topDebatedEmployees, setTopDebatedEmployees] = useState<any[]>([]);
  
  const [assignedHoursList, setAssignedHoursList] = useState<any[]>([]);
  const [showHoursModal, setShowHoursModal] = useState(false);

  const [loading, setLoading] = useState(true);

  // التواريخ الافتراضية لأول وآخر الشهر الحالي
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  useEffect(() => {
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    if (user.role === 'DATA_ENTRY') { router.push('/assignments'); return; }

    setUserRole(user.role);
    setUserName(user.name);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id, departments(name)').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setUserDeptName((data as any).departments?.name || '');
      }
      
      // جلب الإدارات للفلتر (فقط للأدمن أو مدير المصنع)
      if (user.role === 'ADMIN' || user.role === 'FACTORY_MANAGER') {
        const { data: depts } = await supabase.from('departments').select('id, name');
        setDepartments(depts || []);
      }
    }
    initUser();
  }, [router]);

  useEffect(() => {
    if (userRole) {
       document.title = 'الرئيسية | OT Audit';
       fetchDashboardData();
    }
  }, [startDate, endDate, userRole, userDeptId, selectedDeptFilter]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      // تحديد الإدارة النشطة بناءً على الصلاحيات والفلتر
      const activeDeptId = (userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') ? selectedDeptFilter : userDeptId;

      // 1. جلب عدد الموظفين
      let empQuery = supabase.from('employees').select('id', { count: 'exact', head: true });
      if (activeDeptId) empQuery = empQuery.eq('department_id', activeDeptId);

      // 2. جلب التكليفات المفصلة لمعرفة ساعات العمل المطلوبة (بناءً على التحديث الأخير ot_end_time)
      let detailedAssignQuery = supabase.from('ot_assignments').select(`
        date, day_end_time, night_end_time, department_id,
        ot_assignment_employees(emp_number, ot_end_time, shift_snapshot, employees!inner(name, companies(name), shifts(name), department_id))
      `);

      if (activeDeptId) detailedAssignQuery = detailedAssignQuery.eq('department_id', activeDeptId);
      if (startDate) detailedAssignQuery = detailedAssignQuery.gte('date', startDate);
      if (endDate) detailedAssignQuery = detailedAssignQuery.lte('date', endDate);

      // 3. جلب سجلات التدقيق (ot_calculations) المعتمدة والمرفوضة
      let calcQuery = supabase.from('ot_calculations').select(`
        status, exception_type, emp_number, date, final_approved_hours, rejected_hours,
        employees!inner(name, department_id, companies(name))
      `);
      if (activeDeptId) calcQuery = calcQuery.eq('employees.department_id', activeDeptId);
      if (startDate) calcQuery = calcQuery.gte('date', startDate);
      if (endDate) calcQuery = calcQuery.lte('date', endDate);

      const [{ count: empCount }, { data: detailedAssignments }, { data: calculations }] = await Promise.all([
        empQuery, detailedAssignQuery, calcQuery
      ]);

      // --- حساب ساعات التكليفات (المطلوبة) ---
      let totalAssignedHours = 0;
      let totalAssignedEmps = 0; 
      const empAssignedMap: Record<string, any> = {};

      if (detailedAssignments) {
        detailedAssignments.forEach(assign => {
          (assign as any).ot_assignment_employees?.forEach((emp: any) => {
            if (activeDeptId && emp.employees?.department_id !== activeDeptId) return;

            totalAssignedEmps++; 

            const shift = emp.shift_snapshot || emp.employees?.shifts?.name || '';
            const isNight = shift.includes('ليل') || shift.includes('مسا');
            const basicEnd = isNight ? '04:00' : '16:00';
            
            // استخدام الوقت الخاص بالموظف، أو الوقت الافتراضي للتكليف لو كان قديماً
            const actualEnd = emp.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5) || '';

            const getMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            let otDuration = getMins(actualEnd) - getMins(basicEnd);
            if (otDuration < 0) otDuration += 24 * 60;
            const hours = otDuration / 60;

            totalAssignedHours += hours;

            if (!empAssignedMap[emp.emp_number]) {
              empAssignedMap[emp.emp_number] = { 
                emp_number: emp.emp_number, 
                name: emp.employees?.name || '-', 
                company: (emp as any).employees?.companies?.name || '-', 
                totalHours: 0 
              };
            }
            empAssignedMap[emp.emp_number].totalHours += hours;
          });
        });
      }
      const employeesHoursList = Object.values(empAssignedMap).sort((a: any, b: any) => b.totalHours - a.totalHours);

      // --- حسابات التدقيق (MATCHED vs EXCEPTION) ---
      let matched = 0;
      let exceptions = 0;
      let approvedHours = 0;
      let rejectedHours = 0;
      const exceptionCounts: Record<string, number> = {};
      const empExceptionsMap: Record<string, any> = {};

      if (calculations) {
        calculations.forEach((calc: any) => {
          const approved = Number(calc.final_approved_hours) || 0;
          const rejected = Number(calc.rejected_hours) || 0; // حقل الساعات المرفوضة لو موجود، أو ممكن نستنتجه
          
          approvedHours += approved;
          rejectedHours += rejected;

          if (calc.status === 'MATCHED' || calc.status === 'RESOLVED') {
            // المحلول يعتبر سليم في الإحصائيات العامة
            matched++;
          } else if (calc.status === 'EXCEPTION') {
            exceptions++;
            const typeKey = calc.exception_type || 'استثناء غير معروف';
            exceptionCounts[typeKey] = (exceptionCounts[typeKey] || 0) + 1;
            
            if (!empExceptionsMap[calc.emp_number]) {
              empExceptionsMap[calc.emp_number] = { 
                emp_number: calc.emp_number, 
                name: calc.employees?.name || 'غير معروف', 
                company: calc.employees?.companies?.name || '-', 
                count: 0 
              };
            }
            empExceptionsMap[calc.emp_number].count += 1;
          }
        });
      }

      const chartData = Object.keys(exceptionCounts).map(key => ({ name: key, value: exceptionCounts[key] })).sort((a, b) => b.value - a.value);
      const topEmployees = Object.values(empExceptionsMap).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

      setStats({ 
        totalEmployees: empCount || 0, 
        totalAssignedEmployees: totalAssignedEmps, 
        matchedRecords: matched, 
        exceptionRecords: exceptions,
        totalApprovedHours: parseFloat(approvedHours.toFixed(2)),
        totalRejectedHours: parseFloat(rejectedHours.toFixed(2)),
        totalAssignedHours: parseFloat(totalAssignedHours.toFixed(2))
      });
      setExceptionData(chartData);
      setTopDebatedEmployees(topEmployees);
      setAssignedHoursList(employeesHoursList);

    } catch (error) { console.error('Error fetching dashboard data:', error); } 
    finally { setLoading(false); }
  }

  const COLORS = ['#10b981', '#ef4444'];
  const pieData = [
    { name: 'مطابق/محلول', value: stats.matchedRecords },
    { name: 'استثناء (مرفوض)', value: stats.exceptionRecords }
  ];

  const handlePieClick = (data: any) => {
    if (data.name.includes('مطابق')) router.push('/audit?status=MATCHED');
    else router.push('/audit?status=EXCEPTION');
  };

  const handleBarClick = (data: any) => {
    router.push(`/audit?status=EXCEPTION&type=${encodeURIComponent(data.name)}`);
  };

  let displayDeptName = 'جميع إدارات المصنع';
  if (userRole === 'MANAGER') displayDeptName = userDeptName;
  else if (selectedDeptFilter) displayDeptName = departments.find(d => d.id === selectedDeptFilter)?.name || '';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'صباح الخير ☀️' : currentHour < 18 ? 'طاب مساؤك 🌤️' : 'مساء الخير 🌙';

  return (
    <div className="flex flex-col space-y-8 pb-10 relative animate-in fade-in">
      
      {/* نافذة عرض ساعات الموظفين المكلفين */}
      {showHoursModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-navy-900)]"><Timer size={22} className="text-orange-500" /> ساعات التكليفات المطلوبة</h2>
                <p className="text-sm text-gray-500 font-semibold mt-1">إجمالي ما تم تكليف كل موظف به خلال الفترة المحددة</p>
              </div>
              <button onClick={() => setShowHoursModal(false)} className="text-gray-400 hover:bg-gray-200 p-2 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="overflow-auto p-0 flex-1">
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-100 sticky top-0 shadow-sm">
                  <tr className="text-sm text-gray-700">
                    <th className="p-3 border-b">الرقم</th>
                    <th className="p-3 border-b">اسم الموظف</th>
                    <th className="p-3 border-b">الشركة</th>
                    <th className="p-3 border-b text-center text-orange-700 font-black">الساعات المكلف بها</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedHoursList.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">لا يوجد تكليفات في هذه الفترة.</td></tr>
                  ) : (
                    assignedHoursList.map((emp, idx) => (
                      <tr key={idx} className="border-b hover:bg-orange-50 transition">
                        <td className="p-3 font-medium text-gray-800">{emp.emp_number}</td>
                        <td className="p-3 font-bold">{emp.name}</td>
                        <td className="p-3"><span className="bg-gray-100 text-xs px-2 py-1 rounded">{emp.company}</span></td>
                        <td className="p-3 text-center"><span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-black text-sm">{emp.totalHours.toFixed(1).replace(/\.0$/, '')} ساعة</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center font-bold">
              <span>الإجمالي العام: <span className="text-orange-600 text-lg">{stats.totalAssignedHours}</span> ساعة</span>
              <button onClick={() => setShowHoursModal(false)} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* الهيدر الترحيبي التفاعلي */}
      <div className="bg-gradient-to-l from-[var(--color-navy-900)] to-[var(--color-navy-500)] p-8 rounded-2xl shadow-lg text-white relative overflow-hidden mt-2">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">{greeting} يا {userName.split(' ')[0]}</h1>
          <p className="text-blue-100 text-lg max-w-2xl leading-relaxed">
            لوحة تحكم تفاعلية توفر لك رؤية عميقة لحالة التكليفات والمطابقة مع البصمة الخاصة بـ <strong className="text-white bg-blue-800/50 px-2 py-0.5 rounded">{displayDeptName}</strong>.
          </p>
        </div>
        <div className="absolute left-0 top-0 opacity-10 transform -translate-x-1/4 -translate-y-1/4"><TrendingUp size={200} /></div>
      </div>

      {/* الروابط السريعة */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-navy-900)] mb-4 flex items-center gap-2">الوصول السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/employees" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-blue-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-blue-50 p-4 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition transform group-hover:scale-110"><UsersRound size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-blue-700">إدارة الموظفين</span>
          </Link>
          <Link href="/attendance" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-indigo-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition transform group-hover:scale-110"><Fingerprint size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-indigo-700">سجل البصمة</span>
          </Link>
          <Link href="/assignments" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-purple-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-purple-50 p-4 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition transform group-hover:scale-110"><ClipboardList size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-purple-700">التكليفات المسبقة</span>
          </Link>
          <Link href="/timesheet" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-orange-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-orange-50 p-4 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition transform group-hover:scale-110"><FileClock size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-orange-700">تصدير التايم شيت</span>
          </Link>
          <Link href="/audit" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-emerald-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-emerald-50 p-4 rounded-full text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition transform group-hover:scale-110"><ShieldCheck size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-emerald-700">المطابقة والتدقيق</span>
          </Link>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="bg-white p-5 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-[var(--color-navy-900)] flex items-center gap-2"><Filter size={20} className="text-[var(--color-navy-500)]" /> فلتر لوحة التحكم</h2>
        <div className="flex flex-wrap items-center gap-4">
          
          {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-1.5 px-3">
              <span className="text-sm font-bold text-blue-900">الإدارة:</span>
              <select value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-blue-800 cursor-pointer">
                <option value="">كل الإدارات</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">من:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">إلى:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
          <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedDeptFilter(''); }} className="text-sm text-blue-600 hover:text-blue-800 font-bold transition underline">إعادة ضبط</button>
        </div>
      </div>

      {/* الكروت الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-blue-500 transform transition hover:-translate-y-1 hover:shadow-md">
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">إجمالي الموظفين</p><h3 className="text-3xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalEmployees}</h3></div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Users size={24} /></div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-purple-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => setShowHoursModal(true)}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">العمال المكلفين إضافي</p><h3 className="text-3xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalAssignedEmployees}</h3></div>
            <div className="bg-purple-50 p-3 rounded-xl text-purple-600"><ClipboardList size={24} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-orange-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => setShowHoursModal(true)}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">ساعات التكليف المطلوبة</p><h3 className="text-3xl font-black text-orange-600">{loading ? '...' : stats.totalAssignedHours} <span className="text-sm font-bold text-gray-500">ساعة</span></h3></div>
            <div className="bg-orange-50 p-3 rounded-xl text-orange-600"><Timer size={24} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-emerald-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=MATCHED')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">الساعات المعتمدة (مطابق)</p><h3 className="text-3xl font-black text-emerald-600">{loading ? '...' : stats.totalApprovedHours} <span className="text-sm font-bold text-gray-500">ساعة</span></h3></div>
            <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600"><ShieldCheck size={24} /></div>
          </div>
        </div>
      </div>
      
      {/* الكروت الثانوية للاستثناءات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=MATCHED')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">سجلات المطابقة الناجحة</p><h3 className="text-3xl font-black text-green-600">{loading ? '...' : stats.matchedRecords} <span className="text-sm text-gray-500">سجل</span></h3></div>
            <div className="bg-green-50 p-3 rounded-xl text-green-600"><CheckCircle size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=EXCEPTION')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">السجلات المرفوضة والمخالفة</p><h3 className="text-3xl font-black text-red-600">{loading ? '...' : stats.exceptionRecords} <span className="text-sm text-gray-500">سجل</span></h3></div>
            <div className="bg-red-50 p-3 rounded-xl text-red-600"><AlertTriangle size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-rose-600 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=EXCEPTION')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">الساعات المرفوضة (استثناءات)</p><h3 className="text-3xl font-black text-rose-600">{loading ? '...' : stats.totalRejectedHours} <span className="text-sm font-bold text-gray-500">ساعة</span></h3></div>
            <div className="bg-rose-50 p-3 rounded-xl text-rose-600"><FileWarning size={24} /></div>
          </div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border lg:col-span-1">
          <h3 className="text-lg font-bold text-[var(--color-navy-900)] mb-6 border-b pb-2 flex items-center gap-2"><PieIcon size={18} /> نسبة المطابقة للفترة</h3>
          <div className="h-64 flex items-center justify-center">
            {loading ? <p className="text-gray-400 font-bold">جاري تحديث البيانات...</p> : stats.matchedRecords === 0 && stats.exceptionRecords === 0 ? <p className="text-gray-400 font-bold text-center text-sm">لا توجد بيانات للفترة المحددة.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none" onClick={handlePieClick} cursor="pointer">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border lg:col-span-2">
          <h3 className="text-lg font-bold text-[var(--color-navy-900)] mb-6 border-b pb-2 flex items-center gap-2"><BarIcon size={18} /> تحليل أسباب الاستثناءات</h3>
          <div className="h-64 flex items-center justify-center">
            {loading ? <p className="text-gray-400 font-bold">جاري تحديث البيانات...</p> : exceptionData.length === 0 ? <p className="text-gray-400 font-bold text-center text-sm">لا يوجد استثناءات للفترة المحددة.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exceptionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#9ca3af' }} />
                  <Tooltip cursor={{fill: '#fef2f2'}} contentStyle={{ borderRadius: '10px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={50} onClick={handleBarClick} cursor="pointer">
                    {exceptionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name.includes('بدون تكليف') ? '#f59e0b' : '#ef4444'} className="hover:opacity-80 transition" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* الموظفين الأكثر تسجيلاً للاستثناءات */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b bg-red-50 flex justify-between items-center">
          <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle size={20} /> الموظفين الأكثر تسجيلاً للمخالفات (Top 5)</h3>
          <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full border border-red-200 shadow-sm">يجب مراجعة هؤلاء الموظفين</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-white border-b text-gray-600 text-sm">
                <th className="p-4 font-bold">الرقم</th><th className="p-4 font-bold">اسم الموظف</th><th className="p-4 font-bold">الشركة</th><th className="p-4 font-bold text-center">عدد المخالفات المرفوضة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr> : 
               topDebatedEmployees.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-green-600 font-bold">لا توجد أي مخالفات مسجلة للفترة المحددة. الأداء ممتاز!</td></tr> :
               topDebatedEmployees.map((emp, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/audit?search=${emp.emp_number}`)}>
                    <td className="p-4 font-medium text-gray-800">{emp.emp_number}</td>
                    <td className="p-4 font-black text-[var(--color-navy-800)]">{emp.name}</td>
                    <td className="p-4 text-sm font-bold text-gray-600"><span className="bg-gray-100 border px-2 py-1 rounded">{emp.company}</span></td>
                    <td className="p-4 text-center"><span className="inline-flex items-center justify-center bg-red-100 text-red-700 border border-red-200 w-8 h-8 rounded-full font-black shadow-sm">{emp.count}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}