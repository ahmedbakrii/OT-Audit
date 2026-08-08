'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, UserPlus, FileSpreadsheet, X, Upload, CheckCircle2, AlertCircle, Trash2, Filter, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // الفلاتر
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [empNumber, setEmpNumber] = useState('');
  const [empName, setEmpName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'إدارة الموظفين | OT Audit';
    fetchEmployees();
    fetchLookups();
  }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select(`id, emp_number, name, job_title, status, company_id, department_id, shift_id, companies(name), departments(name), shifts(name)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

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

  // --- استخراج المسميات الوظيفية الفريدة للفلاتر ---
  const uniqueJobTitles = Array.from(new Set(employees.map(e => e.job_title))).filter(Boolean);

  // --- تطبيق الفلاتر على البيانات ---
  const filteredEmployees = employees.filter(emp => {
    return (
      (filterCompany === '' || emp.companies?.name === filterCompany) &&
      (filterDepartment === '' || emp.departments?.name === filterDepartment) &&
      (filterShift === '' || emp.shifts?.name === filterShift) &&
      (filterJobTitle === '' || emp.job_title === filterJobTitle)
    );
  });

  // --- دوال الألوان (تم تعديل ألوان الشركات بناءً على طلبك) ---
  const getShiftBadge = (shiftName: string) => {
    if (!shiftName) return '-';
    if (shiftName.includes('صباحي')) return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 shadow-sm">☀️ {shiftName}</span>;
    if (shiftName.includes('مسائي')) return <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 shadow-sm">🌙 {shiftName}</span>;
    return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">{shiftName}</span>;
  };

  const getCompanyBadge = (compName: string) => {
    if (!compName) return '-';
    if (compName.includes('انيرجيا')) return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md text-xs font-bold border border-emerald-200 shadow-sm">🏢 {compName}</span>;
    if (compName.includes('جواهر')) return <span className="bg-violet-100 text-violet-800 px-3 py-1 rounded-md text-xs font-bold border border-violet-200 shadow-sm">💎 {compName}</span>;
    if (compName.includes('مقاول')) return <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-md text-xs font-bold border border-rose-200 shadow-sm">👷 {compName}</span>;
    return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-bold shadow-sm">{compName}</span>;
  };

  const getJobTitleBadge = (title: string) => {
    if (!title || title === 'غير محدد') return '-';
    return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-300 font-semibold shadow-sm">{title}</span>;
  };

  // --- التحديد والحذف والتعديل --- (نفس اللوجيك القديم)
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(filteredEmployees.map(emp => emp.id));
    else setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  async function handleDeleteSelected() {
    if (!confirm('هل أنت متأكد من حذف الموظفين المحددين؟')) return;
    try {
      await supabase.from('employees').delete().in('id', selectedIds);
      showToast('تم حذف الموظفين بنجاح!', 'success');
      setSelectedIds([]); fetchEmployees();
    } catch (error) { showToast('حدث خطأ أثناء الحذف', 'error'); }
  }

  const resetForm = () => {
    setEditId(null); setEmpNumber(''); setEmpName(''); setJobTitle('');
    setSelectedCompany(''); setSelectedDepartment(''); setSelectedShift('');
  };

  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]+$/.test(empNumber)) return showToast('الرقم الوظيفي أرقام فقط!', 'error');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('employees').insert([{
        emp_number: empNumber, name: empName, job_title: jobTitle || 'غير محدد',
        company_id: selectedCompany || null, department_id: selectedDepartment || null, shift_id: selectedShift || null
      }]);
      if (error) throw error;
      setShowSingleModal(false); showToast('تم الحفظ بنجاح!', 'success');
      resetForm(); fetchEmployees();
    } catch (error: any) {
      if (error.code === '23505') showToast('الرقم مسجل مسبقاً!', 'error');
    } finally { setIsSubmitting(false); }
  }

  const openEditModal = (emp: any) => {
    setEditId(emp.id); setEmpNumber(emp.emp_number); setEmpName(emp.name); setJobTitle(emp.job_title || '');
    setSelectedCompany(emp.company_id || ''); setSelectedDepartment(emp.department_id || ''); setSelectedShift(emp.shift_id || '');
    setShowEditModal(true);
  };

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('employees').update({
        emp_number: empNumber, name: empName, job_title: jobTitle || 'غير محدد',
        company_id: selectedCompany || null, department_id: selectedDepartment || null, shift_id: selectedShift || null
      }).eq('id', editId);
      if (error) throw error;
      setShowEditModal(false); showToast('تم التحديث بنجاح!', 'success');
      resetForm(); fetchEmployees();
    } catch (error: any) { showToast('حدث خطأ أثناء التحديث.', 'error'); } 
    finally { setIsSubmitting(false); }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['الرقم الوظيفي', 'الاسم', 'المسمى الوظيفي', 'الشركة', 'القسم', 'الوردية'],['10001', 'أحمد محمد', 'مراقب سلامة', 'انيرجيا', 'السلامة والصحة المهنية', 'صباحي']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "نموذج_إضافة_الموظفين.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsSubmitting(true);
        const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]);
        const employeesToInsert = data.map((row: any) => {
          return {
            emp_number: String(row['الرقم الوظيفي']), name: row['الاسم'], job_title: row['المسمى الوظيفي'] || 'غير محدد',
            company_id: companies.find(c => c.name === row['الشركة'])?.id || null, 
            department_id: departments.find(d => d.name === row['القسم'])?.id || null, 
            shift_id: shifts.find(s => s.name === row['الوردية'])?.id || null
          };
        }).filter(emp => emp.emp_number && emp.name && emp.emp_number !== 'undefined');
        const { error } = await supabase.from('employees').insert(employeesToInsert);
        if (error) throw error;
        setShowExcelModal(false); showToast(`تم إضافة الموظفين بنجاح!`, 'success');
        fetchEmployees();
      } catch (error: any) { showToast('حدث خطأ في قراءة الملف.', 'error'); } 
      finally { setIsSubmitting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col space-y-4 relative">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800 border-r-4 border-green-500' : 'bg-red-100 text-red-800 border-r-4 border-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">إدارة الموظفين</h1>
          <p className="text-gray-500 text-sm mt-1">إجمالي: {filteredEmployees.length} موظف</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button onClick={handleDeleteSelected} className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition border border-red-200">
              <Trash2 size={18} /><span>حذف المحدد ({selectedIds.length})</span>
            </button>
          )}
          <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 bg-[var(--color-navy-500)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-navy-800)] transition">
              <span>+ إضافة</span><ChevronDown size={18} />
            </button>
            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border overflow-hidden z-10">
                <button onClick={() => { setIsMenuOpen(false); resetForm(); setShowSingleModal(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-right hover:bg-gray-50 border-b text-gray-700">
                  <UserPlus size={18} className="text-[var(--color-navy-500)]" /><span>موظف فردي</span>
                </button>
                <button onClick={() => { setIsMenuOpen(false); setShowExcelModal(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-right hover:bg-gray-50 text-gray-700">
                  <FileSpreadsheet size={18} className="text-green-600" /><span>شيت إكسل</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* شريط الفلاتر (Filters Bar) */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-[var(--color-navy-900)] font-semibold">
          <Filter size={18} /> الفرز حسب:
        </div>
        
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px]">
          <option value="">كل الشركات</option>
          {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px]">
          <option value="">كل الأقسام</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>

        <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px]">
          <option value="">كل الورديات</option>
          {shifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>

        <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] min-w-[150px]">
          <option value="">كل المهن</option>
          {uniqueJobTitles.map((title: any, idx) => <option key={idx} value={title}>{title}</option>)}
        </select>

        {(filterCompany || filterDepartment || filterShift || filterJobTitle) && (
          <button onClick={() => { setFilterCompany(''); setFilterDepartment(''); setFilterShift(''); setFilterJobTitle(''); }} className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-semibold transition mr-auto">
            <XCircle size={16} /> مسح الفلاتر
          </button>
        )}
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)]">
                <th className="p-4 w-12 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-[var(--color-navy-500)]" checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0} onChange={handleSelectAll} /></th>
                <th className="p-4 font-semibold">الرقم الوظيفي</th>
                <th className="p-4 font-semibold">الاسم</th>
                <th className="p-4 font-semibold">المهنة</th>
                <th className="p-4 font-semibold">الشركة</th>
                <th className="p-4 font-semibold">القسم</th>
                <th className="p-4 font-semibold">الوردية</th>
                <th className="p-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">جاري تحميل البيانات...</td></tr> : 
               filteredEmployees.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">لا يوجد موظفين يطابقون الفلتر الحالي.</td></tr> :
               filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`border-b transition ${selectedIds.includes(emp.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="p-4 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-[var(--color-navy-500)]" checked={selectedIds.includes(emp.id)} onChange={() => handleSelect(emp.id)} /></td>
                    <td className="p-4 font-medium text-gray-800">{emp.emp_number}</td>
                    <td className="p-4 font-bold text-gray-800">{emp.name}</td>
                    <td className="p-4">{getJobTitleBadge(emp.job_title)}</td>
                    <td className="p-4">{getCompanyBadge(emp.companies?.name)}</td>
                    <td className="p-4 text-gray-700 font-medium">{emp.departments?.name || '-'}</td>
                    <td className="p-4">{getShiftBadge(emp.shifts?.name)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => openEditModal(emp)} className="text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">تعديل</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* المودالز زي ما هي (مفيهاش تغيير جذري عن آخر مرة) */}
      {(showSingleModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--color-navy-900)]">{showEditModal ? 'تعديل الموظف' : 'إضافة موظف'}</h2>
              <button onClick={() => { setShowSingleModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={showEditModal ? handleUpdateEmployee : handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الوظيفي *</label>
                <input type="text" value={empNumber} onChange={(e) => setEmpNumber(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم رباعي *</label>
                <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المسمى الوظيفي *</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الشركة *</label>
                  <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required>
                    <option value="" disabled>اختر...</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">القسم *</label>
                  <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required>
                    <option value="" disabled>اختر...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوردية *</label>
                <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required>
                  <option value="" disabled>اختر...</option>{shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[var(--color-navy-500)] text-white py-2 rounded-lg mt-4 disabled:opacity-50">
                {isSubmitting ? 'جاري الحفظ...' : (showEditModal ? 'تحديث' : 'حفظ')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--color-navy-900)]">إضافة موظفين (Excel)</h2>
              <button onClick={() => setShowExcelModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} />
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer">
              <Upload size={32} className="mx-auto text-[var(--color-navy-500)] mb-3" />
              <p className="text-gray-800 font-semibold mb-1">{isSubmitting ? 'جاري المعالجة...' : 'اضغط لاختيار ملف'}</p>
            </div>
            <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 mt-6 rounded-lg hover:bg-green-700">
              <FileSpreadsheet size={18} /><span>تحميل النموذج</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}