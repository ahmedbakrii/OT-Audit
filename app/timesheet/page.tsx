'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, FileSpreadsheet, Building2, Download, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function TimesheetPage() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState<string>('');
  
  const [genMonth, setGenMonth] = useState<number>(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    document.title = 'توليد التايم شيت النهائي | OT Audit';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);

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
      let query = supabase.from('ot_calculations')
        .select(`emp_number, final_approved_hours, employees!inner(name, department_id, companies(name))`)
        .eq('month', genMonth)
        .eq('year', genYear)
        .eq('employees.companies.name', filterCompany)
        .in('status', ['MATCHED', 'RESOLVED']) // يعتمد السليم والمحلول فقط
        .gt('final_approved_hours', 0); // اللي ليه ساعات بس

      if (userRole === 'MANAGER' && userDeptId) {
        query = query.eq('employees.department_id', userDeptId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        showToast(`لا توجد ساعات عمل معتمدة لشركة ${filterCompany} في هذا الشهر.`, 'error');
        setIsExporting(false); return;
      }

      // تجميع الساعات لكل موظف خلال الشهر (تم إضافة any لتخطي خطأ Typescript)
      const empSummary = new Map();
      data.forEach((record: any) => {
         const empNum = record.emp_number;
         if(!empSummary.has(empNum)) {
             // تحديد إننا بناخد الاسم سواء كان كائن أو مصفوفة
             const empName = Array.isArray(record.employees) ? record.employees[0]?.name : record.employees?.name;
             empSummary.set(empNum, {
                 'الرقم الوظيفي': empNum,
                 'اسم الموظف': empName || 'غير معروف',
                 'إجمالي ساعات الأوفر تايم': 0
             });
         }
         empSummary.get(empNum)['إجمالي ساعات الأوفر تايم'] += record.final_approved_hours;
      });

      const exportData = Array.from(empSummary.values());

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "التايم شيت");
      
      const fileName = `Timesheet_${filterCompany}_${genMonth}_${genYear}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showToast(`تم تحميل التايم شيت النهائي لشركة ${filterCompany} بنجاح.`, 'success');

    } catch (error) {
      console.error(error); showToast('حدث خطأ أثناء استخراج التايم شيت.', 'error');
    } finally { setIsExporting(false); }
  };

  return (
    <div className="flex flex-col space-y-6 relative pb-10">
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
              {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
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
            <span>{isExporting ? 'جاري تجهيز الملف...' : 'تحميل الإكسل النهائي للشركة'}</span>
          </button>
        </div>
        {userRole === 'DATA_ENTRY' && <p className="text-red-500 text-sm font-bold mt-4 text-left">غير مصرح لمدخل البيانات باستخراج التايم شيت النهائي.</p>}
      </div>
    </div>
  );
}