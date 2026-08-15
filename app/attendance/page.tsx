'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, CheckCircle2, AlertCircle, FileText, Clock, X, Save, Layers, User, UserPlus, CalendarDays, Users, ArrowRight, Activity, Calendar, Filter, Search, Printer, ArrowDownUp } from 'lucide-react';
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
  
  const [unknownEmployees, setUnknownEmployees] = useState<{ empNumber: string, empName: string, jobTitle: string, companyId: string, shiftId: string, isSaving: boolean }[]>([]);
  
  const [viewMode, setViewMode] = useState<'IMPORTS' | 'IMPORT_DETAILS' | 'CONSOLIDATED'>('IMPORTS');
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [importDetails, setImportDetails] = useState<any[]>([]);
  const [selectedEmpRecords, setSelectedEmpRecords] = useState<{ empName: string, empNumber: string, shiftName: string, records: any[], totalSheetDays: number } | null>(null);
  
  const [consolidatedMonth, setConsolidatedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [searchEmp, setSearchEmp] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [sortByProblems, setSortByProblems] = useState(false);
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);

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
    let query = supabase.from('employees').select('emp_number, name, shifts(name)');
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
      
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let query = supabase
        .from('attendance_records')
        .select(`*, employees!inner(name, department_id, companies(name), shifts(name))`)
        .gte('date', startDate)
        .lte('date', endDate);

      if (userRole === 'MANAGER' && userDeptId) {
        query = query.eq('employees.department_id', userDeptId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = (data || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.emp_number]) {
          acc[curr.emp_number] = { 
            name: curr.employees.name, 
            shiftName: curr.employees.shifts?.name || 'غير محدد', 
            companyName: curr.employees.companies?.name || 'غير محدد',
            records: [] 
          };
        }
        acc[curr.emp_number].records.push(curr);
        return acc;
      }, {});

      const totalSheetDays = lastDay;

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

        const actualAttendanceDays = originalRecords.filter((r:any) => r.first_in !== null || r.last_out !== null).length;
        const problemDays = originalRecords.filter((r:any) => (!r.first_in && r.last_out) || (r.first_in && !r.last_out)).length;

        return { 
          empNumber: empNum, 
          empName: grouped[empNum].name, 
          shiftName: grouped[empNum].shiftName, 
          companyName: grouped[empNum].companyName,
          records: filledRecords, 
          totalSheetDays, 
          actualAttendanceDays, 
          problemDays 
        };
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
      const { data, error } = await supabase.from('attendance_records').select(`*, employees!inner(name, companies(name), shifts(name))`).eq('import_id', importId);
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
        if (!acc[curr.emp_number]) {
          acc[curr.emp_number] = { 
            name: curr.employees.name, 
            shiftName: curr.employees.shifts?.name || 'غير محدد', 
            companyName: curr.employees.companies?.name || 'غير محدد',
            records: [] 
          };
        }
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

        const actualAttendanceDays = originalRecords.filter((r:any) => r.first_in !== null || r.last_out !== null).length;
        const problemDays = originalRecords.filter((r:any) => (!r.first_in && r.last_out) || (r.first_in && !r.last_out)).length;

        return { 
          empNumber: empNum, 
          empName: grouped[empNum].name, 
          shiftName: grouped[empNum].shiftName, 
          companyName: grouped[empNum].companyName,
          records: filledRecords, 
          totalSheetDays, 
          actualAttendanceDays, 
          problemDays 
        };
      });

      setImportDetails(formattedDetails);
      setSelectedImportId(importId);
      setViewMode('IMPORT_DETAILS');
    } catch (error) { showToast('حدث خطأ في جلب التفاصيل', 'error'); } 
    finally { setLoading(false); }
  }

  const extractCellTime = (cell: any) => {
    if (cell === null || cell === undefined || cell === '') return null;
    if (typeof cell === 'number' && cell > 0 && cell < 1) return cell;
    if (typeof cell === 'number' && cell > 40000) return cell % 1;
    if (cell instanceof Date) return (cell.getUTCHours() * 3600 + cell.getUTCMinutes() * 60) / 86400;
    if (typeof cell === 'string' && /^\d{1,2}:\d{2}/.test(cell.trim())) {
      const parts = cell.trim().split(':');
      return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60) / 86400;
    }
    return null;
  };

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
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: "A", defval: null });

        let currentEmpNumber = '';
        let currentEmpName = '';
        let currentRecords: any[] = [];
        let currentShiftName = ''; 
        
        const saveCurrentEmployee = () => {
          if (!currentEmpNumber) return;
          const matchedEmp = dbEmployees.find(e => String(e.emp_number) === String(currentEmpNumber));
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
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowStr = Object.values(row).map(String).join(' '); 
          
          const isEmpHeaderRow = rowStr.includes('ادارة') || rowStr.includes('قسم') || rowStr.includes('الإسم') || rowStr.includes('الاسم');
          const avCell = row['AV'];
          
          if (isEmpHeaderRow && avCell !== null && avCell !== undefined && avCell !== '') {
            const strAV = String(avCell).trim();
            if (/^\d{3,15}$/.test(strAV)) {
              saveCurrentEmployee();
              currentEmpNumber = strAV;
              
              const possibleName = row['AJ'] || row['AI'] || row['AH'] || row['AA'] || row['AB'];
              currentEmpName = (typeof possibleName === 'string' && possibleName.length > 3) ? possibleName.trim() : 'اسم غير معروف';
              
              const matchedForShift = dbEmployees.find(e => String(e.emp_number) === String(currentEmpNumber));
              currentShiftName = matchedForShift?.shifts?.name || '';
              currentRecords = [];
              continue; 
            }
          }

          if (currentEmpNumber) {
            let dateCell = row['AS'] || row['AT'] || row['AU'] || row['AV'];
            
            let actualDateObj: Date | null = null;
            if (dateCell instanceof Date) actualDateObj = dateCell;
            else if (typeof dateCell === 'number' && dateCell > 40000) actualDateObj = new Date(Math.round((dateCell - 25569) * 86400 * 1000));
            else if (typeof dateCell === 'string' && dateCell.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/)) actualDateObj = new Date(dateCell);

            if (actualDateObj && !isNaN(actualDateObj.getTime())) {
              const inFraction = extractCellTime(row['AR']);
              const outFraction = extractCellTime(row['AP']) ?? extractCellTime(row['AO']);

              currentRecords.push({ 
                date: actualDateObj, 
                in: inFraction, 
                out: outFraction 
              });
            }
          }
        }

        saveCurrentEmployee();
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
    
    // 🔴 تم إزالة شرط (records.length > 0) عشان الموظف اللي ملهوش بصمات يتحفظ برضه ويتعمله Record فاضي
    const validFiles = previewList.filter(f => f.status === 'valid');
    if (validFiles.length === 0) return setIsUploading(false);

    try {
      let allDates: number[] = [];
      validFiles.forEach(f => f.records.forEach(r => {
        if(r.date && !isNaN(new Date(r.date).getTime())) allDates.push(new Date(r.date).getTime());
      }));
      
      if (allDates.length === 0) allDates.push(Date.now()); // للحماية من الشيتات الفاضية تماماً

      const minDateMs = Math.min(...allDates);
      const maxDateMs = Math.max(...allDates);
      const minDateStr = new Date(minDateMs).toLocaleDateString('en-GB');
      const maxDateStr = new Date(maxDateMs).toLocaleDateString('en-GB');
      const dateRangeStr = `${minDateStr} - ${maxDateStr}`;
      
      const fileNameTitle = `${validFiles.length} موظف | من ${minDateStr} إلى ${maxDateStr} | بواسطة: ${currentUserName}`;

      const { data: importRecord, error: importError } = await supabase
        .from('attendance_imports')
        .insert([{ 
          file_name: fileNameTitle, 
          status: 'COMPLETED', 
          total_records: 0, 
          emp_count: validFiles.length,
          date_range: dateRangeStr,
          uploaded_by: currentUserName
        }])
        .select().single();

      if (importError) throw importError;

      let totalInsertedRecords = 0;

      for (const fileData of validFiles) {
        const newRecords = [];
        let currDate = new Date(minDateMs);
        const endD = new Date(maxDateMs);
        
        // 🔴 توليد سجل لكل يوم في الفترة عشان الموظف يظهر بالكامل سواء غايب أو حاضر
        while(currDate <= endD) {
          const y = currDate.getFullYear();
          const m = String(currDate.getMonth() + 1).padStart(2, '0');
          const d = String(currDate.getDate()).padStart(2, '0');
          const loopDateStr = `${y}-${m}-${d}`;

          const existingExcelRec = fileData.records.find(r => {
             const ry = r.date.getFullYear();
             const rm = String(r.date.getMonth() + 1).padStart(2, '0');
             const rd = String(r.date.getDate()).padStart(2, '0');
             return `${ry}-${rm}-${rd}` === loopDateStr;
          });

          const formatExcelTime = (excelTime: any, dateVal: any) => {
            if (excelTime === null || excelTime === undefined) return null;
            let dObj = new Date(dateVal);
            const totalSeconds = Math.round(excelTime * 86400);
            dObj.setUTCHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60);
            return dObj.toISOString();
          };

          newRecords.push({
            import_id: importRecord.id,
            emp_number: fileData.empNumber,
            date: loopDateStr,
            first_in: existingExcelRec ? formatExcelTime(existingExcelRec.in, currDate) : null,
            last_out: existingExcelRec ? formatExcelTime(existingExcelRec.out, currDate) : null,
            work_status: 'عمل'
          });

          currDate.setDate(currDate.getDate() + 1);
        }

        totalInsertedRecords += newRecords.length;

        const datesToUpdate = newRecords.map(r => r.date);
        const { data: dbExistingRecords } = await supabase
          .from('attendance_records')
          .select('id, date, first_in, last_out, work_status, emp_number')
          .eq('emp_number', fileData.empNumber)
          .in('date', datesToUpdate);

        const mergedRecords = newRecords.map(newRec => {
          const dbRec = dbExistingRecords?.find(r => r.date === newRec.date);
          if (dbRec) {
            return {
              id: dbRec.id,
              emp_number: dbRec.emp_number,
              date: dbRec.date,
              first_in: dbRec.first_in || newRec.first_in,
              last_out: dbRec.last_out || newRec.last_out,
              work_status: dbRec.work_status,
              import_id: newRec.import_id
            };
          }
          return newRec;
        });

        await supabase.from('attendance_records').upsert(mergedRecords, { onConflict: 'emp_number,date' });
      }

      await supabase.from('attendance_imports').update({ total_records: totalInsertedRecords }).eq('id', importRecord.id);

      const title = 'سجل بصمة جديد 📋';
      const body = `قام ${currentUserName} برفع ملف بصمة يشمل ${validFiles.length} موظف للفترة (${dateRangeStr}).`;
      
      await supabase.from('notifications').insert([{
        department_id: userRole === 'MANAGER' || userRole === 'DATA_ENTRY' ? userDeptId : null,
        title: title,
        body: body,
        target_url: '/attendance'
      }]);

      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: title, 
            body: body, 
            url: '/attendance',
            department_id: userRole === 'MANAGER' || userRole === 'DATA_ENTRY' ? userDeptId : null
          })
        });
      } catch (pushErr) {
        console.error("Push API Error:", pushErr);
      }

      setShowPreview(false); 
      showToast(`تم حفظ وتحديث ${totalInsertedRecords} سجل بصمة بنجاح!`, 'success'); 
      fetchImportsHistory();
    } catch (error) { 
      showToast('حدث خطأ أثناء الدمج أو الحفظ.', 'error'); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const extractTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const calculateDuration = (inIso: string | null, outIso: string | null, shiftName: string, dateStr: string) => {
    if (!inIso || !outIso) return null;
    let inDate = new Date(new Date(inIso).toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    let outDate = new Date(new Date(outIso).toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    
    const isNightShift = shiftName && (shiftName.includes('مسائي') || shiftName.includes('ليل') || shiftName.toLowerCase().includes('night'));
    const isFriday = new Date(dateStr).getDay() === 5;

    const inHrs = inDate.getHours();
    
    if (!isNightShift) {
      if (inHrs < 7) {
        inDate.setHours(7, 0, 0, 0);
      }
    } else {
      if (inHrs >= 12 && inHrs < 19) {
        inDate.setHours(19, 0, 0, 0);
      }
    }

    if (outDate < inDate) {
      outDate.setDate(outDate.getDate() + 1);
    }

    let durationHours = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);

    if (!isNightShift && isFriday) {
      durationHours -= 2;
    } else {
      durationHours -= 1;
    }

    if (durationHours <= 0) return null;
    return durationHours.toFixed(1);
  };

  const displayedImportDetails = importDetails
    .filter(emp => {
      const matchSearch = emp.empName.includes(searchEmp) || emp.empNumber.includes(searchEmp);
      const matchCompany = filterCompany === '' || emp.companyName === filterCompany;
      const matchShift = filterShift === '' || emp.shiftName === filterShift;
      return matchSearch && matchCompany && matchShift;
    })
    .sort((a, b) => {
      if (sortByProblems) return b.problemDays - a.problemDays; 
      return a.empName.localeCompare(b.empName, 'ar');
    });

  const uniqueImportCompanies = Array.from(new Set(importDetails.map(e => e.companyName))).filter(Boolean);
  const uniqueImportShifts = Array.from(new Set(importDetails.map(e => e.shiftName))).filter(Boolean);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col space-y-6 relative pb-10">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {viewMode === 'IMPORTS' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)] gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">سجل الحضور والانصراف</h1>
              <p className="text-gray-500 text-sm mt-1">رفع شيت البصمة وتحليله بذكاء. {(userRole === 'ADMIN' || userRole === 'MANAGER') && <span className="text-blue-600 font-bold">(اضغط على السطر لعرض تفاصيله)</span>}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                <div className="flex items-center w-full sm:w-auto gap-2 bg-slate-100 p-2 rounded-lg">
                  <input type="month" value={consolidatedMonth} onChange={e => setConsolidatedMonth(e.target.value)} className="border-none bg-white rounded-md text-sm font-bold px-2 py-1 outline-none w-full sm:w-auto" />
                  <button onClick={loadConsolidatedData} className="flex whitespace-nowrap items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-bold shadow-sm w-full sm:w-auto">
                    <Calendar size={16}/> العرض الشامل للشهر
                  </button>
                </div>
              )}
              
              {(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'DATA_ENTRY') && (
                <>
                  <input type="file" accept=".xlsx" multiple className="hidden" ref={fileInputRef} onChange={handleMultipleFilesUpload} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--color-navy-500)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition font-bold shadow-md">
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
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm whitespace-nowrap">
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
                        className={`border-b transition whitespace-nowrap ${userRole === 'ADMIN' || userRole === 'MANAGER' ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'}`}
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
        <div className="animate-in slide-in-from-right-4 space-y-4">
          <button onClick={() => { 
            if(selectedEmpRecords) {
              setSelectedEmpRecords(null);
              setShowOnlyProblems(false); 
            } else {
              setViewMode('IMPORTS');
              setSearchEmp('');
              setFilterCompany('');
              setFilterShift('');
            }
          }} className="flex items-center justify-center w-full sm:w-max gap-2 text-gray-500 hover:text-blue-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border transition print:hidden">
            <ArrowRight size={18}/> {selectedEmpRecords ? 'عودة لقائمة الموظفين' : 'إغلاق التفاصيل والعودة للرئيسية'}
          </button>

          {!selectedEmpRecords ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border w-full">
              <div className="bg-[var(--color-navy-900)] p-4 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base whitespace-nowrap">
                    <Users size={18} /> {viewMode === 'CONSOLIDATED' ? 'العرض الشامل للموظفين' : 'الموظفين في هذا الملف'}
                  </h3>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">{displayedImportDetails.length} موظف</span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search size={14} className="absolute right-2 top-2.5 text-gray-400" />
                    <input type="text" placeholder="بحث باسم أو رقم..." value={searchEmp} onChange={e => setSearchEmp(e.target.value)} className="w-full sm:w-auto pl-2 pr-7 py-2 text-xs text-gray-800 rounded bg-white outline-none font-bold" />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="flex-1 sm:flex-none py-2 px-2 text-xs text-gray-800 rounded bg-white outline-none font-bold">
                      <option value="">كل الشركات</option>
                      {uniqueImportCompanies.map((c:any) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="flex-1 sm:flex-none py-2 px-2 text-xs text-gray-800 rounded bg-white outline-none font-bold">
                      <option value="">كل الورديات</option>
                      {uniqueImportShifts.map((s:any) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setSortByProblems(!sortByProblems)} className={`w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded transition ${sortByProblems ? 'bg-orange-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                    <ArrowDownUp size={14}/> المشاكل أولاً
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-600 text-sm whitespace-nowrap">
                      <th className="p-4 font-semibold">الرقم الوظيفي</th>
                      <th className="p-4 font-semibold">اسم الموظف</th>
                      <th className="p-4 font-semibold text-center">أيام الشيت</th>
                      <th className="p-4 font-semibold text-center">حضور فعلي</th>
                      <th className="p-4 font-semibold text-center">مشاكل بصمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedImportDetails.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold">لا توجد نتائج مطابقة للبحث</td></tr> :
                     displayedImportDetails.map((emp: any, idx) => (
                      <tr key={idx} onClick={() => setSelectedEmpRecords(emp)} className="border-b hover:bg-blue-50 transition cursor-pointer group whitespace-nowrap">
                        <td className="p-4 font-bold text-gray-800">{emp.empNumber}</td>
                        <td className="p-4 font-black text-[var(--color-navy-800)]">
                          <div className="flex items-center justify-between">
                            {emp.empName} <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">عرض الأيام <ArrowRight size={12}/></span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{emp.shiftName} - {emp.companyName}</div>
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
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border w-full print:border-none print:shadow-none">
              <div className="bg-blue-50 p-4 border-b border-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:bg-white print:border-b-2 print:border-black">
                <div className="w-full">
                  <h3 className="font-black text-[var(--color-navy-900)] text-base sm:text-lg flex flex-wrap items-center gap-2">
                    <User size={20} className="text-blue-600 print:text-black"/> {selectedEmpRecords.empName}
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 sm:mt-0 print:border print:border-black print:text-black ${selectedEmpRecords.shiftName?.includes('ليل') || selectedEmpRecords.shiftName?.includes('مسائ') ? 'bg-indigo-100 text-indigo-800' : 'bg-orange-100 text-orange-800'}`}>
                      {selectedEmpRecords.shiftName?.includes('ليل') || selectedEmpRecords.shiftName?.includes('مسائ') ? '🌙' : '☀️'} {selectedEmpRecords.shiftName}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 font-bold mt-1 print:text-black">الرقم: {selectedEmpRecords.empNumber} | فترة التقرير: {selectedEmpRecords.totalSheetDays} أيام</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto print:hidden">
                  <button onClick={() => setShowOnlyProblems(!showOnlyProblems)} className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${showOnlyProblems ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'}`}>
                    <Filter size={16}/> {showOnlyProblems ? 'عرض الكل' : 'عرض المشاكل'}
                  </button>
                  <button onClick={handlePrint} className="w-full sm:w-auto px-4 py-2 bg-[var(--color-navy-500)] text-white rounded-lg text-sm font-bold shadow-md hover:bg-[var(--color-navy-700)] transition flex items-center justify-center gap-2">
                    <Printer size={16}/> طباعة
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto w-full">
                <table className="w-full text-center border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 text-sm whitespace-nowrap print:bg-gray-200 print:text-black">
                      <th className="p-3 sm:p-4 font-semibold text-right">التاريخ</th>
                      <th className="p-3 sm:p-4 font-semibold">دخول</th>
                      <th className="p-3 sm:p-4 font-semibold">خروج</th>
                      <th className="p-3 sm:p-4 font-semibold">المدة الصافية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmpRecords.records
                      .filter(rec => {
                        const isMissingDay = rec.isMissing || (!rec.first_in && !rec.last_out);
                        const hasMissingPunch = (!isMissingDay) && ((!rec.first_in && rec.last_out) || (rec.first_in && !rec.last_out));
                        if (showOnlyProblems) return hasMissingPunch;
                        return true;
                      })
                      .map((rec: any, idx) => {
                      const isMissingDay = rec.isMissing || (!rec.first_in && !rec.last_out);
                      const hasMissingPunch = (!isMissingDay) && ((!rec.first_in && rec.last_out) || (rec.first_in && !rec.last_out));
                      
                      const isLastDay = idx === selectedEmpRecords.records.length - 1;
                      const isPendingMerge = hasMissingPunch && rec.first_in && !rec.last_out && isLastDay;
                      const isProblem = hasMissingPunch && !isPendingMerge;

                      const duration = calculateDuration(rec.first_in, rec.last_out, selectedEmpRecords.shiftName, rec.date);

                      return (
                        <tr key={idx} className={`border-b transition whitespace-nowrap print:border-b-gray-300 print:text-black ${isProblem ? 'bg-orange-50 border-orange-200' : isPendingMerge ? 'bg-yellow-50' : isMissingDay ? 'bg-gray-50/50 opacity-70' : 'hover:bg-gray-50'}`}>
                          <td className="p-3 sm:p-4 font-bold text-gray-800 text-right flex items-center gap-2 print:text-black">
                            <CalendarDays size={16} className={`print:hidden ${isProblem ? 'text-orange-400' : isPendingMerge ? 'text-yellow-500' : isMissingDay ? 'text-gray-300' : 'text-blue-400'}`}/> {rec.date}
                            {isProblem && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] ml-2 border border-orange-200 print:border-black print:bg-white print:text-black hidden sm:inline-block">بصمة ناقصة</span>}
                            {isPendingMerge && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] ml-2 border border-yellow-200 print:border-black print:bg-white print:text-black hidden sm:inline-block">معلقة</span>}
                          </td>
                          <td className="p-3 sm:p-4 font-mono font-bold text-emerald-600 print:text-black">{!isMissingDay && rec.first_in ? extractTime(rec.first_in) : '-'}</td>
                          <td className="p-3 sm:p-4 font-mono font-bold text-rose-600 print:text-black">{!isMissingDay && rec.last_out ? extractTime(rec.last_out) : '-'}</td>
                          <td className="p-3 sm:p-4 print:text-black">
                            {duration ? (
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200 print:border-none print:bg-transparent">{duration} س</span>
                            ) : isMissingDay ? (
                              <span className="text-gray-400 text-xs font-bold flex justify-center items-center gap-1 print:text-black"><AlertCircle size={14} className="print:hidden"/> غياب</span>
                            ) : isPendingMerge ? (
                              <span className="text-yellow-600 text-xs font-bold flex justify-center items-center gap-1 print:text-black"><Activity size={14} className="print:hidden"/> منتظر</span>
                            ) : (
                              <span className="text-orange-500 text-xs font-bold flex justify-center items-center gap-1 print:text-black"><AlertCircle size={14} className="print:hidden"/> مشكلة</span>
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

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[var(--color-navy-900)]">معاينة موظفين الشيت</h2>
                <p className="text-xs sm:text-sm text-gray-500">تم استخراج {previewList.length} موظف من الشيت.</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-gray-50">
              {unknownEmployees.length > 0 && (
                <div className="mb-6 bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden w-full">
                  <div className="bg-orange-50 p-4 border-b border-orange-100">
                    <div className="flex items-center gap-2 text-orange-800 font-bold mb-1 text-sm sm:text-base">
                      <AlertCircle size={20} />
                      <span>{unknownEmployees.length} موظف غير مسجلين بإدارتك!</span>
                    </div>
                    <p className="text-xs text-orange-700">أكمل بياناتهم أدناه واضغط إضافة لتسجيلهم.</p>
                  </div>
                  
                  <div className="overflow-x-auto w-full max-h-[40vh]">
                    <table className="w-full text-right text-xs sm:text-sm whitespace-nowrap min-w-[800px]">
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
                              <input type="text" placeholder="المسمى..." value={unk.jobTitle} onChange={(e) => updateUnknownField(unk.empNumber, 'jobTitle', e.target.value)} className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500" />
                            </td>
                            <td className="p-2">
                              <select value={unk.companyId} onChange={(e) => updateUnknownField(unk.empNumber, 'companyId', e.target.value)} className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500">
                                <option value="" disabled>اختر شركة...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <select value={unk.shiftId} onChange={(e) => updateUnknownField(unk.empNumber, 'shiftId', e.target.value)} className="w-full border rounded p-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500">
                                <option value="" disabled>اختر وردية...</option>
                                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => handleInlineSaveUnknown(unk.empNumber)} disabled={unk.isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm disabled:opacity-50 transition w-full sm:w-auto">
                                {unk.isSaving ? 'جاري...' : 'إضافة'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {previewList.filter(f => f.status === 'valid').map((file, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border border-green-200 shadow-sm flex flex-col justify-between">
                    <div className="mb-2">
                      <h3 className="font-bold text-[var(--color-navy-900)] flex items-center gap-2 mb-1 text-sm"><User size={16} className="text-blue-500"/> {file.empName}</h3>
                      <div className="text-xs text-gray-700 font-semibold flex justify-between">
                        <span>الرقم: <span className="font-mono">{file.empNumber}</span></span>
                        <span>حضور: <span className={file.records.filter((r:any) => r.in !== null || r.out !== null).length > 0 ? "text-green-600" : "text-red-600"}>{file.records.filter((r:any) => r.in !== null || r.out !== null).length} ي</span></span>
                      </div>
                    </div>
                    <div className="mt-auto pt-2 border-t flex justify-end">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={12}/> جاهز للدمج</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t bg-white sm:rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs sm:text-sm font-semibold text-gray-600 w-full sm:w-auto text-center sm:text-right">
                جاهز للدمج: <span className="text-green-600 text-lg font-black">{previewList.filter(f => f.status === 'valid').length}</span> موظف 
                {unknownEmployees.length > 0 && <span className="text-orange-500 font-bold mx-2 block sm:inline">| تجاهل {unknownEmployees.length} غريب</span>}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button onClick={() => setShowPreview(false)} className="w-full sm:w-auto px-6 py-2.5 text-gray-600 hover:bg-gray-200 border rounded-lg font-bold text-sm transition">إلغاء</button>
                <button onClick={saveMultipleAttendance} disabled={isUploading || previewList.filter(f => f.status === 'valid').length === 0} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold shadow-md disabled:opacity-50 transition text-sm">
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