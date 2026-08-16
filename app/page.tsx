'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, FileWarning, CheckCircle, TrendingUp, UsersRound, 
  Fingerprint, ClipboardList, Cpu, ShieldCheck, Filter, 
  AlertTriangle, Timer, X, PieChart as PieIcon, 
  BarChart3 as BarIcon, FileClock, CalendarDays, Clock, 
  UserX, Scale, Loader2, Target
} from 'lucide-react';
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
  const [topAssignedEmployees, setTopAssignedEmployees] = useState<any[]>([]); // 🔴 جدول أكثر الموظفين تكليفاً
  
  const [assignedHoursList, setAssignedHoursList] = useState<any[]>([]);
  const [showHoursModal, setShowHoursModal] = useState(false);

  const [loading, setLoading] = useState(true);

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

    setUserRole(user.role);
    setUserName(user.name);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id, departments(name)').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
        setUserDeptName((data as any).departments?.name || '');
      }
      
      if (user.role === 'ADMIN' || user.role === 'FACTORY_MANAGER') {
        const { data: depts } = await supabase.from('departments').select('id, name');
        setDepartments(depts || []);
      }
    }
    initUser();
  }, [router]);

  useEffect(() => {
    if (userRole) {
       setTimeout(() => { document.title = 'الرئيسية | STAFFCORE'; }, 100);

       if (userRole !== 'DATA_ENTRY') {
         fetchDashboardData();
       } else {
         setLoading(false);
       }
    }
  }, [startDate, endDate, userRole, userDeptId, selectedDeptFilter]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const activeDeptId = (userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') ? selectedDeptFilter : userDeptId;

      let empQuery = supabase.from('employees').select('id', { count: 'exact', head: true });
      if (activeDeptId) empQuery = empQuery.eq('department_id', activeDeptId);

      let detailedAssignQuery = supabase.from('ot_assignments').select(`
        date, day_end_time, night_end_time, department_id,
        ot_assignment_employees(emp_number, ot_end_time, shift_snapshot, employees!inner(name, companies(name), shifts(name), department_id))
      `);

      if (activeDeptId) detailedAssignQuery = detailedAssignQuery.eq('department_id', activeDeptId);
      if (startDate) detailedAssignQuery = detailedAssignQuery.gte('date', startDate);
      if (endDate) detailedAssignQuery = detailedAssignQuery.lte('date', endDate);

      // 🔴 تم تصحيح الكويري بإزالة rejected_hours واستبدالها بـ timesheet_hours
      let calcQuery = supabase.from('ot_calculations').select(`
        status, exception_type, emp_number, date, final_approved_hours, timesheet_hours,
        employees!inner(name, department_id, companies(name))
      `);
      if (activeDeptId) calcQuery = calcQuery.eq('employees.department_id', activeDeptId);
      if (startDate) calcQuery = calcQuery.gte('date', startDate);
      if (endDate) calcQuery = calcQuery.lte('date', endDate);

      const [{ count: empCount }, { data: detailedAssignments }, { data: calculations }] = await Promise.all([
        empQuery, detailedAssignQuery, calcQuery
      ]);

      let totalAssignedHours = 0;
      const uniqueAssignedEmps = new Set(); // 🔴 لعد الموظفين بدون تكرار
      const empAssignedMap: Record<string, any> = {};

      if (detailedAssignments) {
        detailedAssignments.forEach(assign => {
          (assign as any).ot_assignment_employees?.forEach((emp: any) => {
            if (activeDeptId && emp.employees?.department_id !== activeDeptId) return;

            uniqueAssignedEmps.add(emp.emp_number); // 🔴 إضافة لرقم الموظف في المجموعة المانعة للتكرار

            const shift = emp.shift_snapshot || emp.employees?.shifts?.name || '';
            const isNight = shift.includes('ليل') || shift.includes('مسائي') || shift.includes('night');
            const basicEnd = isNight ? '04:00' : '16:00';
            
            const actualEnd = emp.ot_end_time?.substring(0, 5) || (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5) || '';

            const getMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            
            let actualMins = getMins(actualEnd);
            let basicMins = getMins(basicEnd);
            
            let otDuration = actualMins - basicMins;
            if (otDuration < 0) otDuration += 24 * 60;
            const hours = otDuration / 60;

            totalAssignedHours += hours;

            if (!empAssignedMap[emp.emp_number]) {
              empAssignedMap[emp.emp_number] = { 
                emp_number: emp.emp_number, 
                name: emp.employees?.name || '-', 
                company: (emp as any).employees?.companies?.name || '-', 
                totalHours: 0,
                daysCount: 0 // 🔴 تتبع عدد الأيام
              };
            }
            empAssignedMap[emp.emp_number].totalHours += hours;
            empAssignedMap[emp.emp_number].daysCount += 1;
          });
        });
      }

      // 🔴 جلب أكثر الموظفين تكليفاً بالأوفر تايم
      const employeesHoursList = Object.values(empAssignedMap).sort((a: any, b: any) => b.totalHours - a.totalHours);
      const topAssigned = employeesHoursList.slice(0, 5); 

      let matched = 0;
      let exceptions = 0;
      let approvedHours = 0;
      let rejectedHours = 0;
      const exceptionCounts: Record<string, number> = {};
      const empExceptionsMap: Record<string, any> = {};

      if (calculations) {
        calculations.forEach((calc: any) => {
          const approved = Number(calc.final_approved_hours) || 0;
          const requested = Number(calc.timesheet_hours) || 0; // الساعات المطلوبة في التكليف
          
          approvedHours += approved;
          
          // 🔴 استنتاج الساعات المرفوضة/المهدرة بذكاء (لو طلبات أكتر من المعتمد)
          if (requested > approved) {
              rejectedHours += (requested - approved);
          }

          if (calc.status === 'MATCHED' || calc.status === 'RESOLVED') {
            matched++;
          } else if (calc.status === 'CONFLICT') {
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
      const topExceptions = Object.values(empExceptionsMap).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

      setStats({ 
        totalEmployees: empCount || 0, 
        totalAssignedEmployees: uniqueAssignedEmps.size, // 🔴 عدد الموظفين الحقيقي بدون تكرار
        matchedRecords: matched, 
        exceptionRecords: exceptions,
        totalApprovedHours: parseFloat(approvedHours.toFixed(2)),
        totalRejectedHours: parseFloat(rejectedHours.toFixed(2)),
        totalAssignedHours: parseFloat(totalAssignedHours.toFixed(2))
      });
      setExceptionData(chartData);
      setTopDebatedEmployees(topExceptions);
      setTopAssignedEmployees(topAssigned);
      setAssignedHoursList(employeesHoursList);

    } catch (error) { console.error('Error fetching dashboard data:', error); } 
    finally { setLoading(false); }
  }

  const COLORS = ['#10b981', '#ef4444'];
  const pieData = [
    { name: 'انضباط (مطابق)', value: stats.matchedRecords },
    { name: 'مخالفات وتعارضات', value: stats.exceptionRecords }
  ];

  const handlePieClick = (data: any) => {
    if (data.name.includes('انضباط')) router.push('/audit?status=MATCHED');
    else router.push('/audit?status=CONFLICT');
  };

  let displayDeptName = 'جميع إدارات المصنع';
  if (userRole === 'MANAGER' || userRole === 'DATA_ENTRY') displayDeptName = userDeptName;
  else if (selectedDeptFilter) displayDeptName = departments.find(d => d.id === selectedDeptFilter)?.name || '';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'صباح الخير ☀️' : currentHour < 18 ? 'طاب يومك 🌤️' : 'مساء الخير 🌙';

  const portals = [
    { href: '/employees', icon: UsersRound, title: 'إدارة الموظفين', desc: 'سجل بيانات العاملين الشامل', color: 'blue' },
    { href: '/attendance', icon: Fingerprint, title: 'سجل البصمة', desc: 'رفع ومراجعة الحضور اليومي', color: 'cyan' },
    { href: '/assignments', icon: ClipboardList, title: 'التكليفات والإضافي', desc: 'إنشاء وتتبع مهام الأوفر تايم', color: 'purple' },
    { href: '/leaves', icon: CalendarDays, title: 'طلبات الإجازات', desc: 'تقديم ومتابعة الإجازات', color: 'emerald' },
    { href: '/permissions', icon: Clock, title: 'أذونات الخروج', desc: 'إصدار الأذونات المؤقتة', color: 'indigo' },
    { href: '/absences', icon: UserX, title: 'إدارة الغياب', desc: 'رصد حالات الغياب اليومية', color: 'pink' },
    { href: '/penalties', icon: Scale, title: 'إدارة الجزاءات', desc: 'توقيع ومتابعة الجزاءات', color: 'red' },
    { href: '/approvals', icon: CheckCircle, title: 'مركز الاعتمادات', desc: 'اعتماد أو رفض طلبات الإدارة', color: 'orange' },
    { href: '/audit', icon: ShieldCheck, title: 'المطابقة والتدقيق', desc: 'التدقيق المحاسبي ومطابقة الساعات', color: 'teal' },
    { href: '/timesheet', icon: FileClock, title: 'تصدير التايم شيت', desc: 'استخراج كشوف الرواتب النهائية', color: 'amber' },
  ];

  const getColorClasses = (color: string) => {
    const classes: any = {
      blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 border-blue-100 group-hover:border-blue-500 from-blue-50/50',
      cyan: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 border-cyan-100 group-hover:border-cyan-500 from-cyan-50/50',
      purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 border-purple-100 group-hover:border-purple-500 from-purple-50/50',
      emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 border-emerald-100 group-hover:border-emerald-500 from-emerald-50/50',
      indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 border-indigo-100 group-hover:border-indigo-500 from-indigo-50/50',
      pink: 'bg-pink-50 text-pink-600 group-hover:bg-pink-600 border-pink-100 group-hover:border-pink-500 from-pink-50/50',
      red: 'bg-red-50 text-red-600 group-hover:bg-red-600 border-red-100 group-hover:border-red-500 from-red-50/50',
      orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 border-orange-100 group-hover:border-orange-500 from-orange-50/50',
      teal: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 border-teal-100 group-hover:border-teal-500 from-teal-50/50',
      amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 border-amber-100 group-hover:border-amber-500 from-amber-50/50',
    };
    return classes[color] || classes.blue;
  };

  return (
    <div className="relative w-full min-h-screen pb-10">
      
      {/* لافتة الترحيب */}
      <div className="bg-gradient-to-l from-[var(--color-navy-900)] to-[var(--color-navy-500)] p-8 rounded-3xl shadow-lg text-white relative overflow-hidden mb-8 mt-2 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">{greeting}، {userName.split(' ')[0]}</h1>
            <p className="text-blue-100 text-lg max-w-2xl leading-relaxed font-medium">
              مرحباً بك في منصة <strong className="text-white">STAFFCORE</strong>. 
              {userRole === 'DATA_ENTRY' 
                ? ' يرجى اختيار البوابة المطلوبة لإدارة البيانات التشغيلية.'
                : ' لوحة القيادة الذكية تعرض لك نبض الإدارة لحظة بلحظة.'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
            <span className="block text-blue-200 text-xs font-bold mb-1">الإدارة الحالية</span>
            <span className="block font-black text-xl">{displayDeptName}</span>
          </div>
        </div>
        <div className="absolute left-0 top-0 opacity-10 transform -translate-x-1/4 -translate-y-1/4"><TrendingUp size={250} /></div>
      </div>

      {/* بوابات النظام (متاحة للكل) */}
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-6">
        <h2 className="text-2xl font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-3 border-r-4 border-[var(--color-navy-500)] pr-4">
          البوابات التشغيلية للمنصة
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {portals.map((portal, idx) => {
            const colorClass = getColorClasses(portal.color);
            return (
              <Link key={idx} href={portal.href} className={`relative overflow-hidden bg-white p-5 rounded-2xl shadow-sm border ${colorClass.split(' ')[3]} hover:shadow-xl transition-all duration-300 group flex flex-col items-start gap-4`}>
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${colorClass.split(' ')[5]} to-transparent rounded-bl-full -z-0 opacity-50 group-hover:scale-150 transition-transform duration-700`} />
                <div className={`relative z-10 p-3.5 rounded-xl ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]} ${colorClass.split(' ')[2]} group-hover:text-white transition-colors duration-300 shadow-sm`}>
                  <portal.icon size={26} strokeWidth={2.5} />
                </div>
                <div className="relative z-10">
                  <h3 className="font-black text-gray-800 text-base mb-1 group-hover:text-[var(--color-navy-900)] transition-colors">{portal.title}</h3>
                  <p className="text-xs text-gray-500 font-bold leading-relaxed">{portal.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 🔴 الإحصائيات (تختفي للمدخل بيانات تماماً) */}
      {userRole !== 'DATA_ENTRY' && (
        <div className="animate-in fade-in slide-in-from-bottom-8">
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h2 className="text-lg font-bold text-[var(--color-navy-900)] flex items-center gap-2"><Filter size={20} className="text-[var(--color-navy-500)]" /> نطاق الإحصائيات</h2>
            <div className="flex flex-wrap items-center gap-4">
              {(userRole === 'ADMIN' || userRole === 'FACTORY_MANAGER') && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-2 px-4 shadow-inner">
                  <span className="text-sm font-bold text-blue-900">الإدارة:</span>
                  <select value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)} className="bg-transparent border-none outline-none font-black text-sm text-blue-800 cursor-pointer">
                    <option value="">كل الإدارات</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-2 px-4 shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500">من:</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500">إلى:</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
                </div>
              </div>
              <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedDeptFilter(''); }} className="text-sm text-gray-500 hover:text-blue-600 font-bold transition underline">إعادة ضبط</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 rounded-r-2xl"></div>
              <div className="flex justify-between items-start">
                <div><p className="text-gray-400 text-sm font-bold mb-2">إجمالي الموظفين بالإدارة</p><h3 className="text-4xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalEmployees}</h3></div>
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform"><Users size={28} strokeWidth={2} /></div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group cursor-pointer" onClick={() => setShowHoursModal(true)}>
              <div className="absolute top-0 right-0 w-2 h-full bg-purple-500 rounded-r-2xl"></div>
              <div className="flex justify-between items-start">
                <div><p className="text-gray-400 text-sm font-bold mb-2">عدد العمال المكلفين فعلياً</p><h3 className="text-4xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalAssignedEmployees} <span className="text-xs font-bold text-gray-400">عامل (بدون تكرار)</span></h3></div>
                <div className="bg-purple-50 p-4 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform"><UsersRound size={28} strokeWidth={2} /></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group cursor-pointer" onClick={() => setShowHoursModal(true)}>
              <div className="absolute top-0 right-0 w-2 h-full bg-orange-500 rounded-r-2xl"></div>
              <div className="flex justify-between items-start">
                <div><p className="text-gray-400 text-sm font-bold mb-2">إجمالي ساعات التكليف</p><h3 className="text-4xl font-black text-orange-600">{loading ? '...' : stats.totalAssignedHours} <span className="text-sm font-bold text-gray-400">ساعة</span></h3></div>
                <div className="bg-orange-50 p-4 rounded-2xl text-orange-600 group-hover:scale-110 transition-transform"><Timer size={28} strokeWidth={2} /></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group cursor-pointer" onClick={() => router.push('/audit?status=MATCHED')}>
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 rounded-r-2xl"></div>
              <div className="flex justify-between items-start">
                <div><p className="text-gray-400 text-sm font-bold mb-2">الساعات المعتمدة (صافي)</p><h3 className="text-4xl font-black text-emerald-600">{loading ? '...' : stats.totalApprovedHours} <span className="text-sm font-bold text-gray-400">ساعة</span></h3></div>
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform"><Cpu size={28} strokeWidth={2} /></div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl shadow-sm border border-green-100 cursor-pointer hover:shadow-md transition" onClick={() => router.push('/audit?status=MATCHED')}>
              <div className="flex justify-between items-center">
                <div><p className="text-green-800 text-sm font-bold mb-1">السجلات المطابقة (انضباط)</p><h3 className="text-3xl font-black text-green-700">{loading ? '...' : stats.matchedRecords} <span className="text-xs text-green-600 bg-green-200/50 px-2 py-1 rounded-md">يوم عمل سليم</span></h3></div>
                <div className="bg-white p-3 rounded-2xl text-green-500 shadow-sm"><CheckCircle size={28} /></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white p-6 rounded-2xl shadow-sm border border-red-100 cursor-pointer hover:shadow-md transition" onClick={() => router.push('/audit?status=CONFLICT')}>
              <div className="flex justify-between items-center">
                <div><p className="text-red-800 text-sm font-bold mb-1">التعارضات التي تتطلب تدخل</p><h3 className="text-3xl font-black text-red-600">{loading ? '...' : stats.exceptionRecords} <span className="text-xs text-red-500 bg-red-200/50 px-2 py-1 rounded-md">مشكلة في البصمة</span></h3></div>
                <div className="bg-white p-3 rounded-2xl text-red-500 shadow-sm"><AlertTriangle size={28} /></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-white p-6 rounded-2xl shadow-sm border border-rose-100 cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <div><p className="text-rose-800 text-sm font-bold mb-1">الساعات المرفوضة (مهدرة)</p><h3 className="text-3xl font-black text-rose-600">{loading ? '...' : stats.totalRejectedHours} <span className="text-xs text-rose-500 bg-rose-200/50 px-2 py-1 rounded-md">ساعة</span></h3></div>
                <div className="bg-white p-3 rounded-2xl text-rose-500 shadow-sm"><FileWarning size={28} /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 xl:col-span-1">
              <h3 className="text-lg font-black text-[var(--color-navy-900)] mb-6 flex items-center gap-2"><PieIcon size={20} className="text-blue-500"/> معدل انضباط التكاليف والمطابقة</h3>
              <div className="h-64 flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin text-gray-400" size={32}/> : stats.matchedRecords === 0 && stats.exceptionRecords === 0 ? <p className="text-gray-400 font-bold text-center text-sm">برجاء تشغيل أمر التدقيق من صفحة المطابقة لظهور البيانات.</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value" stroke="none" onClick={handlePieClick} cursor="pointer" cornerRadius={10}>
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition outline-none" />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '16px', fontWeight: 'bold', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 xl:col-span-2 overflow-hidden flex flex-col">
              <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-black text-[var(--color-navy-900)] flex items-center gap-2"><Target size={20} className="text-orange-500"/> أكثر الموظفين تكليفاً بالأوفر تايم</h3>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg border border-orange-200">الأكثر استهلاكاً للميزانية</span>
              </div>
              <div className="overflow-x-auto flex-1 p-2">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="text-gray-500 text-sm border-b">
                      <th className="p-4 font-bold pb-2">الرقم</th><th className="p-4 font-bold pb-2">الاسم</th><th className="p-4 font-bold pb-2">الشركة</th><th className="p-4 font-bold pb-2 text-center">أيام التكليف</th><th className="p-4 font-bold pb-2 text-center">إجمالي الساعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin text-gray-400 mx-auto" size={24}/></td></tr> : 
                     topAssignedEmployees.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-gray-400 font-bold">لا توجد أي تكليفات مسجلة.</td></tr> :
                     topAssignedEmployees.map((emp, idx) => (
                        <tr key={idx} className="border-b last:border-0 hover:bg-orange-50/30 transition">
                          <td className="p-4 font-bold text-gray-600">{emp.emp_number}</td>
                          <td className="p-4 font-black text-[var(--color-navy-800)]">{emp.name}</td>
                          <td className="p-4"><span className="bg-gray-100 text-xs font-bold text-gray-600 px-2.5 py-1 rounded-md border">{emp.company}</span></td>
                          <td className="p-4 text-center font-bold text-gray-700">{emp.daysCount} يوم</td>
                          <td className="p-4 text-center"><span className="text-orange-700 font-black text-lg">{emp.totalHours.toFixed(1).replace(/\.0$/, '')} <span className="text-xs">ساعة</span></span></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 xl:col-span-3 overflow-hidden flex flex-col mt-4">
              <div className="p-6 border-b bg-red-50/50 flex justify-between items-center">
                <h3 className="font-black text-[var(--color-navy-900)] flex items-center gap-2"><AlertTriangle size={20} className="text-red-500"/> الموظفين الأكثر تسجيلاً للمخالفات والتعارضات</h3>
                <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1.5 rounded-lg border border-red-200">انصراف مبكر، نسيان بصمة</span>
              </div>
              <div className="overflow-x-auto flex-1 p-2">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="text-gray-500 text-sm border-b">
                      <th className="p-4 font-bold pb-2">الرقم</th><th className="p-4 font-bold pb-2">اسم الموظف</th><th className="p-4 font-bold pb-2">الشركة</th><th className="p-4 font-bold pb-2 text-center">مرات تكرار التعارض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin text-gray-400 mx-auto" size={24}/></td></tr> : 
                     topDebatedEmployees.length === 0 ? <tr><td colSpan={4} className="p-12 text-center text-green-600 font-bold bg-green-50/50 rounded-xl m-4 block">لا توجد أي تعارضات مسجلة. الانضباط 100%! 🎉</td></tr> :
                     topDebatedEmployees.map((emp, idx) => (
                        <tr key={idx} className="border-b last:border-0 hover:bg-red-50/30 transition cursor-pointer" onClick={() => router.push(`/audit?search=${emp.emp_number}`)}>
                          <td className="p-4 font-bold text-gray-600">{emp.emp_number}</td>
                          <td className="p-4 font-black text-[var(--color-navy-800)]">{emp.name}</td>
                          <td className="p-4"><span className="bg-gray-100 text-xs font-bold text-gray-600 px-2.5 py-1 rounded-md border">{emp.company}</span></td>
                          <td className="p-4 text-center"><span className="inline-flex items-center justify-center bg-red-100 text-red-700 w-8 h-8 rounded-full font-black shadow-inner">{emp.count}</span></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
      
    </div>
  );
}