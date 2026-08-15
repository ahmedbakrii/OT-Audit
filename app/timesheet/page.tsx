'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, FileSpreadsheet, Building2, Download, CheckSquare, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter, useSearchParams } from 'next/navigation';

function TimesheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const [companies, setCompanies] = useState<any[]>([]);
  
  const paramCompany = searchParams.get('company') || '';
  const paramMonth = searchParams.get('month') ? parseInt(searchParams.get('month') as string) : new Date().getMonth() + 1;
  const paramYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string) : new Date().getFullYear();

  const [filterCompany, setFilterCompany] = useState<string>(paramCompany);
  const [genMonth, setGenMonth] = useState<number>(paramMonth);
  const [genYear, setGenYear] = useState<number>(paramYear);

  const [isExporting, setIsExporting] = useState(false);

  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{name: string, empNumber: string, dates: string[]}[]>([]);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  useEffect(() => {
    document.title = 'توليد التايم شيت  | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserName(user.name);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) setUserDeptId(data.department_id);
      
      const { data: comps } = await supabase.from('companies').select('id, name');
      if (comps) setCompanies(comps);
    }
    initUser();
  }, [router]);

  const exportFinalTimesheet = async () => {
    if (!filterCompany) return showToast('برجاء تحديد الشركة المراد تصدير التايم شيت الخاص بها.', 'error');
    setIsExporting(true);

    try {
      let conflictQuery = supabase.from('ot_calculations')
        .select(`date, emp_number, employees!inner(name, department_id, companies(name))`)
        .eq('month', genMonth)
        .eq('year', genYear)
        .eq('status', 'CONFLICT');

      if (userRole === 'MANAGER' && userDeptId) {
        conflictQuery = conflictQuery.eq('employees.department_id', userDeptId);
      }

      const { data: conflictsData, error: conflictErr } = await conflictQuery;
      if (conflictErr) throw conflictErr;

      // 🔴 الضربة القاضية لـ TypeScript عشان يتجاهل الأخطاء العبيطة دي
      const safeConflictsData = (conflictsData as any[]) || [];
      
      const exactCompanyConflicts = safeConflictsData.filter((c: any) => {
        const empInfo = Array.isArray(c.employees) ? c.employees[0] : c.employees;
        return empInfo?.companies?.name === filterCompany;
      });

      if (exactCompanyConflicts.length > 0) {
        const conflictsMap = new Map();
        exactCompanyConflicts.forEach((c: any) => {
           if (!conflictsMap.has(c.emp_number)) {
             const empInfo = Array.isArray(c.employees) ? c.employees[0] : c.employees;
             conflictsMap.set(c.emp_number, { name: empInfo?.name, empNumber: c.emp_number, dates: [] });
           }
           const d = new Date(c.date);
           conflictsMap.get(c.emp_number).dates.push(`${d.getDate()} ${monthsAr[d.getMonth()]}`);
        });

        const groupedConflicts = Array.from(conflictsMap.values());
        setConflictDetails(groupedConflicts);
        setShowConflictModal(true);
        setIsExporting(false);

        if (userRole === 'DATA_ENTRY') {
            const notifTitle = '⚠️ تعارضات تعيق إصدار التايم شيت';
            const empNamesString = groupedConflicts.map(c => c.name).join('، ');
            const notifBody = `حاول مدخل البيانات إصدار التايم شيت لشركة ${filterCompany} ولكن تم إيقافه لوجود تعارضات معلقة. يرجى المراجعة والاعتماد للموظفين: (${empNamesString}).`;

            await supabase.from('notifications').insert([{
            title: notifTitle,
            body: notifBody,
            department_id: userDeptId, 
            target_url: `/audit?status=CONFLICT`
            }]);

            window.dispatchEvent(new Event('new_notification'));
        }
        return; 
      }

      let query = supabase.from('ot_calculations')
        .select(`emp_number, date, final_approved_hours, employees!inner(name, job_title, iqama_number, department_id, departments(name), companies(name))`)
        .eq('month', genMonth)
        .eq('year', genYear)
        .in('status', ['MATCHED', 'RESOLVED'])
        .gt('final_approved_hours', 0); 

      if (userRole === 'MANAGER' && userDeptId) {
        query = query.eq('employees.department_id', userDeptId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 🔴 الضربة القاضية التانية لـ TypeScript هنا كمان
      const safeData = (data as any[]) || [];

      const exactCompanyData = safeData.filter((r: any) => {
        const empInfo = Array.isArray(r.employees) ? r.employees[0] : r.employees;
        return empInfo?.companies?.name === filterCompany;
      });

      if (!exactCompanyData || exactCompanyData.length === 0) {
        showToast(`لا توجد ساعات عمل معتمدة لشركة ${filterCompany} في هذا الشهر.`, 'error');
        setIsExporting(false); return;
      }

      const daysInMonth = new Date(genYear, genMonth, 0).getDate();
      const fridays: number[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(genYear, genMonth - 1, d).getDay() === 5) {
          fridays.push(d);
        }
      }

      const empMap = new Map();
      exactCompanyData.forEach((record: any) => {
         const empNum = record.emp_number;
         const dayOfMonth = new Date(record.date + 'T12:00:00Z').getDate();
         
         if(!empMap.has(empNum)) {
             const empInfo = Array.isArray(record.employees) ? record.employees[0] : record.employees;
             empMap.set(empNum, {
                 empNumber: empNum,
                 name: empInfo?.name || 'غير معروف',
                 iqama: empInfo?.iqama_number || '-',
                 jobTitle: empInfo?.job_title || '-',
                 workshop: empInfo?.departments?.name || '-',
                 company: empInfo?.companies?.name || '-',
                 days: {},
                 totalHours: 0
             });
         }
         
         const empData = empMap.get(empNum);
         empData.days[dayOfMonth] = (empData.days[dayOfMonth] || 0) + record.final_approved_hours;
         empData.totalHours += record.final_approved_hours;
      });

      const exportDataAOA: any[][] = []; 
      let headers: any[] = [];
      let baseColsCount = 0;

      if (filterCompany === 'Jawhara' || filterCompany === 'جواهر') {
        headers = ['م', 'رقم الموظف', 'الاسم', 'رقم الإقامة', 'المسمى الوظيفي', 'الورشة'];
        baseColsCount = headers.length;
      } else if (filterCompany === 'Contractor' || filterCompany.includes('مقاول')) {
        headers = ['م', 'الاسم', 'الإقامة', 'المؤسسة', 'الرقم الوظيفي', 'الوظيفة'];
        baseColsCount = headers.length;
      } else {
        headers = ['م', 'الاسم', 'رقم الموظف'];
        baseColsCount = headers.length;
      }

      for (let i = 1; i <= daysInMonth; i++) headers.push(i);
      const totalColName = filterCompany === 'Energia' || filterCompany.includes('انيرجيا') ? 'TOTAL' : 'الإجمالي';
      headers.push(totalColName);
      
      exportDataAOA.push(headers);

      const sortedEmps = Array.from(empMap.values()).sort((a: any, b: any) => a.empNumber.localeCompare(b.empNumber));
      
      sortedEmps.forEach((emp: any, index: number) => {
        let row: any[] = [];
        
        if (filterCompany === 'Jawhara' || filterCompany === 'جواهر') {
          row = [index + 1, emp.empNumber, emp.name, emp.iqama, emp.jobTitle, emp.workshop];
        } else if (filterCompany === 'Contractor' || filterCompany.includes('مقاول')) {
          row = [index + 1, emp.name, emp.iqama, emp.company, emp.empNumber, emp.jobTitle];
        } else {
          row = [index + 1, emp.name, emp.empNumber];
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const val = emp.days[d];
          row.push(val !== undefined ? val : 0); 
        }
        row.push(emp.totalHours);
        
        exportDataAOA.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(exportDataAOA);
      
      ws['!dir'] = 'rtl';
      ws['!freeze'] = { ySplit: 1 }; 
      
      ws['!cols'] = Array(headers.length).fill({ wch: 6 }); 
      ws['!cols'][1] = { wch: 25 }; 
      ws['!cols'][2] = { wch: 20 };

      for (let R = 0; R < exportDataAOA.length; R++) {
        for (let d = 1; d <= daysInMonth; d++) {
          if (fridays.includes(d)) {
            const colIndex = baseColsCount + d - 1;
            const cellRef = XLSX.utils.encode_cell({ r: R, c: colIndex });
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }; 
            ws[cellRef].s = { 
              fill: { fgColor: { rgb: "FFFFFF00" } }, 
              font: { bold: R === 0 }
            };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
      
      const fileName = `${filterCompany}_Timesheet_${genYear}_${genMonth.toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      const notifTitle = '✅ تم إصدار تايم شيت جديد';
      const notifBody = `تم إصدار التايم شيت النهائي لشركة ${filterCompany} عن شهر ${monthsAr[genMonth - 1]} ${genYear}.\nبواسطة: ${userName}`;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('title', notifTitle)
        .eq('body', notifBody)
        .gte('created_at', todayStart.toISOString())
        .maybeSingle();

      if (!existingNotif) {
        await supabase.from('notifications').insert([{
          title: notifTitle,
          body: notifBody,
          department_id: userRole === 'MANAGER' ? userDeptId : null
        }]);
        window.dispatchEvent(new Event('new_notification'));
      }

      showToast(`تم تحميل التايم شيت النهائي لشركة ${filterCompany} بنجاح.`, 'success');

    } catch (error) {
      console.error(error); showToast('حدث خطأ أثناء استخراج التايم شيت.', 'error');
    } finally { setIsExporting(false); }
  };

  return (
    <div className="relative w-full min-h-screen">
      
      <div className="flex flex-col space-y-6 pb-10 animate-in fade-in">
        
        {toast.show && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-md border-t-4 border-[var(--color-navy-500)]">
          <h1 className="text-3xl font-black text-[var(--color-navy-900)] mb-2 flex items-center gap-3">
            <FileSpreadsheet className="text-[var(--color-navy-500)]" size={32} />
            إصدار التايم شيت النهائي
          </h1>
          <p className="text-gray-500 text-base mb-8">
            يتم تجميع الساعات المعتمدة فقط من شاشة (إدارة المطابقة) واستخراج شيت إكسل جاهز للصرف، مفصول لكل شركة على حدة.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Building2 size={16}/> اختر الشركة للطباعة</label>
              <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500">
                <option value="">-- يرجى تحديد الشركة --</option>
                {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><CheckSquare size={16}/> الشهر</label>
              <select value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500">
                {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{monthsAr[i]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><CheckSquare size={16}/> السنة</label>
              <select value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg p-3 outline-none font-bold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500">
                {Array.from({length: 10}, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={exportFinalTimesheet} 
              disabled={isExporting || !filterCompany} 
              className="flex items-center gap-3 bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition disabled:opacity-50 font-black shadow-lg text-lg"
            >
              <Download size={24} />
              <span>{isExporting ? 'جاري التجهيز...' : 'إصدار ملف الـ Timesheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {showConflictModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="bg-red-50 p-6 border-b border-red-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-red-700 flex items-center gap-2">
                  <AlertCircle size={24} /> إجراء محظور: تعارضات معلقة بـ {filterCompany}!
                </h2>
                {userRole === 'DATA_ENTRY' ? (
                  <p className="text-sm text-red-600 mt-2 font-bold leading-relaxed">
                    لا يمكن إصدار التايم شيت لوجود أيام بها مشاكل ولم تُعتمد من قبل المدير. <br/>
                    تم إرسال إشعار للمدير المختص للمراجعة والاعتماد.
                  </p>
                ) : (
                  <p className="text-sm text-red-600 mt-2 font-bold leading-relaxed">
                    عفواً، لا يمكن إصدار التايم شيت النهائي لوجود أيام بها مشاكل ولم تُعتمد بعد. <br/>
                    يمكنك الذهاب للوحة المطابقة لحلها الآن.
                  </p>
                )}
              </div>
              <button onClick={() => setShowConflictModal(false)} className="text-gray-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto bg-gray-50">
              <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">الموظفين المطلوب مراجعتهم في {filterCompany}:</h3>
              <div className="grid gap-3">
                {conflictDetails.map((emp, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-black text-[var(--color-navy-800)]">{emp.name}</h4>
                      <p className="text-xs font-bold text-gray-500 mt-1">الرقم الوظيفي: {emp.empNumber}</p>
                    </div>
                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-bold w-full md:w-auto text-left leading-relaxed">
                      أيام التعارض: {emp.dates.join('، ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t bg-white flex justify-end gap-3">
              <button onClick={() => setShowConflictModal(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-bold transition">إغلاق وتفهم</button>
              
              {userRole !== 'DATA_ENTRY' && (
                <button onClick={() => router.push('/audit?status=CONFLICT')} className="px-6 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition shadow-md">
                  الذهاب للوحة المطابقة لحل المشاكل
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function TimesheetPageWrapper() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-gray-500">جاري تحميل لوحة الإصدار...</div>}>
      <TimesheetContent />
    </Suspense>
  );
}