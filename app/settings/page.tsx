'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Settings, Building2, Briefcase, Clock, Users, ShieldCheck, 
  Plus, Edit, Trash2, CheckCircle2, AlertCircle, X, Search, Lock, UserCog, FileSpreadsheet, Upload, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SettingsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'USERS' | 'DEPTS' | 'COMPANIES' | 'SHIFTS'>('USERS');

  // البيانات
  const [usersList, setUsersList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔴 فلتر الإدارات للمستخدمين
  const [filterDept, setFilterDept] = useState<string>('');

  // المودال (النافذة المنبثقة الموحدة)
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [modalType, setModalType] = useState<'USER' | 'DEPT' | 'COMPANY' | 'SHIFT'>('USER');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // إشعارات
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    setTimeout(() => { document.title = 'إعدادات النظام | STAFFCORE'; }, 100);
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') { router.push('/'); return; }
    setUserRole(user.role);
    loadAllData();
  }, [router]);

  async function loadAllData() {
    setLoading(true);
    const [uRes, dRes, cRes, sRes] = await Promise.all([
      supabase.from('users').select('*, departments(name)').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('shifts').select('*').order('name')
    ]);

    if (uRes.data) setUsersList(uRes.data);
    if (dRes.data) setDepartments(dRes.data);
    if (cRes.data) setCompanies(cRes.data);
    if (sRes.data) setShifts(sRes.data);
    setLoading(false);
  }

 // تحديد وزن الصلاحية للترتيب (الأهم أولاً)
  const getRoleWeight = (role: string) => {
    if (role === 'ADMIN') return 1;
    if (role === 'FACTORY_MANAGER') return 2;
    if (role === 'MANAGER') return 3;
    if (role === 'DATA_ENTRY') return 4;
    return 5;
  };

  // تجميع وترتيب المستخدمين حسب الإدارات
  const groupedUsers = usersList.reduce((acc: any, user: any) => {
    const deptName = user.departments?.name || 'إدارة عليا  ';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(user);
    return acc;
  }, {});

  // ترتيب المستخدمين داخل كل مجموعة حسب الصلاحية
  Object.keys(groupedUsers).forEach(dept => {
    groupedUsers[dept].sort((a: any, b: any) => getRoleWeight(a.role) - getRoleWeight(b.role));
  });

  // ترتيب الجروبات (الإدارة العليا أولاً، ثم أبجدي)
  const sortedDeptNames = Object.keys(groupedUsers).sort((a, b) => {
    if (a === 'إدارة عليا  ') return -1;
    if (b === 'إدارة عليا  ') return 1;
    return a.localeCompare(b, 'ar');
  });

  const openModal = (type: 'USER' | 'DEPT' | 'COMPANY' | 'SHIFT', item?: any) => {
    setModalType(type);
    setEditId(item ? item.id : null);
    
    if (item) {
      setFormData(item);
    } else {
      if (type === 'USER') setFormData({ name: '', user_name: '', password: '', role: 'DATA_ENTRY', department_id: '' });
      else if (type === 'SHIFT') setFormData({ name: '', start_time: '08:00', end_time: '16:00' });
      else setFormData({ name: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const table = modalType === 'USER' ? 'users' : modalType === 'DEPT' ? 'departments' : modalType === 'COMPANY' ? 'companies' : 'shifts';
      
      let payload = { ...formData };
      delete payload.departments; 

      if (modalType === 'USER' && (payload.role === 'ADMIN' || payload.role === 'FACTORY_MANAGER')) {
        payload.department_id = null;
      }

      if (editId) {
        const { error } = await supabase.from(table).update(payload).eq('id', editId);
        if (error) throw error;
        showToast('تم التعديل بنجاح', 'success');
      } else {
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
        showToast('تمت الإضافة بنجاح', 'success');
      }
      setShowModal(false);
      loadAllData();
    } catch (err: any) {
      if (err.code === '23505') showToast('اسم المستخدم (User Name) مسجل مسبقاً!', 'error');
      else showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (table: string, id: string) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟ قد يؤثر ذلك على البيانات المرتبطة.')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      loadAllData();
    } catch (err) {
      showToast('لا يمكن الحذف لارتباط هذا العنصر ببيانات أخرى في النظام', 'error');
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setSubmitting(true);
        const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]);
        
        let tableToInsert = '';
        let recordsToInsert: any[] = [];

        if (activeTab === 'DEPTS') {
          tableToInsert = 'departments';
          recordsToInsert = data.map((row: any) => ({ name: row['اسم الإدارة'] })).filter((r:any) => r.name);
        } else if (activeTab === 'COMPANIES') {
          tableToInsert = 'companies';
          recordsToInsert = data.map((row: any) => ({ name: row['اسم الشركة'] })).filter((r:any) => r.name);
        } else if (activeTab === 'SHIFTS') {
          tableToInsert = 'shifts';
          recordsToInsert = data.map((row: any) => ({ 
            name: row['اسم الوردية'], start_time: row['وقت الدخول'] || '08:00', end_time: row['وقت الخروج'] || '16:00' 
          })).filter((r:any) => r.name);
        } else if (activeTab === 'USERS') {
          tableToInsert = 'users';
          recordsToInsert = data.map((row: any) => {
            const deptId = departments.find(d => d.name === row['الإدارة'])?.id || null;
            return {
              name: row['الاسم'], user_name: row['اليوزر'], password: String(row['الباسورد']), 
              role: row['الصلاحية'] === 'مدير نظام' ? 'ADMIN' : row['الصلاحية'] === 'مدير مصنع' ? 'FACTORY_MANAGER' : row['الصلاحية'] === 'مدير إدارة' ? 'MANAGER' : 'DATA_ENTRY',
              department_id: deptId
            };
          }).filter((r:any) => r.name && r.user_name);
        }

        if (recordsToInsert.length === 0) throw new Error('الملف فارغ أو العناوين غير مطابقة للنموذج.');

        const { error } = await supabase.from(tableToInsert).insert(recordsToInsert);
        if (error) throw error;
        
        setShowExcelModal(false); 
        showToast(`تم إضافة ${recordsToInsert.length} سجل بنجاح!`, 'success');
        loadAllData();
      } catch (error: any) { 
        showToast(error.message || 'حدث خطأ في قراءة أو رفع الملف.', 'error'); 
      } finally { 
        setSubmitting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    let wsData: any[][] = [];
    let fileName = '';

    if (activeTab === 'DEPTS') { wsData = [['اسم الإدارة'], ['الموارد البشرية']]; fileName = 'نموذج_الإدارات.xlsx'; }
    else if (activeTab === 'COMPANIES') { wsData = [['اسم الشركة'], ['إنرجيا للكابلات']]; fileName = 'نموذج_الشركات.xlsx'; }
    else if (activeTab === 'SHIFTS') { wsData = [['اسم الوردية', 'وقت الدخول', 'وقت الخروج'], ['صباحية', '08:00', '16:00']]; fileName = 'نموذج_الورديات.xlsx'; }
    else if (activeTab === 'USERS') { wsData = [['الاسم', 'اليوزر', 'الباسورد', 'الصلاحية', 'الإدارة'], ['أحمد', 'ahmed123', '123456', 'مدير إدارة', 'الموارد البشرية']]; fileName = 'نموذج_المستخدمين.xlsx'; }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
  };

  if (userRole !== 'ADMIN') return null;

  return (
    <div className="relative w-full min-h-screen bg-gray-50 animate-in fade-in pb-10">
      
      {toast.show && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl z-50 transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* الهيدر العلوي */}
      <div className="bg-[var(--color-navy-900)] text-white pt-10 pb-16 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 flex items-center gap-4">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/20"><Settings size={35} className="text-blue-300" /></div>
          <div>
            <h1 className="text-3xl font-black mb-2 tracking-tight">إعدادات النظام</h1>
            <p className="text-blue-200 font-bold text-sm max-w-xl">تحكم كامل في الهيكل التنظيمي، الورديات، وصلاحيات دخول المستخدمين.</p>
          </div>
        </div>
      </div>

      {/* محتوى الإعدادات */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-8 relative z-20 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 h-max">
          <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'USERS' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <UserCog size={18}/> إدارة المستخدمين
          </button>
          <button onClick={() => setActiveTab('DEPTS')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'DEPTS' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Briefcase size={18}/> الإدارات والأقسام
          </button>
          <button onClick={() => setActiveTab('COMPANIES')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'COMPANIES' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Building2 size={18}/> الشركات
          </button>
          <button onClick={() => setActiveTab('SHIFTS')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'SHIFTS' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Clock size={18}/> مواعيد الورديات
          </button>
        </div>

        {/* Content Area */}
        <div className="w-full flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                {activeTab === 'USERS' && <><UserCog className="text-blue-500"/> حسابات الدخول</>}
                {activeTab === 'DEPTS' && <><Briefcase className="text-emerald-500"/> أقسام المصنع</>}
                {activeTab === 'COMPANIES' && <><Building2 className="text-purple-500"/> الشركات المسجلة</>}
                {activeTab === 'SHIFTS' && <><Clock className="text-orange-500"/> الورديات</>}
              </h2>
              
              <div className="flex gap-2 w-full md:w-auto">
                {activeTab === 'USERS' && (
                  <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg font-bold text-sm outline-none">
                    <option value="">كل الإدارات</option>
                    <option value="إدارة عليا ">إدارة عليا </option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                )}
                <button onClick={() => setShowExcelModal(true)} className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-green-600" /> بملف
                </button>
                <button onClick={() => openModal(activeTab === 'USERS' ? 'USER' : activeTab === 'DEPTS' ? 'DEPT' : activeTab === 'COMPANIES' ? 'COMPANY' : 'SHIFT')} className="bg-[var(--color-navy-900)] hover:bg-[var(--color-navy-800)] text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm flex items-center gap-2">
                  <Plus size={16} /> إضافة
                </button>
              </div>
            </div>

            {/* Tables Area */}
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-20 text-center font-bold text-gray-400">جاري تحميل البيانات...</div>
              ) : (
                <table className="w-full text-right">
                  <thead className="bg-gray-50 text-gray-500 text-xs border-b">
                    <tr>
                      {activeTab === 'USERS' && ( <><th className="p-4">الاسم بالكامل</th><th className="p-4">اسم المستخدم (للدخول)</th><th className="p-4">الصلاحية (Role)</th></> )}
                      {activeTab === 'DEPTS' && <th className="p-4">اسم الإدارة / القسم</th>}
                      {activeTab === 'COMPANIES' && <th className="p-4">اسم الشركة / المقاول</th>}
                      {activeTab === 'SHIFTS' && ( <><th className="p-4">اسم الوردية</th><th className="p-4 text-center">وقت الدخول</th><th className="p-4 text-center">وقت الخروج</th></> )}
                      <th className="p-4 text-center w-28">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    
                    {/* 🔴 Render Users Grouped by Department */}
                    {activeTab === 'USERS' && sortedDeptNames.filter(dept => filterDept === '' || dept === filterDept).map(deptName => (
                      <React.Fragment key={deptName}>
                        <tr className="bg-slate-100/50 border-b border-t"><td colSpan={4} className="p-3 font-black text-[var(--color-navy-800)] text-sm">{deptName}</td></tr>
                        {groupedUsers[deptName].map((u: any) => (
                          <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50/50 transition">
                            <td className="p-4 font-black text-gray-800">{u.name}</td>
                            <td className="p-4 text-gray-600 font-bold font-mono text-sm">{u.user_name || '-'}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded text-xs font-black ${u.role==='ADMIN'?'bg-rose-100 text-rose-800': u.role==='FACTORY_MANAGER'?'bg-purple-100 text-purple-800' : u.role==='MANAGER'?'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                {u.role === 'ADMIN' ? 'مدير نظام' : u.role === 'FACTORY_MANAGER' ? 'مدير مصنع' : u.role === 'MANAGER' ? 'مدير إدارة' : 'مدخل بيانات'}
                              </span>
                            </td>
                            <td className="p-4 flex gap-2 justify-center">
                              <button onClick={()=>openModal('USER', u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16}/></button>
                              <button onClick={()=>handleDelete('users', u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Render Departments */}
                    {activeTab === 'DEPTS' && departments.map(d => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50/50 transition">
                        <td className="p-4 font-black text-gray-800">{d.name}</td>
                        <td className="p-4 flex gap-2 justify-center">
                          <button onClick={()=>openModal('DEPT', d)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16}/></button>
                          <button onClick={()=>handleDelete('departments', d.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}

                    {/* Render Companies */}
                    {activeTab === 'COMPANIES' && companies.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50 transition">
                        <td className="p-4 font-black text-gray-800">{c.name}</td>
                        <td className="p-4 flex gap-2 justify-center">
                          <button onClick={()=>openModal('COMPANY', c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16}/></button>
                          <button onClick={()=>handleDelete('companies', c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}

                    {/* Render Shifts */}
                    {activeTab === 'SHIFTS' && shifts.map(s => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50/50 transition">
                        <td className="p-4 font-black text-gray-800">{s.name}</td>
                        <td className="p-4 text-center font-bold text-orange-600" dir="ltr">{s.start_time?.substring(0,5) || '-'}</td>
                        <td className="p-4 text-center font-bold text-indigo-600" dir="ltr">{s.end_time?.substring(0,5) || '-'}</td>
                        <td className="p-4 flex gap-2 justify-center">
                          <button onClick={()=>openModal('SHIFT', s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16}/></button>
                          <button onClick={()=>handleDelete('shifts', s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* مودال الإضافة / التعديل الفردي */}
      {/* ========================================== */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-gray-800">
                {editId ? 'تعديل البيانات' : 'إضافة سجل جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-600 transition"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {modalType === 'USER' ? 'الاسم بالكامل' : modalType === 'DEPT' ? 'اسم الإدارة' : modalType === 'COMPANY' ? 'اسم الشركة' : 'اسم الوردية'} *
                </label>
                <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" placeholder="اكتب هنا..." />
              </div>

              {modalType === 'USER' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم (للدخول)</label>
                      <input type="text" required value={formData.user_name || ''} onChange={e => setFormData({...formData, user_name: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 font-mono text-sm" placeholder="user123" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
                      <input type="text" required={!editId} value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" placeholder={editId ? 'فارغ لعدم التغيير' : '123456'} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نوع الصلاحية (Role)</label>
                    <select required value={formData.role || 'DATA_ENTRY'} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800">
                      <option value="DATA_ENTRY">مدخل بيانات (Data Entry)</option>
                      <option value="MANAGER">مدير إدارة (Manager)</option>
                      <option value="FACTORY_MANAGER">مدير مصنع (Factory Manager)</option>
                      <option value="ADMIN">مدير نظام (Admin)</option>
                    </select>
                  </div>
                  {(formData.role === 'MANAGER' || formData.role === 'DATA_ENTRY') && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">الإدارة التابع لها</label>
                      <select required value={formData.department_id || ''} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800">
                        <option value="" disabled>اختر الإدارة...</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {modalType === 'SHIFT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">وقت الحضور</label>
                    <input type="time" required value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 font-bold text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">وقت الانصراف (الأساسي)</label>
                    <input type="time" required value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800" />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition">إلغاء</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-[var(--color-navy-900)] hover:bg-[var(--color-navy-800)] text-white font-black rounded-lg shadow-sm transition disabled:opacity-50">
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* مودال الرفع بملف إكسيل */}
      {/* ========================================== */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-gray-800">إضافة (إكسيل) لـ {activeTab === 'USERS' ? 'المستخدمين' : activeTab === 'DEPTS' ? 'الإدارات' : activeTab === 'COMPANIES' ? 'الشركات' : 'الورديات'}</h2>
              <button onClick={() => setShowExcelModal(false)} className="text-gray-400 hover:text-red-600"><X size={24} /></button>
            </div>
            
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} />
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition mb-4">
              <Upload size={32} className="mx-auto text-blue-500 mb-3" />
              <p className="text-gray-800 font-bold mb-1">{submitting ? 'جاري قراءة الملف...' : 'اضغط لاختيار ملف إكسيل'}</p>
            </div>
            
            <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-200 py-2.5 rounded-lg hover:bg-green-100 font-bold transition">
              <FileSpreadsheet size={18} /><span>تحميل نموذج الإكسيل الفارغ</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}