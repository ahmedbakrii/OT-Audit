'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, CalendarDays, X, Save, FileClock, User, Settings2, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function TimesheetPage() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [imports, setImports] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // إعدادات التوليد
  const [genMonth, setGenMonth] = useState<number>(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear());
  const [filterCompany, setFilterCompany] = useState<string>('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    month: number;
    year: number;
    records: any[];
    summary: { empNumber: string, empName: string, totalHours: number, company: string }[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'التايم شيت | OT Audit';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
      }
      fetchLookups();
      fetchImportsHistory(user.role, data?.department_id);
      fetchAllEmployees(user.role, data?.department_id);
    }
    initUser();
  }, [router]);

  async function fetchLookups() {
    const { data } = await supabase.from('companies').select('id, name');
    if (data) setCompanies(data);
  }

  async function fetchAllEmployees(role: string | null, deptId: string | null) {
    let query = supabase.from('employees').select('emp_number, name, company_id, companies(name), shifts(name)');
    if ((role === 'MANAGER' || role === 'DATA_ENTRY') && deptId) {
      query = query.eq('department_id', deptId);
    }
    const { data } = await query;
    if (data) setDbEmployees(data);
  }

  async function fetchImportsHistory(role: string | null, deptId: string | null) {
    try {
      setLoading(true);
      let query = supabase.from('timesheet_imports').select(`*`).order('created_at', { ascending: false });
      
      if ((role === 'MANAGER' || role === 'DATA_ENTRY') && deptId) {
        query = query.eq('department_id', deptId);
      }

      const { data, error } = await query;
      // تجاهل خطأ عدم وجود جدول (عشان الـ Error الصامت)
      if (error && error.code !== '42P01') throw error;
      setImports(data || []);
    } catch (error) { console.log(error); } finally { setLoading(false); }
  }

  // --- التوليد الذكي للتايم شيت (للمدير والأدمن فقط) ---
  const autoGenerateTimesheet = async () => {
    if (userRole === 'DATA_ENTRY') return showToast('غير مصرح لك بتوليد التايم شيت آلياً.', 'error');
    if (!confirm(`هل أنت متأكد من توليد تايم شيت آلي لشهر ${genMonth}/${genYear} ${filterCompany ? `لشركة ${filterCompany}` : 'لجميع الشركات'}؟`)) return;
    
    setIsGenerating(true);

    try {
      const startDate = `${genYear}-${String(genMonth).padStart(2, '0')}-01`;
      const endDate = `${genYear}-${String(genMonth).padStart(2, '0')}-31`;

      let assignQuery = supabase.from('ot_assignments').select(`date, day_end_time, night_end_time, ot_assignment_employees(emp_number)`).gte('date', startDate).lte('date', endDate);
      if (userDeptId && userRole !== 'ADMIN' && userRole !== 'FACTORY_MANAGER') {
        assignQuery = assignQuery.eq('department_id', userDeptId);
      }
      const { data: assignments } = await assignQuery;

      let attendQuery = supabase.from('attendance_records').select(`emp_number, date, first_in, last_out, employees!inner(department_id)`).gte('date', startDate).lte('date', endDate);
      if (userDeptId && userRole !== 'ADMIN' && userRole !== 'FACTORY_MANAGER') {
        attendQuery = attendQuery.eq('employees.department_id', userDeptId);
      }
      const { data: attendances } = await attendQuery;

      if (!assignments || assignments.length === 0) {
        showToast('لا يوجد تكليفات معتمدة في هذا الشهر لتوليد التايم شيت.', 'error');
        setIsGenerating(false); return;
      }

      const getMins = (timeStr: string) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const generatedRecords: any[] = [];
      const summaryMap = new Map();

      assignments.forEach(assign => {
        assign.ot_assignment_employees.forEach((emp: any) => {
          const empNum = emp.emp_number;
          const targetEmp = dbEmployees.find(e => e.emp_number === empNum);
          if (!targetEmp) return; 

          // فلتر الشركة
          if (filterCompany && targetEmp.companies?.name !== filterCompany) return;

          const shift = targetEmp.shifts?.name || '';
          const isNight = shift.includes('ليل') || shift.includes('مسا');
          const basicEndStr = isNight ? '04:00' : '16:00';
          const assignEndStr = (isNight ? assign.night_end_time : assign.day_end_time)?.substring(0, 5);

          const assignDiffMins = getMins(assignEndStr) - getMins(basicEndStr);
          const assignedOTHours = (assignDiffMins < 0 ? assignDiffMins + (24*60) : assignDiffMins) / 60;

          const attendance = attendances?.find(a => a.emp_number === empNum && a.date === assign.date);
          let actualOTHours = 0;

          if (attendance && attendance.last_out) {
             const actualOutStr = new Date(attendance.last_out).toISOString().substring(11, 16);
             const actualDiffMins = getMins(actualOutStr) - getMins(basicEndStr);
             actualOTHours = (actualDiffMins < 0 ? actualDiffMins + (24*60) : actualDiffMins) / 60;
          }

          let finalHoursToRecord = 0;
          
          if (actualOTHours > 0 && assignedOTHours > 0) {
             if (actualOTHours < assignedOTHours) {
                const diffInMins = (assignedOTHours - actualOTHours) * 60;
                if (diffInMins <= 20) {
                   finalHoursToRecord = assignedOTHours; 
                } else {
                   finalHoursToRecord = actualOTHours; 
                }
             } else {
                finalHoursToRecord = assignedOTHours;
             }
          }

          if (finalHoursToRecord > 0) {
            finalHoursToRecord = Math.round(finalHoursToRecord * 10) / 10; 

            generatedRecords.push({
              empNumber: empNum,
              day: parseInt(assign.date.split('-')[2]),
              hours: finalHoursToRecord
            });

            if (!summaryMap.has(empNum)) {
               summaryMap.set(empNum, { empNumber: empNum, empName: targetEmp.name, company: targetEmp.companies?.name || '-', totalHours: 0 });
            }
            summaryMap.get(empNum).totalHours += finalHoursToRecord;
          }
        });
      });

      if (generatedRecords.length === 0) {
        showToast('لم يتم العثور على أي بيانات مطابقة (بصمة + تكليف) لتوليد الساعات لـ ' + (filterCompany ? filterCompany : 'للقسم كله') + '.', 'error');
        setIsGenerating(false); return;
      }

      setPreviewData({
        fileName: `Generated_${filterCompany || 'All'}_Timesheet_${genMonth}_${genYear}.xlsx`,
        month: genMonth,
        year: genYear,
        records: generatedRecords,
        summary: Array.from(summaryMap.values()).sort((a, b) => {
          if (a.company < b.company) return -1;
          if (a.company > b.company) return 1;
          return b.totalHours - a.totalHours;
        })
      });
      
      setShowPreview(true);
      showToast('تم التوليد بنجاح! راجع الساعات واضغط حفظ.', 'success');

    } catch (error) {
      console.error(error); showToast('حدث خطأ أثناء التوليد الذكي.', 'error');
    } finally { setIsGenerating(false); }
  };

  // --- خوارزمية قراءة شيت الإكسل (اليدوي القديم) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRowIndex = -1;
        let daysColumns: { day: number, colIndex: number }[] = [];
        let empNumberColIndex = -1;

        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i];
          if (!row) continue;
          
          let foundDays = 0;
          let tempDaysCols = [];
          
          for (let j = 0; j < row.length; j++) {
            const cellValue = String(row[j]).trim();
            if (/^([1-9]|[12][0-9]|3[01])$/.test(cellValue)) {
              foundDays++;
              tempDaysCols.push({ day: parseInt(cellValue), colIndex: j });
            }
            if (cellValue.includes('رقم') || cellValue.includes('ID') || cellValue.includes('كود')) {
              empNumberColIndex = j;
            }
          }

          if (foundDays >= 20) {
            headerRowIndex = i;
            daysColumns = tempDaysCols;
            break;
          }
        }

        if (headerRowIndex === -1) {
          showToast('لم يتم العثور على هيكل التايم شيت (أيام الشهر).', 'error');
          setIsUploading(false); return;
        }

        if (empNumberColIndex === -1) empNumberColIndex = 0;

        const allRecords = [];
        const summaryMap = new Map();

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let empNum = String(row[empNumberColIndex] || '').trim();
          if (!/^\d{4,6}$/.test(empNum)) continue;

          let totalEmpHours = 0;

          for (const dayCol of daysColumns) {
            const hoursVal = parseFloat(row[dayCol.colIndex]);
            if (!isNaN(hoursVal) && hoursVal > 0) {
              allRecords.push({
                empNumber: empNum,
                day: dayCol.day,
                hours: hoursVal
              });
              totalEmpHours += hoursVal;
            }
          }

          if (totalEmpHours > 0) {
            const matchedEmp = dbEmployees.find(e => String(e.emp_number) === empNum);
            // فلتر الشركة للملف اليدوي كمان
            if (filterCompany && matchedEmp && matchedEmp.companies?.name !== filterCompany) continue;
            
            summaryMap.set(empNum, {
              empNumber: empNum,
              empName: matchedEmp ? matchedEmp.name : 'غير مسجل أو ليس بقسمك',
              company: matchedEmp ? matchedEmp.companies?.name : '-',
              totalHours: totalEmpHours
            });
          }
        }

        if (allRecords.length === 0) {
          showToast('الملف لا يحتوي على أي ساعات عمل تتوافق مع الشركة المحددة.', 'error');
          setIsUploading(false); return;
        }

        setPreviewData({
          fileName: file.name,
          month: genMonth,
          year: genYear,
          records: allRecords,
          summary: Array.from(summaryMap.values())
        });
        
        setShowPreview(true);

      } catch (error) {
        console.error(error); showToast('حدث خطأ أثناء قراءة الملف.', 'error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveTimesheet = async () => {
    if (!previewData) return;
    setIsUploading(true);

    try {
      const validEmpNumbers = dbEmployees.map(e => String(e.emp_number));
      const validRecords = previewData.records.filter(rec => validEmpNumbers.includes(String(rec.empNumber)));

      if (validRecords.length === 0) {
        showToast('لا يوجد أي موظف في هذا الشيت مسجل في إدارتك!', 'error');
        setIsUploading(false); return;
      }

      if (userDeptId) {
         const { data: oldImport } = await supabase.from('timesheet_imports').select('id').eq('month', previewData.month).eq('year', previewData.year).eq('department_id', userDeptId).single();
         if (oldImport) {
           await supabase.from('timesheet_records').delete().eq('import_id', oldImport.id);
           await supabase.from('timesheet_imports').delete().eq('id', oldImport.id);
         }
      }

      const { data: importRecord, error: importError } = await supabase.from('timesheet_imports').insert([{
        file_name: previewData.fileName,
        month: previewData.month,
        year: previewData.year,
        status: 'COMPLETED',
        department_id: userDeptId 
      }]).select().single();

      if (importError) throw importError;

      const formattedRecords = validRecords.map(rec => {
        const fullDate = `${previewData.year}-${String(previewData.month).padStart(2, '0')}-${String(rec.day).padStart(2, '0')}`;
        return {
          import_id: importRecord.id,
          emp_number: rec.empNumber,
          date: fullDate,
          recorded_hours: rec.hours
        };
      });

      const { error: recordsError } = await supabase.from('timesheet_records').insert(formattedRecords);
      if (recordsError) throw recordsError;

      setShowPreview(false);
      showToast(`تم حفظ التايم شيت بنجاح!`, 'success');
      fetchImportsHistory(userRole, userDeptId);

    } catch (error: any) {
      showToast(error?.message || 'حدث خطأ أثناء الحفظ.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 relative pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800 border-r-4 border-green-500' : 'bg-red-100 text-red-800 border-r-4 border-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">سجل التايم شيت (Timesheet)</h1>
          <p className="text-gray-500 text-sm mt-1">توليد آلي ذكي أو رفع يدوي لمطالبات الأوفر تايم</p>
        </div>
        
        {userRole !== 'FACTORY_MANAGER' && (
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border shadow-inner">
            
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-500" />
              <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border border-gray-300 rounded-md p-1 outline-none font-bold bg-white text-gray-700 text-sm">
                <option value="">كل الشركات</option>
                {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">شهر:</span>
              <select value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))} className="border border-gray-300 rounded-md p-1 outline-none font-bold bg-white text-blue-800 text-sm">
                {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm font-semibold text-gray-700">سنة:</span>
              <select value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))} className="border border-gray-300 rounded-md p-1 outline-none font-bold bg-white text-blue-800 text-sm">
                {/* فتح السنين براحتك */}
                {Array.from({length: 10}, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* إخفاء زرار المطابقة الذكية عن مدخل البيانات */}
            {userRole !== 'DATA_ENTRY' && (
              <button onClick={autoGenerateTimesheet} disabled={isGenerating} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-bold shadow-md mr-2 text-sm">
                <Settings2 size={16} className={isGenerating ? 'animate-spin' : ''}/>
                <span>{isGenerating ? 'جاري المعالجة...' : 'توليد ذكي للتايم شيت'}</span>
              </button>
            )}
            
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition disabled:opacity-50 font-bold shadow-md text-sm">
              <FileSpreadsheet size={16} />
              <span>{isUploading && !showPreview ? 'انتظر...' : 'رفع ملف إكسل'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-[var(--color-navy-900)] flex items-center gap-2">
            <FileClock size={18} className="text-[var(--color-navy-500)]" />
            سجل التايم شيت المعتمد
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                <th className="p-4 font-semibold">تاريخ التنفيذ</th>
                <th className="p-4 font-semibold">اسم الملف / المصدر</th>
                <th className="p-4 font-semibold text-center">الشهر والسنة</th>
                <th className="p-4 font-semibold text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr> : 
               imports.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">لم يتم رفع أو توليد أي تايم شيت لهذه الإدارة.</td></tr> :
               imports.map((imp) => (
                  <tr key={imp.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-700 text-sm font-bold">
                      {new Date(imp.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 font-bold text-[var(--color-navy-500)] flex items-center gap-2">
                      {imp.file_name.includes('Generated') ? <Settings2 size={16} className="text-green-600"/> : <FileSpreadsheet size={16} />} 
                      {imp.file_name.includes('Generated') ? 'تم التوليد الآلي بواسطة النظام' : imp.file_name}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-sm font-bold border border-blue-200">
                        شهر {imp.month} / {imp.year}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200 shadow-sm">
                        جاهز للمطابقة
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-navy-900)]">معاينة وتأكيد الساعات المحسوبة</h2>
                <div className="text-sm text-gray-500 mt-2 flex items-center gap-4 font-semibold">
                  <span className="flex items-center gap-1"><FileClock size={14}/> {previewData.fileName}</span>
                  <span className="text-blue-600">لشهر: {previewData.month}/{previewData.year}</span>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 bg-gray-200 p-2 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 flex justify-between items-end">
                <h3 className="font-bold text-[var(--color-navy-800)] flex items-center gap-2">
                  <User size={18}/> ملخص موظفين الإدارة ({previewData.summary.length} موظف)
                </h3>
                <span className="text-sm font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full border border-green-200">
                  إجمالي الساعات: {previewData.summary.reduce((acc, curr) => acc + curr.totalHours, 0)} ساعة
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border-b font-bold">الرقم</th>
                      <th className="p-3 border-b font-bold">اسم الموظف</th>
                      <th className="p-3 border-b font-bold">الشركة</th>
                      <th className="p-3 border-b font-bold text-center">إجمالي الساعات</th>
                      <th className="p-3 border-b font-bold text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.summary.map((emp, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{emp.empNumber}</td>
                        <td className="p-3 font-bold text-[var(--color-navy-800)]">{emp.empName}</td>
                        <td className="p-3 text-xs"><span className="bg-gray-200 px-2 py-1 rounded font-bold text-gray-700">{emp.company}</span></td>
                        <td className="p-3 text-center font-black text-blue-600 text-lg">{emp.totalHours}</td>
                        <td className="p-3 text-center">
                          {emp.empName.includes('غير مسجل') ? 
                            <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200">مرفوض (إدارة أخرى)</span> : 
                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">سليم</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500">* سيتم حذف أي شيت قديم لنفس الشهر والإدارة تجنباً للتكرار.</span>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold transition border border-gray-300">إلغاء</button>
                <button onClick={saveTimesheet} disabled={isUploading} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold transition disabled:opacity-50 shadow-md">
                  <Save size={18} /><span>{isUploading ? 'جاري الاعتماد...' : 'تأكيد واعتماد التايم شيت'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}