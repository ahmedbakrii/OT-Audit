'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, CheckCircle2, AlertCircle, FileText, Clock, X, Save, Layers, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const router = useRouter();

  // --- حالات الصلاحيات ---
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [imports, setImports] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [showPreview, setShowPreview] = useState(false);
  const [previewList, setPreviewList] = useState<{ fileName: string, empNumber: string, empName: string, records: any[], status: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // الحماية والصلاحيات
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

    setUserRole(user.role);
    document.title = 'سجل الحضور | OT Audit';

    // جلب بيانات القسم وتمريرها للدوال
    async function initUser() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
      }
      fetchImportsHistory();
      fetchAllEmployees(user.role, data?.department_id);
    }

    initUser();
  }, [router]);

  // --- العزل: جلب الموظفين بناءً على الصلاحية ---
  async function fetchAllEmployees(role: string, deptId: string | null) {
    let query = supabase.from('employees').select('emp_number, name');
    
    // لو مدير قسم، يجيب موظفين قسمه بس، عشان لو رفع شيت فيه حد غريب يترفض
    if (role === 'MANAGER' && deptId) {
      query = query.eq('department_id', deptId);
    }
    
    const { data } = await query;
    if (data) setDbEmployees(data);
  }

  async function fetchImportsHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('attendance_imports').select(`*`).order('created_at', { ascending: false });
      if (error) throw error;
      setImports(data || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let parsedFiles: any[] = [];

    for (let file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let empNumber = '';
        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(30, rows.length); i++) {
          if (!rows[i]) continue;
          const rowStr = rows[i].join(' ');
          if (!empNumber) {
            const numCell = rows[i].find(cell => (typeof cell === 'string' && /^\d{4,6}$/.test(cell.trim())) || (typeof cell === 'number' && cell > 1000 && cell < 999999));
            if (numCell) empNumber = String(numCell).trim();
          }
          if (headerRowIndex === -1 && (rowStr.includes('التاريخ') || rowStr.includes('دخول'))) {
            headerRowIndex = i;
          }
        }

        const matchedEmp = dbEmployees.find(e => String(e.emp_number) === empNumber);
        const empName = matchedEmp ? matchedEmp.name : 'غير مسجل أو ليس بإدارتك'; // رسالة توضح العزل

        if (!empNumber || headerRowIndex === -1) {
          parsedFiles.push({ fileName: file.name, empNumber: '-', empName: 'هيكل غير معروف', records: [], status: 'error' });
          continue;
        }

        const records = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const dateCell = row.find(cell => cell instanceof Date || (typeof cell === 'string' && cell.match(/^\d{4}-\d{2}-\d{2}/)));
          if (dateCell) {
            const timeCells = row.filter(cell => typeof cell === 'number' && cell > 0 && cell < 1);
            records.push({ date: dateCell, in: timeCells.length >= 1 ? timeCells[0] : null, out: timeCells.length >= 2 ? timeCells[timeCells.length - 1] : null });
          }
        }

        parsedFiles.push({ fileName: file.name, empNumber, empName, records, status: matchedEmp ? 'valid' : 'error' });

      } catch (error) {
        parsedFiles.push({ fileName: file.name, empNumber: '-', empName: 'خطأ بالقراءة', records: [], status: 'error' });
      }
    }

    setPreviewList(parsedFiles);
    setShowPreview(true);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveMultipleAttendance = async () => {
    setIsUploading(true);
    const validFiles = previewList.filter(f => f.status === 'valid' && f.records.length > 0);
    if (validFiles.length === 0) return setIsUploading(false);

    try {
      for (const fileData of validFiles) {
        const { data: importRecord, error: importError } = await supabase.from('attendance_imports').insert([{ file_name: fileData.fileName, status: 'COMPLETED', total_records: fileData.records.length }]).select().single();
        if (importError) continue;

        const formattedRecords = fileData.records.map(rec => {
          const formatExcelTime = (excelTime: any, dateVal: any) => {
            if (!excelTime) return null;
            let d = new Date(dateVal);
            const totalSeconds = Math.round(excelTime * 86400);
            d.setUTCHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60);
            return d.toISOString();
          };
          const actualDate = new Date(rec.date);
          return {
            import_id: importRecord.id, emp_number: fileData.empNumber,
            date: actualDate.toISOString().split('T')[0],
            first_in: formatExcelTime(rec.in, actualDate), last_out: formatExcelTime(rec.out, actualDate), work_status: 'عمل'
          };
        });
        await supabase.from('attendance_records').insert(formattedRecords);
      }
      setShowPreview(false); showToast(`تم حفظ الملفات بنجاح!`, 'success'); fetchImportsHistory();
    } catch (error) { showToast('حدث خطأ أثناء حفظ بعض الملفات.', 'error'); } 
    finally { setIsUploading(false); }
  };

  return (
    <div className="flex flex-col space-y-6 relative pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">سجل الحضور والانصراف</h1>
          <p className="text-gray-500 text-sm mt-1">
            رفع ملفات البصمة بشكل مجمع وعرض المعاينة {userRole === 'MANAGER' ? '(لإدارتك فقط)' : ''}
          </p>
        </div>
        
        {/* زرار الرفع متاح للأدمن والمدير فقط (مدير المصنع يتفرج بس) */}
        {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
          <>
            <input type="file" accept=".xlsx" multiple className="hidden" ref={fileInputRef} onChange={handleMultipleFilesUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold shadow-md">
              <Layers size={18} /><span>{isUploading && !showPreview ? 'جاري القراءة...' : 'رفع ملفات بصمة'}</span>
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Clock size={18} className="text-[var(--color-navy-500)]" /> سجل الملفات المرفوعة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                <th className="p-4 font-semibold">تاريخ الرفع</th><th className="p-4 font-semibold">اسم الملف</th><th className="p-4 font-semibold text-center">السجلات</th><th className="p-4 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr> : 
               imports.map((imp) => (
                  <tr key={imp.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-700 text-sm font-bold">{new Date(imp.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-4 font-bold text-[var(--color-navy-500)] flex items-center gap-2"><FileText size={16} /> {imp.file_name}</td>
                    <td className="p-4 text-gray-700 font-black text-center text-lg">{imp.total_records}</td>
                    <td className="p-4"><span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">مكتمل</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <div><h2 className="text-xl font-bold text-[var(--color-navy-900)]">معاينة البصمة ({previewList.length} ملفات)</h2></div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="grid gap-4">
                {previewList.map((file, idx) => (
                  <div key={idx} className={`bg-white p-5 rounded-lg border-l-4 shadow-sm flex items-center justify-between ${file.status === 'valid' ? 'border-green-500' : 'border-red-500'}`}>
                    <div>
                      <h3 className="font-bold text-[var(--color-navy-900)] flex items-center gap-2 mb-2"><FileText size={18} className="text-gray-400"/> {file.fileName}</h3>
                      <div className="text-sm text-gray-700 flex gap-6 items-center font-semibold">
                        <div className="flex items-center gap-2"><User size={16} className="text-blue-500"/> الاسم: <strong className={file.status === 'valid' ? 'text-blue-700' : 'text-red-600'}>{file.empName}</strong></div>
                        <div>الرقم: <strong>{file.empNumber}</strong></div>
                        {file.status === 'valid' && (<div>البصمات: <strong className="text-green-600">{file.records.length} يوم</strong></div>)}
                      </div>
                    </div>
                    <div>
                       {file.status === 'valid' ? 
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> جاهز</span> :
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-sm"><AlertCircle size={14}/> غير صالح</span>
                       }
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t bg-white rounded-b-xl flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">الملفات الصحيحة: <span className="text-green-600">{previewList.filter(f => f.status === 'valid').length}</span> من {previewList.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold">إلغاء</button>
                <button onClick={saveMultipleAttendance} disabled={isUploading || previewList.filter(f => f.status === 'valid').length === 0} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold shadow-md disabled:opacity-50">
                  <Save size={18} /><span>تأكيد وحفظ الصحيح</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}