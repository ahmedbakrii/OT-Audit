'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, CheckCircle2, AlertCircle, FileText, Clock, X, Save, Layers, User, UserPlus, CalendarDays, Users, ArrowRight, Activity, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('مدخل بيانات');

  const [imports, setImports] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [showPreview, setShowPreview] = useState(false);
  const [previewList, setPreviewList] = useState<{ fileName: string, empNumber: string, empName: string, records: any[], status: string, dateRange: string }[]>([]);
  
  // 🔴 الغرباء مع حالتهم الخاصة بكل واحد عشان نقدر نعدلهم في الجدول
  const [unknownEmployees, setUnknownEmployees] = useState<{ empNumber: string, empName: string, jobTitle: string, companyId: string, shiftId: string, isSaving: boolean }[]>([]);
  
  const [viewMode, setViewMode] = useState<'IMPORTS' | 'IMPORT_DETAILS' | 'CONSOLIDATED'>('IMPORTS');
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [importDetails, setImportDetails] = useState<any[]>([]);
  const [selectedEmpRecords, setSelectedEmpRecords] = useState<{ empName: string, empNumber: string, records: any[], totalSheetDays: number } | null>(null);
  
  const [consolidatedMonth, setConsolidatedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setCurrentUserName(user.name || 'مدخل بيانات');
    document.title = 'سجل الحضور | STAFFCORE';

    async function initUser() {
      const { data } = await supabase.from('users').select('department_id, name').eq('id', user.id).single();
      if (data?.department_id) {
        setUserDeptId(data.department_id);
      }
      if (data?.name) setCurrentUserName(data.name);
      
      fetchLookups();
      fetchImportsHistory();
      fetchAllEmployees(user.role, data?.department_id);
    }
    initUser();
  }, [router]);

  async function fetchLookups() {
    const [{ data: compData }, { data: deptData }, { data: shiftData }] = await Promise.all([
      supabase.from('companies').select('id, name'),
      supabase.from('departments').select('id, name'),
      supabase.from('shifts').select('id, name')
    ]);
    if (compData) setCompanies(compData);
    if (deptData) setDepartments(deptData);
    if (shiftData) setShifts(shiftData);
  }

  async function fetchAllEmployees(role: string, deptId: string | null) {
    let query = supabase.from('employees').select('emp_number, name');
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

  async function loadConsolidatedData() {
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') return;
    try {
      setLoading(true);
      const [year, month] = consolidatedMonth.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      let query = supabase
        .from('attendance_records')
        .select(`*, employees!inner(name, department_id)`)
        .gte('date', startDate)
        .lte('date', endDate);

      if (userRole === 'MANAGER' && userDeptId) {
        query = query.eq('employees.department_id', userDeptId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = (data || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.emp_number]) acc[curr.emp_number] = { name: curr.employees.name, records: [] };
        acc[curr.emp_number].records.push(curr);
        return acc;
      }, {});

      const totalSheetDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;

      const formattedDetails = Object.keys(grouped).map(empNum => {
        const originalRecords = grouped[empNum].records.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const filledRecords = [];
        let currentDate = new Date(startDate);
        const maxD = new Date(endDate);
        while (currentDate <= maxD) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const existingRec = originalRecords.find((r: any) => r.date === dateStr);
          if (existingRec) filledRecords.push(existingRec);
          else filledRecords.push({ date: dateStr, first_in: null, last_out: null, isMissing: true });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const actualAttendanceDays = originalRecords.length;
        const problemDays = originalRecords.filter((r:any) => (!r.first_in && r.last_out) || (r.first_in && !r.last_out)).length;

        return { empNumber: empNum, empName: grouped[empNum].name, records: filledRecords, totalSheetDays, actualAttendanceDays, problemDays };
      });

      setImportDetails(formattedDetails);
      setViewMode('CONSOLIDATED');
      setSelectedEmpRecords(null);
    } catch (error) { showToast('حدث خطأ في جلب البيانات الشاملة', 'error'); } 
    finally { setLoading(false); }
  }

  async function loadImportDetails(importId: string) {
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('attendance_records').select(`*, employees!inner(name)`).eq('import_id', importId);
      if (error) throw error;

      let globalMinDate = new Date();
      let globalMaxDate = new Date('1970-01-01');
      if (data && data.length > 0) {
        const allDates = data.map(r => new Date(r.date).getTime());
        globalMinDate = new Date(Math.min(...allDates));
        globalMaxDate = new Date(Math.max(...allDates));
      }
      const totalSheetDays = Math.round((globalMaxDate.getTime() - globalMinDate.getTime()) / (1000 * 3600 * 24)) + 1;

      const grouped = (data || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.emp_number]) acc[curr.emp_number] = { name: curr.employees.name, records: [] };
        acc[curr.emp_number].records.push(curr);
        return acc;
      }, {});

      const formattedDetails = Object.keys(grouped).map(empNum => {
        const originalRecords = grouped[empNum].records.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const filledRecords = [];
        let currentDate = new Date(globalMinDate);
        while (currentDate <= globalMaxDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const existingRec = originalRecords.find((r: any) => r.date === dateStr);
          if (existingRec) filledRecords.push(existingRec);
          else filledRecords.push({ date: dateStr, first_in: null, last_out: null, isMissing: true });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const actualAttendanceDays = originalRecords.length;
        const problemDays = originalRecords.filter((r:any) => (!r.first_in && r.last_out) || (r.first_in && !r.last_out)).length;

        return { empNumber: empNum, empName: grouped[empNum].name, records: filledRecords, totalSheetDays, actualAttendanceDays, problemDays };
      });

      setImportDetails(formattedDetails);
      setSelectedImportId(importId);
      setViewMode('IMPORT_DETAILS');
    } catch (error) { showToast('حدث خطأ في جلب التفاصيل', 'error'); } 
    finally { setLoading(false); }
  }

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let parsedFiles: any[] = [];
    let tempUnknowns: any[] = [];

    for (let file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let currentEmpNumber = '';
        let currentEmpName = '';
        let currentRecords: any[] = [];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const rowStr = row.map(String).join(' '); 
          // 🔴 التعديل هنا: شبكة صيد أوسع للرقم (من 3 لـ 15 رقم) عشان يلقط الكل
          const potentialNumbers = row.filter(c => (typeof c === 'string' && /^\d{3,15}$/.test(c.trim())) || (typeof c === 'number' && c >= 100 && c < 999999999));
          const hasNameOrDept = rowStr.includes('ادارة') || rowStr.includes('قسم') || rowStr.includes('الإسم') || rowStr.includes('الاسم');

          if (potentialNumbers.length > 0 && hasNameOrDept) {
            // 🔴 التعديل الأهم هنا: هنحفظ الموظف حتى لو ملحقناش ليه سجلات!
            if (currentEmpNumber) {
              const matchedEmp = dbEmployees.find(e => String(e.emp_number) === currentEmpNumber);
              let dr = '';
              const validDates = currentRecords.map(r => r.date).filter(d => d instanceof Date && !isNaN(d.getTime()));
              if (validDates.length > 0) {
                const minD = new Date(Math.min(...validDates.map(d => d.getTime()))).toLocaleDateString('en-GB');
                const maxD = new Date(Math.max(...validDates.map(d => d.getTime()))).toLocaleDateString('en-GB');
                dr = `${minD} - ${maxD}`;
              }
              
              if (matchedEmp) {
                parsedFiles.push({ fileName: file.name, empNumber: currentEmpNumber, empName: matchedEmp.name, records: currentRecords, status: 'valid', dateRange: dr });
              } else {
                parsedFiles.push({ fileName: file.name, empNumber: currentEmpNumber, empName: currentEmpName, records: currentRecords, status: 'unknown', dateRange: dr });
                if(!tempUnknowns.find(u => u.empNumber === currentEmpNumber)) {
                  tempUnknowns.push({ empNumber: currentEmpNumber, empName: currentEmpName, jobTitle: '', companyId: '', shiftId: '', isSaving: false });
                }
              }
            }

            currentEmpNumber = String(potentialNumbers[potentialNumbers.length - 1]).trim();
            const textCells = row.filter(c => typeof c === 'string' && c.length > 5 && !c.includes('ادارة') && !c.includes('قسم') && !/\d/.test(c));
            currentEmpName = textCells.length > 0 ? textCells[0].trim() : 'اسم غير معروف';
            currentRecords = [];
            continue;
          }

          if (currentEmpNumber) {
            // 🔴 التعديل هنا: نقبل أي فورمات تاريخ عشان ميديش Error ويطير الموظف
            let dateCell = row.find(cell => 
              cell instanceof Date || 
              (typeof cell === 'string' && cell.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/))
            );
            
            if (!dateCell) {
              const serialDate = row.find(cell => typeof cell === 'number' && cell > 40000);
              if (serialDate) dateCell = new Date(Math.round((serialDate - 25569) * 86400 * 1000));
            }

            if (dateCell && (dateCell instanceof Date || typeof dateCell === 'string')) {
              const actualDateObj = dateCell instanceof Date ? dateCell : new Date(dateCell);

              if (!isNaN(actualDateObj.getTime())) {
                let timeFractions: number[] = [];
                row.forEach(cell => {
                  if (typeof cell === 'number') {
                    if (cell > 0 && cell < 1) timeFractions.push(cell);
                    else if (cell > 40000 && (cell % 1) > 0) timeFractions.push(cell % 1);
                  } else if (cell instanceof Date) {
                    const fraction = (cell.getUTCHours() * 3600 + cell.getUTCMinutes() * 60 + cell.getUTCSeconds()) / 86400;
                    if (fraction > 0) timeFractions.push(fraction);
                  } else if (typeof cell === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(cell.trim())) {
                    const parts = cell.trim().split(':');
                    const fraction = (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parts[2] ? parseInt(parts[2]) : 0)) / 86400;
                    if (fraction > 0) timeFractions.push(fraction);
                  }
                });

                timeFractions.sort((a, b) => a - b);
                currentRecords.push({ 
                  date: actualDateObj, 
                  in: timeFractions.length >= 1 ? timeFractions[0] : null, 
                  out: timeFractions.length >= 2 ? timeFractions[timeFractions.length - 1] : null 
                });
              }
            }
          }
        }

        // حفظ آخر موظف
        if (currentEmpNumber) {
          const matchedEmp = dbEmployees.find(e => String(e.emp_number) === currentEmpNumber);
          let dr = '';
          const validDates = currentRecords.map(r => r.date).filter(d => d instanceof Date && !isNaN(d.getTime()));
          if (validDates.length > 0) {
            const minD = new Date(Math.min(...validDates.map(d => d.getTime()))).toLocaleDateString('en-GB');
            const maxD = new Date(Math.max(...validDates.map(d => d.getTime()))).toLocaleDateString('en-GB');
            dr = `${minD} - ${maxD}`;
          }
          if (matchedEmp) {
            parsedFiles.push({ fileName: file.name, empNumber: currentEmpNumber, empName: matchedEmp.name, records: currentRecords, status: 'valid', dateRange: dr });
          } else {
            parsedFiles.push({ fileName: file.name, empNumber: currentEmpNumber, empName: currentEmpName, records: currentRecords, status: 'unknown', dateRange: dr });
            if(!tempUnknowns.find(u => u.empNumber === currentEmpNumber)) {
              tempUnknowns.push({ empNumber: currentEmpNumber, empName: currentEmpName, jobTitle: '', companyId: '', shiftId: '', isSaving: false });
            }
          }
        }
      } catch (error) {
        if (parsedFiles.length === 0) {
          parsedFiles.push({ fileName: file.name, empNumber: '-', empName: 'خطأ بالقراءة', records: [], status: 'error', dateRange: '' });
        }
      }
    }

    setPreviewList(parsedFiles);
    setUnknownEmployees(tempUnknowns);
    setShowPreview(true);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 🔴 الإضافة الفردية السريعة من الجدول (Inline Add)
  const handleInlineSaveUnknown = async (empNumber: string) => {
    const empData = unknownEmployees.find(u => u.empNumber === empNumber);
    if (!empData) return;

    if (!empData.jobTitle || !empData.companyId || !empData.shiftId) {
      return showToast('برجاء استكمال جميع بيانات الموظف (المسمى، الشركة، الوردية) قبل الإضافة!', 'error');
    }

    setUnknownEmployees(prev => prev.map(u => u.empNumber === empNumber ? { ...u, isSaving: true } : u));

    try {
      const { error } = await supabase.from('employees').insert([{
        emp_number: empData.empNumber,
        name: empData.empName,
        job_title: empData.jobTitle,
        company_id: empData.companyId,
        shift_id: empData.shiftId,
        department_id: userRole === 'MANAGER' ? userDeptId : null
      }]);

      if (error) throw error;

      showToast(`تمت إضافة الموظف ${empData.empName} بنجاح!`, 'success');
      await fetchAllEmployees(userRole!, userDeptId);

      // نقله من المجهولين للقائمة الصالحة
      setPreviewList(prev => prev.map(p => p.empNumber === empNumber ? { ...p, status: 'valid' } : p));
      setUnknownEmployees(prev => prev.filter(u => u.empNumber !== empNumber));

    } catch (error: any) {
      if (error.code === '23505') showToast('الرقم الوظيفي مسجل مسبقاً!', 'error');
      else showToast('حدث خطأ أثناء إضافة الموظف', 'error');
      setUnknownEmployees(prev => prev.map(u => u.empNumber === empNumber ? { ...u, isSaving: false } : u));
    }
  };

  const updateUnknownField = (empNumber: string, field: string, value: string) => {
    setUnknownEmployees(prev => prev.map(u => u.empNumber === empNumber ? { ...u, [field]: value } : u));
  };


  const saveMultipleAttendance = async () => {
    setIsUploading(true);
    const validFiles = previewList.filter(f => f.status === 'valid' && f.records.length > 0);
    if (validFiles.length === 0) return setIsUploading(false);

    try {
      const totalRecs = validFiles.reduce((acc, curr) => acc + curr.records.length, 0);
      
      let allDates: number[] = [];
      validFiles.forEach(f => f.records.forEach(r => allDates.push(new Date(r.date).getTime())));
      const minDate = new Date(Math.min(...allDates)).toLocaleDateString('en-GB');
      const maxDate = new Date(Math.max(...allDates)).toLocaleDateString('en-GB');
      const dateRangeStr = `${minDate} - ${maxDate}`;
      
      const fileNameTitle = `${validFiles.length} موظف | من ${minDate} إلى ${maxDate} | بواسطة: ${currentUserName}`;

      const { data: importRecord, error: importError } = await supabase
        .from('attendance_imports')
        .insert([{ 
          file_name: fileNameTitle, 
          status: 'COMPLETED', 
          total_records: totalRecs,
          emp_count: validFiles.length,
          date_range: dateRangeStr,
          uploaded_by: currentUserName
        }])
        .select().single();

      if (importError) throw importError;

      for (const fileData of validFiles) {
        const newRecords = fileData.records.map(rec => {
          const formatExcelTime = (excelTime: any, dateVal: any) => {
            if (!excelTime) return null;
            let d = new Date(dateVal);
            const totalSeconds = Math.round(excelTime * 86400);
            d.setUTCHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60);
            return d.toISOString();
          };
          const actualDate = new Date(rec.date);
          return {
            import_id: importRecord.id,
            emp_number: fileData.empNumber,
            date: actualDate.toISOString().split('T')[0],
            first_in: formatExcelTime(rec.in, actualDate),
            last_out: formatExcelTime(rec.out, actualDate),
            work_status: 'عمل'
          };
        });

        const datesToUpdate = newRecords.map(r => r.date);
        const { data: existingRecords } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('emp_number', fileData.empNumber)
          .in('date', datesToUpdate);

        const mergedRecords = newRecords.map(newRec => {
          const existingRec = existingRecords?.find(dbRec => dbRec.date === newRec.date);
          if (existingRec) {
            return {
              id: existingRec.id,
              emp_number: existingRec.emp_number,
              date: existingRec.date,
              first_in: existingRec.first_in || newRec.first_in,
              last_out: existingRec.last_out || newRec.last_out,
              work_status: existingRec.work_status,
              import_id: newRec.import_id
            };
          }
          return newRec;
        });

        await supabase.from('attendance_records').upsert(mergedRecords, { onConflict: 'emp_number,date' });
      }

      setShowPreview(false); 
      showToast(`تم حفظ وتحديث ${totalRecs} سجل بنجاح!`, 'success'); 
      fetchImportsHistory();
    } catch (error) { 
      showToast('حدث خطأ أثناء الدمج أو الحفظ.', 'error'); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const extractTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const calculateDuration = (inIso: string | null, outIso: string | null) => {
    if (!inIso || !outIso) return null;
    let inDate = new Date(inIso);
    let outDate = new Date(outIso);
    
    const inFraction = (inDate.getUTCHours() * 3600 + inDate.getUTCMinutes() * 60) / 86400;
    const outFraction = (outDate.getUTCHours() * 3600 + outDate.getUTCMinutes() * 60) / 86400;

    let durationHours = 0;
    if (outFraction < inFraction) durationHours = ((1 + outFraction) - inFraction) * 24;
    else durationHours = (outFraction - inFraction) * 24;

    if (durationHours <= 0) return null;
    return durationHours.toFixed(1);
  };

  return (
    <div className="flex flex-col space-y-6 relative pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* الهيدر والشاشات الأساسية */}
      {viewMode === 'IMPORTS' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">سجل الحضور والانصراف</h1>
              <p className="text-gray-500 text-sm mt-1">رفع شيت البصمة وتحليله بذكاء. {(userRole === 'ADMIN' || userRole === 'MANAGER') && <span className="text-blue-600 font-bold">(اضغط على السطر لعرض تفاصيله)</span>}</p>
            </div>

            <div className="flex items-center gap-3">
              {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg">
                  <input type="month" value={consolidatedMonth} onChange={e => setConsolidatedMonth(e.target.value)} className="border-none bg-white rounded-md text-sm font-bold px-2 py-1 outline-none" />
                  <button onClick={loadConsolidatedData} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-bold shadow-sm">
                    <Calendar size={16}/> العرض الشامل للشهر
                  </button>
                </div>
              )}
              
              {(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'DATA_ENTRY') && (
                <>
                  <input type="file" accept=".xlsx" multiple className="hidden" ref={fileInputRef} onChange={handleMultipleFilesUpload} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold shadow-md">
                    <Layers size={18} /><span>{isUploading && !showPreview ? 'جاري التحليل...' : 'رفع شيت بصمة'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Clock size={18} className="text-[var(--color-navy-500)]" /> سجل الملفات المرفوعة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                    <th className="p-4 font-semibold">تاريخ الرفع</th>
                    <th className="p-4 font-semibold">اسم الملف</th>
                    <th className="p-4 font-semibold text-center">الموظفين</th>
                    <th className="p-4 font-semibold text-center">فترة السجل</th>
                    <th className="p-4 font-semibold text-center">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</td></tr> : 
                   imports.map((imp) => (
                      <tr 
                        key={imp.id} 
                        onClick={() => { if (userRole === 'ADMIN' || userRole === 'MANAGER') loadImportDetails(imp.id); }}
                        className={`border-b transition ${userRole === 'ADMIN' || userRole === 'MANAGER' ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'}`}
                      >
                        <td className="p-4 text-gray-700 text-sm font-bold">{new Date(imp.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4 font-bold text-[var(--color-navy-600)] flex items-center gap-2"><FileText size={16} /> {imp.file_name}</td>
                        <td className="p-4 text-gray-700 font-black text-center">{imp.emp_count || '-'}</td>
                        <td className="p-4 text-gray-700 font-bold text-center text-xs" dir="ltr">{imp.date_range || '-'}</td>
                        <td className="p-4 text-gray-500 font-bold text-center text-xs">{imp.uploaded_by || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        // شاشة تفاصيل الملف أو العرض الشامل
        <div className="animate-in slide-in-from-right-4 space-y-4">
          <button onClick={() => { 
            if(selectedEmpRecords) setSelectedEmpRecords(null); 
            else setViewMode('IMPORTS'); 
          }} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border transition w-max">
            <ArrowRight size={18}/> {selectedEmpRecords ? 'عودة لقائمة الموظفين' : 'إغلاق التفاصيل والعودة للرئيسية'}
          </button>

          {!selectedEmpRecords ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
              <div className="bg-[var(--color-navy-900)] p-4 border-b flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={18} /> {viewMode === 'CONSOLIDATED' ? 'العرض الشامل المدمج للموظفين' : 'الموظفين المسجلين في هذا الملف'}
                </h3>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">{importDetails.length} موظف</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-600 text-sm">
                      <th className="p-4 font-semibold">الرقم الوظيفي</th>
                      <th className="p-4 font-semibold">اسم الموظف</th>
                      <th className="p-4 font-semibold text-center">أيام الشيت</th>
                      <th className="p-4 font-semibold text-center">حضور فعلي</th>
                      <th className="p-4 font-semibold text-center">مشاكل بصمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importDetails.map((emp: any, idx) => (
                      <tr key={idx} onClick={() => setSelectedEmpRecords(emp)} className="border-b hover:bg-blue-50 transition cursor-pointer group">
                        <td className="p-4 font-bold text-gray-800">{emp.empNumber}</td>
                        <td className="p-4 font-black text-[var(--color-navy-800)] flex items-center gap-2">
                          {emp.empName} <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">عرض الأيام <ArrowRight size={12}/></span>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-600">{emp.totalSheetDays} يوم</td>
                        <td className="p-4 text-center font-bold text-emerald-600">{emp.actualAttendanceDays} يوم</td>
                        <td className="p-4 text-center">
                          {emp.problemDays > 0 ? (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">{emp.problemDays} أيام</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // شاشة البصمات اليومية للموظف (بالأيام المفقودة والتمييز)
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
              <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-[var(--color-navy-900)] text-lg flex items-center gap-2"><User size={20} className="text-blue-600"/> {selectedEmpRecords.empName}</h3>
                  <p className="text-sm text-gray-500 font-bold">الرقم الوظيفي: {selectedEmpRecords.empNumber}</p>
                </div>
                <div className="text-left">
                  <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-blue-600 border border-blue-200">فترة التقرير: {selectedEmpRecords.totalSheetDays} أيام</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 text-sm">
                      <th className="p-4 font-semibold text-right">التاريخ</th>
                      <th className="p-4 font-semibold">بصمة الدخول</th>
                      <th className="p-4 font-semibold">بصمة الخروج</th>
                      <th className="p-4 font-semibold">مدة الدوام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmpRecords.records.map((rec: any, idx) => {
                      const isMissingDay = rec.isMissing;
                      const hasMissingPunch = (!isMissingDay) && ((!rec.first_in && rec.last_out) || (rec.first_in && !rec.last_out));
                      
                      const isLastDay = idx === selectedEmpRecords.records.length - 1;
                      const isPendingMerge = hasMissingPunch && rec.first_in && !rec.last_out && isLastDay;
                      const isProblem = hasMissingPunch && !isPendingMerge;

                      const duration = calculateDuration(rec.first_in, rec.last_out);

                      return (
                        <tr key={idx} className={`border-b transition ${isProblem ? 'bg-orange-50 border-orange-200' : isPendingMerge ? 'bg-yellow-50' : isMissingDay ? 'bg-gray-50/50 opacity-70' : 'hover:bg-gray-50'}`}>
                          <td className="p-4 font-bold text-gray-800 text-right flex items-center gap-2">
                            <CalendarDays size={16} className={isProblem ? 'text-orange-400' : isPendingMerge ? 'text-yellow-500' : isMissingDay ? 'text-gray-300' : 'text-blue-400'}/> {rec.date}
                            {isProblem && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] ml-2 border border-orange-200">بصمة ناقصة (مشكلة)</span>}
                            {isPendingMerge && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] ml-2 border border-yellow-200">معلقة للدمج (شغال حالياً)</span>}
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-600">{!isMissingDay ? extractTime(rec.first_in) : '-'}</td>
                          <td className="p-4 font-mono font-bold text-rose-600">{!isMissingDay ? extractTime(rec.last_out) : '-'}</td>
                          <td className="p-4">
                            {duration ? (
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200">{duration} ساعة</span>
                            ) : isMissingDay ? (
                              <span className="text-gray-400 text-xs font-bold flex justify-center items-center gap-1"><AlertCircle size={14}/> غياب / لم يسجل</span>
                            ) : isPendingMerge ? (
                              <span className="text-yellow-600 text-xs font-bold flex justify-center items-center gap-1"><Activity size={14}/> منتظر الخروج</span>
                            ) : (
                              <span className="text-orange-500 text-xs font-bold flex justify-center items-center gap-1"><AlertCircle size={14}/> مشكلة في الحساب</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* مودال المعاينة قبل الرفع (مع ميزة الـ Inline Edit السريعة للغرباء) */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-navy-900)]">معاينة موظفين الشيت المجمع</h2>
                <p className="text-sm text-gray-500">تم استخراج {previewList.length} موظف من الشيت.</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              
              {/* قسم الغرباء الجديد بالـ Inline Edit */}
              {unknownEmployees.length > 0 && (
                <div className="mb-6 bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-orange-50 p-4 border-b border-orange-100">
                    <div className="flex items-center gap-2 text-orange-800 font-bold mb-1">
                      <AlertCircle size={20} />
                      <span>{unknownEmployees.length} موظف في الشيت غير مسجلين بإدارتك!</span>
                    </div>
                    <p className="text-xs text-orange-700">أكمل بياناتهم (الشركة، الوردية، المسمى) من الجدول أدناه واضغط إضافة لتسجيلهم في السيستم فوراً.</p>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[40vh]">
                    <table className="w-full text-right text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="p-3 font-semibold text-gray-600">الرقم</th>
                          <th className="p-3 font-semibold text-gray-600">الاسم بالشيت</th>
                          <th className="p-3 font-semibold text-gray-600 min-w-[150px]">المسمى الوظيفي *</th>
                          <th className="p-3 font-semibold text-gray-600 min-w-[150px]">الشركة *</th>
                          <th className="p-3 font-semibold text-gray-600 min-w-[150px]">الوردية *</th>
                          <th className="p-3 font-semibold text-center text-gray-600">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unknownEmployees.map((unk, idx) => (
                          <tr key={idx} className="border-b hover:bg-orange-50/30 transition">
                            <td className="p-3 font-bold text-gray-800">{unk.empNumber}</td>
                            <td className="p-3 font-bold text-orange-800">{unk.empName}</td>
                            <td className="p-2">
                              <input 
                                type="text" 
                                placeholder="اكتب المسمى..."
                                value={unk.jobTitle} 
                                onChange={(e) => updateUnknownField(unk.empNumber, 'jobTitle', e.target.value)} 
                                className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500" 
                              />
                            </td>
                            <td className="p-2">
                              <select 
                                value={unk.companyId} 
                                onChange={(e) => updateUnknownField(unk.empNumber, 'companyId', e.target.value)} 
                                className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="" disabled>اختر شركة...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <select 
                                value={unk.shiftId} 
                                onChange={(e) => updateUnknownField(unk.empNumber, 'shiftId', e.target.value)} 
                                className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="" disabled>اختر وردية...</option>
                                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <button 
                                onClick={() => handleInlineSaveUnknown(unk.empNumber)} 
                                disabled={unk.isSaving}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm disabled:opacity-50 transition"
                              >
                                {unk.isSaving ? 'جاري...' : 'إضافة للسيستم'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* باقي الموظفين الصح */}
              <div className="grid gap-4">
                {previewList.filter(f => f.status === 'valid').map((file, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-lg border-l-4 shadow-sm flex items-center justify-between border-green-500">
                    <div>
                      <h3 className="font-bold text-[var(--color-navy-900)] flex items-center gap-2 mb-2"><User size={18} className="text-blue-500"/> {file.empName}</h3>
                      <div className="text-sm text-gray-700 flex gap-6 items-center font-semibold">
                        <div>الرقم: <strong className="font-mono text-base">{file.empNumber}</strong></div>
                        <div>الأيام المقروءة: <strong className="text-green-600">{file.records.length} يوم</strong></div>
                      </div>
                    </div>
                    <div>
                       <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> جاهز للدمج</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t bg-white rounded-b-xl flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">
                جاهز للدمج: <span className="text-green-600 text-lg font-black">{previewList.filter(f => f.status === 'valid').length}</span> موظف 
                {unknownEmployees.length > 0 && <span className="text-orange-500 font-bold mx-2">| تجاهل {unknownEmployees.length} غريب</span>}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold">إلغاء</button>
                <button onClick={saveMultipleAttendance} disabled={isUploading || previewList.filter(f => f.status === 'valid').length === 0} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold shadow-md disabled:opacity-50 transition">
                  <Save size={18} /><span>تأكيد ودمج البصمات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}