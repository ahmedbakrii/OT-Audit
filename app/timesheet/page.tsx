'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, FileSpreadsheet, Building2, Download, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter, useSearchParams } from 'next/navigation';

// مكون فرعي للتعامل مع الـ Search Params بداخل Suspense (مطلوب في Next.js 13+)
function TimesheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const [companies, setCompanies] = useState<any[]>([]);
  
  // التقاط القيم من الإشعار (الـ URL) إن وجدت
  const paramCompany = searchParams.get('company') || '';
  const paramMonth = searchParams.get('month') ? parseInt(searchParams.get('month') as string) : new Date().getMonth() + 1;
  const paramYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string) : new Date().getFullYear();

  const [filterCompany, setFilterCompany] = useState<string>(paramCompany);
  const [genMonth, setGenMonth] = useState<number>(paramMonth);
  const [genYear, setGenYear] = useState<number>(paramYear);

  const [isExporting, setIsExporting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  useEffect(() => {
    document.title = 'توليد التايم شيت النهائي | OT Audit';
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
      // 1. جلب البيانات مع الحقول الإضافية المطلوبة للـ Templates
      let query = supabase.from('ot_calculations')
        .select(`emp_number, date, final_approved_hours, employees!inner(name, job_title, iqama_number, department_id, departments(name), companies(name))`)
        .eq('month', genMonth)
        .eq('year', genYear)
        .eq('employees.companies.name', filterCompany)
        .in('status', ['MATCHED', 'RESOLVED'])
        .gt('final_approved_hours', 0);

      if (userRole === 'MANAGER' && userDeptId) {
        query = query.eq('employees.department_id', userDeptId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        showToast(`لا توجد ساعات عمل معتمدة لشركة ${filterCompany} في هذا الشهر.`, 'error');
        setIsExporting(false); return;
      }

      // 2. حساب عدد أيام الشهر وأيام الجمعة (Dynamic Calendar)
      const daysInMonth = new Date(genYear, genMonth, 0).getDate();
      const fridays: number[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(genYear, genMonth - 1, d).getDay() === 5) {
          fridays.push(d);
        }
      }

      // 3. بناء الـ Pivot لكل موظف
      const empMap = new Map();
      data.forEach((record: any) => {
         const empNum = record.emp_number;
         const dayOfMonth = new Date(record.date).getDate();
         
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

      // 4. تحديد ترتيب الأعمدة بناءً على نوع الشركة
      const exportDataAOA: any[][] = []; // Array of Arrays for precise Excel control
      let headers: any[] = [];
      let baseColsCount = 0;

      if (filterCompany === 'Jawhara') {
        headers = ['م', 'رقم الموظف', 'الاسم', 'رقم الإقامة', 'المسمى الوظيفي', 'الورشة'];
        baseColsCount = headers.length;
      } else if (filterCompany === 'Contractor') {
        headers = ['م', 'الاسم', 'الإقامة', 'المؤسسة', 'الرقم الوظيفي', 'الوظيفة'];
        baseColsCount = headers.length;
      } else {
        // Energia Template
        headers = ['م', 'الاسم', 'رقم الموظف'];
        baseColsCount = headers.length;
      }

      // إضافة أعمدة الأيام
      for (let i = 1; i <= daysInMonth; i++) headers.push(i);
      // إضافة عمود المجموع
      const totalColName = filterCompany === 'Energia' ? 'TOTAL' : 'الإجمالي';
      headers.push(totalColName);
      
      exportDataAOA.push(headers);

      // 5. تعبئة بيانات الموظفين
      const sortedEmps = Array.from(empMap.values()).sort((a: any, b: any) => a.empNumber.localeCompare(b.empNumber));
      
      sortedEmps.forEach((emp: any, index: number) => {
        let row: any[] = [];
        
        if (filterCompany === 'Jawhara') {
          row = [index + 1, emp.empNumber, emp.name, emp.iqama, emp.jobTitle, emp.workshop];
        } else if (filterCompany === 'Contractor') {
          row = [index + 1, emp.name, emp.iqama, emp.company, emp.empNumber, emp.jobTitle];
        } else {
          // Energia
          row = [index + 1, emp.name, emp.empNumber];
        }

        for (let d = 1; d <= daysInMonth; d++) {
          row.push(emp.days[d] || ''); // فارغ إذا لم يعمل في هذا اليوم
        }
        row.push(emp.totalHours);
        
        exportDataAOA.push(row);
      });

      // 6. إنشاء ملف الإكسل والتنسيق
      const ws = XLSX.utils.aoa_to_sheet(exportDataAOA);
      
      // تنسيقات الـ Sheet (RTL و تجميد الهيدر)
      ws['!dir'] = 'rtl';
      ws['!freeze'] = { ySplit: 1 }; // تجميد الصف الأول
      
      // ضبط عرض الأعمدة التقريبي
      ws['!cols'] = Array(headers.length).fill({ wch: 6 }); // الأيام والميم
      ws['!cols'][1] = { wch: 25 }; // عرض خانة الاسم غالباً في الاندكس 1 أو 2
      ws['!cols'][2] = { wch: 20 };

      // تلوين أيام الجمعة (سيعمل في المكتبات الداعمة للستايلز)
      for (let R = 0; R < exportDataAOA.length; R++) {
        for (let d = 1; d <= daysInMonth; d++) {
          if (fridays.includes(d)) {
            const colIndex = baseColsCount + d - 1;
            const cellRef = XLSX.utils.encode_cell({ r: R, c: colIndex });
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }; // حماية للخلايا الفارغة
            ws[cellRef].s = { 
              fill: { fgColor: { rgb: "FFFFFF00" } }, // أصفر
              font: { bold: R === 0 }
            };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
      
      const fileName = `${filterCompany}_Timesheet_${genYear}_${genMonth.toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // 7. إدارة الإشعارات (منع التكرار والتوجيه الذكي)
      const notifTitle = 'تم إصدار تايم شيت جديد';
      const notifBody = `تم إصدار التايم شيت النهائي لشركة ${filterCompany} عن شهر ${monthsAr[genMonth - 1]} ${genYear}.\nبواسطة: ${userName}`;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // التحقق من عدم التكرار اليوم لنفس التايم شيت
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('title', notifTitle)
        .eq('body', notifBody)
        .gte('created_at', todayStart.toISOString())
        .maybeSingle();

      if (!existingNotif) {
        // حفظ الإشعار برابط ديناميكي (يتم قراءته من قبل صفحة الإشعارات)
        // أضفنا meta_data للـ URL لو حبيت تستخدمها، أو يمكن لصفحة الإشعارات استنتاجها
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
    <div className="flex flex-col space-y-6 relative pb-10 animate-in fade-in">
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
          يتم تجميع الساعات المعتمدة فقط من شاشة (إدارة التعارضات) واستخراج شيت إكسل جاهز للدفع، مفصول لكل شركة على حدة.
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
            disabled={isExporting || !filterCompany || userRole === 'DATA_ENTRY'} 
            className="flex items-center gap-3 bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition disabled:opacity-50 font-black shadow-lg text-lg"
          >
            <Download size={24} />
            <span>{isExporting ? 'جاري التجهيز...' : 'إصدار ملف الـ Timesheet'}</span>
          </button>
        </div>
        {userRole === 'DATA_ENTRY' && <p className="text-red-500 text-sm font-bold mt-4 text-left">غير مصرح لمدخل البيانات باستخراج التايم شيت النهائي.</p>}
      </div>
    </div>
  );
}

// التغليف بـ Suspense لضمان عمل useSearchParams بدون أخطاء في الـ Build
export default function TimesheetPageWrapper() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-gray-500">جاري تحميل لوحة الإصدار...</div>}>
      <TimesheetContent />
    </Suspense>
  );
}