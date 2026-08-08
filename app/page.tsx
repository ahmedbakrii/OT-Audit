'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, FileWarning, CheckCircle, Clock, TrendingUp, UsersRound, Fingerprint, ClipboardList, ShieldCheck, Filter, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalAssignments: 0,
    matchedRecords: 0,
    exceptionRecords: 0,
  });

  const [exceptionData, setExceptionData] = useState<any[]>([]);
  const [topDebatedEmployees, setTopDebatedEmployees] = useState<any[]>([]);
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
    // 1. نظام الحماية والصلاحيات
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role === 'DATA_ENTRY') {
      router.push('/assignments');
      return;
    }

    document.title = 'الرئيسية | OT Audit';
    fetchDashboardData();
  }, [startDate, endDate, router]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });

      let assignQuery = supabase.from('ot_assignments').select('*', { count: 'exact', head: true });
      let calcQuery = supabase.from('ot_calculations').select(`status, exception_type, emp_number, date, employees(name, companies(name))`);

      if (startDate) { assignQuery = assignQuery.gte('date', startDate); calcQuery = calcQuery.gte('date', startDate); }
      if (endDate) { assignQuery = assignQuery.lte('date', endDate); calcQuery = calcQuery.lte('date', endDate); }

      const { count: assignCount } = await assignQuery;
      const { data: calculations } = await calcQuery;

      let matched = 0;
      let exceptions = 0;
      const exceptionCounts: Record<string, number> = {};
      const empExceptionsMap: Record<string, any> = {};

      if (calculations) {
        calculations.forEach((calc: any) => {
          if (calc.status === 'MATCHED') {
            matched++;
          } else {
            exceptions++;
            exceptionCounts[calc.exception_type] = (exceptionCounts[calc.exception_type] || 0) + 1;
            
            if (!empExceptionsMap[calc.emp_number]) {
              empExceptionsMap[calc.emp_number] = { emp_number: calc.emp_number, name: calc.employees?.name || 'غير معروف', company: calc.employees?.companies?.name || '-', count: 0 };
            }
            empExceptionsMap[calc.emp_number].count += 1;
          }
        });
      }

      const chartData = Object.keys(exceptionCounts).map(key => ({ name: key, value: exceptionCounts[key] })).sort((a, b) => b.value - a.value);
      const topEmployees = Object.values(empExceptionsMap).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

      setStats({ totalEmployees: empCount || 0, totalAssignments: assignCount || 0, matchedRecords: matched, exceptionRecords: exceptions });
      setExceptionData(chartData);
      setTopDebatedEmployees(topEmployees);

    } catch (error) { console.error('Error fetching dashboard data:', error); } 
    finally { setLoading(false); }
  }

  const COLORS = ['#10b981', '#ef4444'];
  const pieData = [
    { name: 'مطابق (سليم)', value: stats.matchedRecords },
    { name: 'استثناء (مرفوض)', value: stats.exceptionRecords }
  ];

  const handlePieClick = (data: any) => {
    if (data.name.includes('مطابق')) router.push('/audit?status=MATCHED');
    else router.push('/audit?status=EXCEPTION');
  };

  const handleBarClick = (data: any) => {
    router.push(`/audit?status=EXCEPTION&type=${encodeURIComponent(data.name)}`);
  };

  return (
    <div className="flex flex-col space-y-8 pb-10">
      
      <div className="bg-gradient-to-l from-[var(--color-navy-900)] to-[var(--color-navy-500)] p-8 rounded-2xl shadow-lg text-white relative overflow-hidden mt-2">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">أهلاً بك في نظام OT Audit</h1>
          <p className="text-blue-100 text-lg max-w-2xl">لوحة تحكم تفاعلية توفر لك رؤية عميقة لساعات العمل الإضافي.</p>
        </div>
        <div className="absolute left-0 top-0 opacity-10 transform -translate-x-1/4 -translate-y-1/4"><TrendingUp size={200} /></div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-[var(--color-navy-900)] mb-4 flex items-center gap-2">الوصول السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <Link href="/audit" className="bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-emerald-400 hover:shadow-md transition group flex flex-col items-center text-center gap-3">
            <div className="bg-emerald-50 p-4 rounded-full text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition transform group-hover:scale-110"><ShieldCheck size={28} /></div>
            <span className="font-bold text-gray-700 group-hover:text-emerald-700">المطابقة والتدقيق</span>
          </Link>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-[var(--color-navy-900)] flex items-center gap-2"><Filter size={20} className="text-[var(--color-navy-500)]" /> نطاق البيانات</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">من:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-1.5 px-3">
            <span className="text-sm font-semibold text-gray-600">إلى:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-[var(--color-navy-800)]" />
          </div>
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-sm text-blue-600 hover:text-blue-800 font-bold transition underline">عرض كل الأوقات</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-blue-500 transform transition hover:-translate-y-1 hover:shadow-md">
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">إجمالي الموظفين</p><h3 className="text-3xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalEmployees}</h3></div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Users size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-purple-500 transform transition hover:-translate-y-1 hover:shadow-md">
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">عدد التكليفات بالفترة</p><h3 className="text-3xl font-black text-[var(--color-navy-900)]">{loading ? '...' : stats.totalAssignments}</h3></div>
            <div className="bg-purple-50 p-3 rounded-xl text-purple-600"><Clock size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=MATCHED')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">السجلات المطابقة</p><h3 className="text-3xl font-black text-green-600">{loading ? '...' : stats.matchedRecords}</h3></div>
            <div className="bg-green-50 p-3 rounded-xl text-green-600"><CheckCircle size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500 transform transition hover:-translate-y-1 hover:shadow-md cursor-pointer" onClick={() => router.push('/audit?status=EXCEPTION')}>
          <div className="flex justify-between items-start">
            <div><p className="text-gray-500 text-sm font-bold mb-1">الاستثناءات (مرفوض)</p><h3 className="text-3xl font-black text-red-600">{loading ? '...' : stats.exceptionRecords}</h3></div>
            <div className="bg-red-50 p-3 rounded-xl text-red-600"><FileWarning size={24} /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border lg:col-span-1">
          <h3 className="text-lg font-bold text-[var(--color-navy-900)] mb-6 border-b pb-2 flex items-center gap-2"><PieChart size={18} /> نسبة المطابقة للفترة</h3>
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
          <h3 className="text-lg font-bold text-[var(--color-navy-900)] mb-6 border-b pb-2 flex items-center gap-2"><BarChart size={18} /> تحليل أسباب الاستثناءات</h3>
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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b bg-red-50 flex justify-between items-center">
          <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle size={20} /> الموظفين الأكثر تسجيلاً للاستثناءات (Top 5)</h3>
          <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">يجب مراجعة هؤلاء الموظفين</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-white border-b text-gray-600 text-sm">
                <th className="p-4 font-bold">الرقم</th><th className="p-4 font-bold">اسم الموظف</th><th className="p-4 font-bold">الشركة</th><th className="p-4 font-bold text-center">عدد الاستثناءات المرفوضة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr> : 
               topDebatedEmployees.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">لا توجد أي استثناءات مسجلة للفترة المحددة. الأداء ممتاز!</td></tr> :
               topDebatedEmployees.map((emp, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/audit?search=${emp.emp_number}`)}>
                    <td className="p-4 font-medium text-gray-800">{emp.emp_number}</td>
                    <td className="p-4 font-black text-[var(--color-navy-800)]">{emp.name}</td>
                    <td className="p-4 text-sm font-bold text-gray-600"><span className="bg-gray-100 px-2 py-1 rounded">{emp.company}</span></td>
                    <td className="p-4 text-center"><span className="inline-flex items-center justify-center bg-red-100 text-red-700 w-8 h-8 rounded-full font-black">{emp.count}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}