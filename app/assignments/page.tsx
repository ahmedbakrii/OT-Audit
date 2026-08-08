'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Clock, Users, Calendar, Filter, Save, Trash2, Search, Eye, X } from 'lucide-react';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // الإشعارات
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  
  // بيانات الفورم
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [endHour, setEndHour] = useState('22');
  const [endMinute, setEndMinute] = useState('00');

  // الموظفين المتاحين والتحديد
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmpNumbers, setSelectedEmpNumbers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // فلاتر الموظفين
  const [searchEmp, setSearchEmp] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterJob, setFilterJob] = useState('');

  // تفاصيل التكليف (للعرض)
  const [viewAssignment, setViewAssignment] = useState<any | null>(null);

  useEffect(() => {
    document.title = 'إدارة التكليفات | OT Audit';
    fetchLookups();
    fetchAssignmentsHistory();
  }, []);

  useEffect(() => {
    if (selectedDept && selectedShift) {
      fetchEmployeesByDeptAndShift();
    } else {
      setAvailableEmployees([]);
      setSelectedEmpNumbers([]);
    }
  }, [selectedDept, selectedShift]);

  async function fetchLookups() {
    const [{ data: deptData }, { data: shiftData }] = await Promise.all([
      supabase.from('departments').select('id, name'),
      supabase.from('shifts').select('id, name')
    ]);
    if (deptData) setDepartments(deptData);
    if (shiftData) setShifts(shiftData);
  }

  async function fetchAssignmentsHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ot_assignments')
        .select(`
          id, date, end_time, status, created_at,
          departments(name), shifts(name),
          ot_assignment_employees(
            emp_number,
            employees(name, job_title, companies(name))
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployeesByDeptAndShift() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('emp_number, name, job_title, companies(name)')
        .eq('department_id', selectedDept)
        .eq('shift_id', selectedShift);

      if (error) throw error;
      setAvailableEmployees(data || []);
      setSelectedEmpNumbers((data || []).map(emp => emp.emp_number));
    } catch (error) {
      console.error(error);
    }
  }

  // --- لوجيك الفلترة والتحديد ---
  const displayedEmployees = availableEmployees.filter(emp => {
    const matchSearch = emp.name.includes(searchEmp) || emp.emp_number.includes(searchEmp);
    const matchCompany = filterCompany ? emp.companies?.name === filterCompany : true;
    const matchJob = filterJob ? emp.job_title === filterJob : true;
    return matchSearch && matchCompany && matchJob;
  });

  const uniqueCompanies = Array.from(new Set(availableEmployees.map(e => e.companies?.name))).filter(Boolean);
  const uniqueJobs = Array.from(new Set(availableEmployees.map(e => e.job_title))).filter(Boolean);

  const handleSelectAllDisplayed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const displayedIds = displayedEmployees.map(emp => emp.emp_number);
    if (e.target.checked) {
      // إضافة المعروضين للتحديد الحالي
      const newSelections = new Set([...selectedEmpNumbers, ...displayedIds]);
      setSelectedEmpNumbers(Array.from(newSelections));
    } else {
      // إزالة المعروضين من التحديد
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => !displayedIds.includes(id)));
    }
  };

  const handleSelectEmp = (empNumber: string) => {
    if (selectedEmpNumbers.includes(empNumber)) {
      setSelectedEmpNumbers(selectedEmpNumbers.filter(id => id !== empNumber));
    } else {
      setSelectedEmpNumbers([...selectedEmpNumbers, empNumber]);
    }
  };

  // --- حفظ التكليف ---
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmpNumbers.length === 0) return showToast('يجب تحديد موظف واحد على الأقل للتكليف!', 'error');

    setIsSubmitting(true);
    try {
      const { data: assignment, error: assignError } = await supabase
        .from('ot_assignments')
        .insert([{
          date: selectedDate, department_id: selectedDept, shift_id: selectedShift,
          end_time: `${endHour}:${endMinute}:00`,
          status: 'APPROVED'
        }]).select().single();

      if (assignError) throw assignError;

      const empRecords = selectedEmpNumbers.map(emp_number => ({ assignment_id: assignment.id, emp_number }));
      const { error: empError } = await supabase.from('ot_assignment_employees').insert(empRecords);
      if (empError) throw empError;

      showToast('تم إنشاء التكليف واعتماده بنجاح!', 'success');
      setSelectedDept(''); setSelectedShift(''); setAvailableEmployees([]); setSelectedEmpNumbers([]); fetchAssignmentsHistory();
    } catch (error) { showToast('حدث خطأ أثناء إنشاء التكليف.', 'error'); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا التكليف بالكامل؟')) return;
    try {
      await supabase.from('ot_assignments').delete().eq('id', id);
      showToast('تم إلغاء التكليف بنجاح.', 'success'); fetchAssignmentsHistory();
    } catch (error) { showToast('حدث خطأ أثناء الحذف.', 'error'); }
  };

  return (
    <div className="flex flex-col space-y-6 relative">
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-t-4 border-[var(--color-navy-500)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-900)]">إدارة تكليفات العمل الإضافي (OT)</h1>
          <p className="text-gray-500 text-sm mt-1">تحديد الموظفين وتكليفهم بساعات إضافية معتمدة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* قسم إنشاء التكليف (أخد مساحة أكبر شوية عشان الفلاتر) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-semibold text-[var(--color-navy-900)]">
            <Filter size={18} /> إنشاء تكليف جديد
          </div>
          <form onSubmit={handleCreateAssignment} className="p-5 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <div className="relative">
                  <Calendar size={18} className="absolute right-3 top-2.5 text-gray-400" />
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full border rounded-lg pl-3 pr-10 py-2 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">وقت الانصراف *</label>
                <div className="flex gap-2 dir-ltr">
                  <select value={endMinute} onChange={(e) => setEndMinute(e.target.value)} className="w-1/2 border rounded-lg p-2 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] text-center font-bold">
                    <option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                  </select>
                  <span className="self-center font-bold text-gray-500">:</span>
                  <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="w-1/2 border rounded-lg p-2 outline-none focus:ring-2 focus:ring-[var(--color-navy-500)] text-center font-bold">
                    {Array.from({length: 24}).map((_, i) => { const h = i.toString().padStart(2,'0'); return <option key={h} value={h}>{h}</option>; })}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">القسم *</label>
                <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required>
                  <option value="" disabled>اختر...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوردية *</label>
                <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full border rounded-lg p-2 outline-none" required>
                  <option value="" disabled>اختر...</option>{shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {selectedDept && selectedShift && (
              <div className="mt-2 flex-1 flex flex-col border-t pt-4">
                <div className="text-sm font-bold text-[var(--color-navy-900)] mb-3 flex items-center justify-between">
                  <span>تحديد الموظفين ({selectedEmpNumbers.length} من {availableEmployees.length})</span>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-navy-500)] cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-[var(--color-navy-500)]" 
                      checked={displayedEmployees.length > 0 && displayedEmployees.every(emp => selectedEmpNumbers.includes(emp.emp_number))} 
                      onChange={handleSelectAllDisplayed} /> تحديد المعروض
                  </label>
                </div>

                {/* فلاتر الموظفين */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="relative col-span-3">
                    <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
                    <input type="text" placeholder="بحث بالاسم أو الرقم..." value={searchEmp} onChange={(e)=>setSearchEmp(e.target.value)} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm outline-none" />
                  </div>
                  <select value={filterCompany} onChange={(e)=>setFilterCompany(e.target.value)} className="col-span-1 border rounded-lg p-2 text-xs outline-none">
                    <option value="">كل الشركات</option>{uniqueCompanies.map((c: any) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filterJob} onChange={(e)=>setFilterJob(e.target.value)} className="col-span-2 border rounded-lg p-2 text-xs outline-none">
                    <option value="">كل المهن</option>{uniqueJobs.map((j: any) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>

                <div className="flex-1 max-h-56 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1">
                  {displayedEmployees.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-4">لا يوجد موظفين يطابقون البحث.</div>
                  ) : (
                    displayedEmployees.map(emp => (
                      <label key={emp.emp_number} className="flex items-center gap-3 p-2 bg-white hover:bg-blue-50 rounded border cursor-pointer transition shadow-sm">
                        <input type="checkbox" className="w-4 h-4 accent-[var(--color-navy-500)]" checked={selectedEmpNumbers.includes(emp.emp_number)} onChange={() => handleSelectEmp(emp.emp_number)} />
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-bold text-gray-800">{emp.name}</p>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{emp.companies?.name}</span>
                          </div>
                          <p className="text-xs text-gray-500">{emp.emp_number} - {emp.job_title}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={isSubmitting || selectedEmpNumbers.length === 0} className="w-full bg-green-600 text-white py-3 rounded-lg mt-4 hover:bg-green-700 transition font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={18} /> {isSubmitting ? 'جاري الاعتماد...' : 'اعتماد التكليف'}
            </button>
          </form>
        </div>

        {/* قسم سجل التكليفات */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-semibold text-[var(--color-navy-900)]">
            <Users size={18} /> سجل التكليفات المعتمدة
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[var(--color-neutral-100)] border-b text-[var(--color-navy-800)] text-sm">
                  <th className="p-4 font-semibold">التاريخ</th>
                  <th className="p-4 font-semibold">القسم والوردية</th>
                  <th className="p-4 font-semibold">وقت الانصراف</th>
                  <th className="p-4 font-semibold text-center">العدد</th>
                  <th className="p-4 font-semibold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr> : 
                 assignments.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد تكليفات مسجلة.</td></tr> :
                 assignments.map((assign) => (
                    <tr key={assign.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-800 font-medium whitespace-nowrap">
                        {new Date(assign.date).toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold text-[var(--color-navy-800)]">{assign.departments?.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{assign.shifts?.name}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm border border-red-100 dir-ltr inline-block">
                          {assign.end_time.substring(0, 5)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                          {assign.ot_assignment_employees?.length || 0}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setViewAssignment(assign)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition" title="عرض التفاصيل">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => handleDeleteAssignment(assign.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition" title="إلغاء التكليف">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* شاشة عرض تفاصيل التكليف (View Assignment Modal) */}
      {viewAssignment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-navy-900)]">تفاصيل التكليف</h2>
                <div className="text-sm text-gray-500 mt-2 flex gap-4">
                  <span>📅 {new Date(viewAssignment.date).toLocaleDateString('ar-EG')}</span>
                  <span>🏢 {viewAssignment.departments?.name} ({viewAssignment.shifts?.name})</span>
                  <span className="text-red-600 font-bold">⏰ انصراف: {viewAssignment.end_time.substring(0,5)}</span>
                </div>
              </div>
              <button onClick={() => setViewAssignment(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 p-2 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="text-sm text-gray-700">
                    <th className="p-3 border-b">الرقم</th>
                    <th className="p-3 border-b">اسم الموظف</th>
                    <th className="p-3 border-b">المهنة</th>
                    <th className="p-3 border-b">الشركة</th>
                  </tr>
                </thead>
                <tbody>
                  {viewAssignment.ot_assignment_employees?.map((empRecord: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 font-medium">{empRecord.emp_number}</td>
                      <td className="p-3 font-bold text-[var(--color-navy-800)]">{empRecord.employees?.name}</td>
                      <td className="p-3 text-gray-600">{empRecord.employees?.job_title}</td>
                      <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{empRecord.employees?.companies?.name}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-white rounded-b-xl flex justify-between items-center">
              <span className="font-bold text-gray-700">الإجمالي: <span className="text-green-600">{viewAssignment.ot_assignment_employees?.length}</span> موظف مكلف</span>
              <button onClick={() => setViewAssignment(null)} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}