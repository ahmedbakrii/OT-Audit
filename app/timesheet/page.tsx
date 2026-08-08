'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, CalendarDays, X, Save, FileClock, User } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function TimesheetPage() {
  const [imports, setImports] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // الإشعارات
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [showPreview, setShowPreview] = useState(false);
  
  // بيانات المعاينة
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    month: number;
    year: number;
    records: any[];
    summary: { empNumber: string, empName: string, totalHours: number }[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'التايم شيت | OT Audit';
    fetchImportsHistory();
    fetchAllEmployees();
  }, []);

  async function fetchAllEmployees() {
    const { data } = await supabase.from('employees').select('emp_number, name');
    if (data) setDbEmployees(data);
  }

  async function fetchImportsHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('timesheet_imports')
        .select(`*`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setImports(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // --- خوارزمية قراءة شيت الإكسل (Matrix Parser) ---
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

        // 1. البحث عن الصف اللي فيه أرقام الأيام (1 إلى 30 أو 31)
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i];
          if (!row) continue;
          
          let foundDays = 0;
          let tempDaysCols = [];
          
          for (let j = 0; j < row.length; j++) {
            const cellValue = String(row[j]).trim();
            // لو الخلية فيها رقم من 1 لـ 31
            if (/^([1-9]|[12][0-9]|3[01])$/.test(cellValue)) {
              foundDays++;
              tempDaysCols.push({ day: parseInt(cellValue), colIndex: j });
            }
            // استنتاج عمود رقم الموظف (غالباً قبل الأيام)
            if (cellValue.includes('رقم') || cellValue.includes('ID') || cellValue.includes('كود')) {
              empNumberColIndex = j;
            }
          }

          // لو لقينا أكتر من 20 يوم في نفس الصف، يبقى ده الـ Header
          if (foundDays >= 20) {
            headerRowIndex = i;
            daysColumns = tempDaysCols;
            break;
          }
        }

        if (headerRowIndex === -1) {
          showToast('لم يتم العثور على هيكل التايم شيت (أيام الشهر).', 'error');
          setIsUploading(false);
          return;
        }

        // لو ملقيناش عمود مكتوب عليه "رقم"، هنفترض إنه العمود 0 أو 1
        if (empNumberColIndex === -1) empNumberColIndex = 0;

        const allRecords = [];
        const summaryMap = new Map();

        // 2. استخراج الساعات للموظفين
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let empNum = String(row[empNumberColIndex] || '').trim();
          
          // تأكيد إن الخلية فيها رقم وظيفي (أرقام فقط)
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
            summaryMap.set(empNum, {
              empNumber: empNum,
              empName: matchedEmp ? matchedEmp.name : 'غير مسجل بالنظام',
              totalHours: totalEmpHours
            });
          }
        }

        if (allRecords.length === 0) {
          showToast('الملف لا يحتوي على أي ساعات عمل.', 'error');
          setIsUploading(false);
          return;
        }

        // افتراض الشهر والسنة الحاليين (ممكن نخليه يختارهم من الـ UI)
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        setPreviewData({
          fileName: file.name,
          month: currentMonth,
          year: currentYear,
          records: allRecords,
          summary: Array.from(summaryMap.values())
        });
        
        setShowPreview(true);

      } catch (error) {
        console.error(error);
        showToast('حدث خطأ أثناء قراءة الملف.', 'error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- حفظ التايم شيت في الداتابيز ---
  const saveTimesheet = async () => {
    if (!previewData) return;
    setIsUploading(true);

    try {
      // فلترة السجلات: نأخذ فقط الموظفين المسجلين في النظام 
      // (عشان الداتابيز مترفضش الحفظ بسبب موظف غريب)
      const validEmpNumbers = dbEmployees.map(e => String(e.emp_number));
      const validRecords = previewData.records.filter(rec => validEmpNumbers.includes(String(rec.empNumber)));

      if (validRecords.length === 0) {
        showToast('لا يوجد أي موظف في هذا الشيت مسجل في النظام الحالي!', 'error');
        setIsUploading(false);
        return;
      }

      // 1. إنشاء سجل الرفع (Timesheet Import)
      const { data: importRecord, error: importError } = await supabase.from('timesheet_imports').insert([{
        file_name: previewData.fileName,
        month: previewData.month,
        year: previewData.year,
        status: 'COMPLETED'
      }]).select().single();

      if (importError) throw importError;

      // 2. تجهيز السجلات الفردية (للموظفين المعرفين فقط)
      const formattedRecords = validRecords.map(rec => {
        const fullDate = `${previewData.year}-${String(previewData.month).padStart(2, '0')}-${String(rec.day).padStart(2, '0')}`;
        return {
          import_id: importRecord.id,
          emp_number: rec.empNumber,
          date: fullDate,
          recorded_hours: rec.hours
        };
      });

      // 3. حفظ السجلات
      const { error: recordsError } = await supabase.from('timesheet_records').insert(formattedRecords);
      if (recordsError) throw recordsError;

      setShowPreview(false);
      showToast(`تم الحفظ بنجاح! تم تجاهل الموظفين غير المعرفين.`, 'success');
      fetchImportsHistory();

    } catch (error: any) {
      // التعديل هنا: استخدام JSON.stringify عشان يجبر المتصفح يقرأ تفاصيل الخطأ المخفية
      console.error("تفاصيل الخطأ كاملة:", JSON.stringify(error, null, 2));
      showToast(error?.message || error?.details || 'حدث خطأ أثناء الحفظ. تأكد من تطابق البيانات.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 relative">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">سجل التايم شيت (Timesheet)</h1>
          <p className="text-gray-500 text-sm mt-1">رفع شيت الساعات الإضافية الشهري للمطابقة والتدقيق</p>
        </div>
        
        <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition disabled:opacity-50 font-medium">
          <FileSpreadsheet size={18} />
          <span>{isUploading && !showPreview ? 'جاري المعالجة...' : 'رفع تايم شيت جديد'}</span>
        </button>
      </div>

      {/* سجل الرفع */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-navy-900)] flex items-center gap-2">
            <FileClock size={18} className="text-[var(--color-navy-500)]" />
            سجل الملفات المرفوعة
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                <th className="p-4 font-semibold">تاريخ الرفع</th>
                <th className="p-4 font-semibold">اسم الملف</th>
                <th className="p-4 font-semibold text-center">الشهر والسنة</th>
                <th className="p-4 font-semibold text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr> : 
               imports.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-500">لم يتم رفع أي تايم شيت حتى الآن.</td></tr> :
               imports.map((imp) => (
                  <tr key={imp.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-700 text-sm font-medium">
                      {new Date(imp.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 font-bold text-[var(--color-navy-500)] flex items-center gap-2">
                      <FileSpreadsheet size={16} /> {imp.file_name}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-sm font-bold border">
                        {imp.month} / {imp.year}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                        مكتمل
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* شاشة المعاينة (Preview Modal) */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-navy-900)]">معاينة بيانات التايم شيت</h2>
                <div className="text-sm text-gray-500 mt-2 flex items-center gap-4">
                  <span className="flex items-center gap-1"><FileSpreadsheet size={14}/> {previewData.fileName}</span>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 bg-gray-200 p-2 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* إعدادات الشهر والسنة */}
              <div className="flex gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 font-semibold text-blue-900">
                  <CalendarDays size={20} /> تحديد شهر التايم شيت:
                </div>
                <select 
                  value={previewData.month} 
                  onChange={(e) => setPreviewData({...previewData, month: parseInt(e.target.value)})}
                  className="border border-blue-200 rounded p-1.5 outline-none font-bold text-center bg-white"
                >
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>شهر {i+1}</option>)}
                </select>
                <select 
                  value={previewData.year} 
                  onChange={(e) => setPreviewData({...previewData, year: parseInt(e.target.value)})}
                  className="border border-blue-200 rounded p-1.5 outline-none font-bold text-center bg-white"
                >
                  {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="text-sm text-blue-700 self-center mr-auto">
                  * تأكد من اختيار الشهر والسنة الصحيحين للمطابقة لاحقاً.
                </div>
              </div>

              <div className="mb-4 flex justify-between items-end">
                <h3 className="font-bold text-[var(--color-navy-800)] flex items-center gap-2">
                  <User size={18}/> ملخص الموظفين المقروء ({previewData.summary.length} موظف)
                </h3>
                <span className="text-sm font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full">
                  إجمالي الساعات: {previewData.summary.reduce((acc, curr) => acc + curr.totalHours, 0)} ساعة
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border-b font-bold">الرقم</th>
                      <th className="p-3 border-b font-bold">اسم الموظف</th>
                      <th className="p-3 border-b font-bold text-center">إجمالي الساعات بالشيت</th>
                      <th className="p-3 border-b font-bold text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.summary.map((emp, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{emp.empNumber}</td>
                        <td className="p-3 font-bold text-[var(--color-navy-800)]">{emp.empName}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{emp.totalHours}</td>
                        <td className="p-3 text-center">
                          {emp.empName === 'غير مسجل بالنظام' ? 
                            <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">غير معرف</span> : 
                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold">معرف</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            <div className="p-6 border-t bg-white rounded-b-xl flex justify-end gap-3">
              <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">إلغاء</button>
              <button 
                onClick={saveTimesheet} 
                disabled={isUploading} 
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold transition disabled:opacity-50"
              >
                <Save size={18} /><span>{isUploading ? 'جاري الحفظ...' : 'تأكيد وحفظ التايم شيت'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}