'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Bell, Filter, Trash2, Edit, PlusCircle, CheckCircle2, 
  AlertTriangle, Building2, Calendar as CalIcon, Loader2, FileSpreadsheet
} from 'lucide-react';

const PAGE_SIZE = 30;

export default function NotificationsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filterType, setFilterType] = useState('ALL'); 
  const [filterDept, setFilterDept] = useState('');
  const [filterReadStatus, setFilterReadStatus] = useState('ALL'); 
  
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    document.title = 'سجل الإشعارات | STAFFCORE';
    const userStr = localStorage.getItem('ot_user');
    if (!userStr) { router.push('/login'); return; }

    const user = JSON.parse(userStr);
    setUserRole(user.role);
    async function init() {
      const { data } = await supabase.from('users').select('department_id').eq('id', user.id).single();
      if (data?.department_id) setUserDeptId(data.department_id);
      
      fetchLookups(user.role, data?.department_id);
      fetchNotifications(user.role, data?.department_id, 0, false);
    }
    init();
  }, []);

  async function fetchLookups(role: string, deptId: string | null) {
    let query = supabase.from('departments').select('id, name');
    if (role === 'MANAGER' && deptId) query = query.eq('id', deptId);
    const { data } = await query;
    if (data) setDepartments(data);
  }

  async function fetchNotifications(role: string, deptId: string | null, pageIndex: number, isLoadMore: boolean) {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from('notifications')
        .select('*, departments(name)')
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (role === 'MANAGER' && deptId) query = query.eq('department_id', deptId);
      
      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        if (isLoadMore) {
          setNotifications(prev => [...prev, ...data]);
        } else {
          setNotifications(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const handleLoadMore = () => {
    const nextPageIndex = page + 1;
    setPage(nextPageIndex);
    fetchNotifications(userRole!, userDeptId, nextPageIndex, true);
  };

  async function markAllAsRead() {
    let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (userRole === 'MANAGER') query = query.eq('department_id', userDeptId);
    await query;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    window.dispatchEvent(new Event('new_notification')); 
  }

  // 🔴 الإضافة الذكية: توجيه مختلف حسب نوع الإشعار (تكليف أو تايم شيت)
  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      supabase.from('notifications').update({ is_read: true }).eq('id', notif.id).then(() => {
        window.dispatchEvent(new Event('new_notification'));
      });
    }

    // 🔴 1. التوجيه الذكي لصفحة التايم شيت
    if (notif.title === 'تم إصدار تايم شيت جديد') {
       // استخراج اسم الشركة من نص الإشعار باستخدام تعبير نمطي (Regex)
       const companyMatch = notif.body.match(/لشركة\s(.*?)\sعن/);
       const company = companyMatch ? companyMatch[1] : '';
       
       if (company) {
         router.push(`/timesheet?company=${encodeURIComponent(company)}`);
         return;
       } else {
         router.push('/timesheet');
         return;
       }
    }

    // 🔴 2. تجاهل إشعارات الحذف (لا يوجد شيء للتوجه إليه)
    if (notif.title.includes('حذف') || notif.title.includes('إلغاء')) {
      return;
    }

    // 🔴 3. التوجيه الافتراضي لباقي إشعارات التكاليف
    router.push('/assignments');
  };

  const filteredNotifications = notifications.filter(n => {
    let matchType = true;
    if (filterType === 'NEW') matchType = n.title.includes('جديدة') || n.title.includes('جديد');
    if (filterType === 'EDIT') matchType = n.title.includes('تعديل');
    if (filterType === 'DELETE') matchType = n.title.includes('حذف') || n.title.includes('إلغاء');
    if (filterType === 'TIMESHEET') matchType = n.title.includes('تايم شيت'); // فلتر التايم شيت الجديد

    let matchDept = true;
    if (filterDept) matchDept = n.department_id === filterDept;

    let matchReadStatus = true;
    if (filterReadStatus === 'UNREAD') matchReadStatus = !n.is_read;
    if (filterReadStatus === 'READ') matchReadStatus = n.is_read;

    return matchType && matchDept && matchReadStatus;
  });

  const getNotificationIcon = (title: string, isRead: boolean) => {
    const colorClass = isRead ? 'text-gray-400' : 
                       (title.includes('حذف') || title.includes('إلغاء')) ? 'text-red-500' : 
                       title.includes('تعديل') ? 'text-orange-500' : 
                       title.includes('تايم شيت') ? 'text-blue-500' : 'text-green-500';

    if (title.includes('حذف') || title.includes('إلغاء')) return <Trash2 className={colorClass} size={24} />;
    if (title.includes('تعديل')) return <Edit className={colorClass} size={24} />;
    if (title.includes('تايم شيت')) return <FileSpreadsheet className={colorClass} size={24} />;
    return <PlusCircle className={colorClass} size={24} />;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col space-y-6 pb-10 animate-in fade-in max-w-5xl mx-auto w-full">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-navy-900)] flex items-center gap-3">
            <Bell className="text-blue-600" size={28} /> مركز الإشعارات
          </h1>
          <p className="text-gray-500 text-sm font-bold mt-1">تابع جميع الأحداث والتغييرات التي تمت على النظام</p>
          
          <div className="mt-3">
            {unreadCount > 0 ? (
               <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-md border border-blue-200">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                 </span>
                 {unreadCount} إشعار غير مقروء
               </span>
            ) : (
               <span className="inline-flex items-center gap-1 text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-md border border-gray-200">
                 <CheckCircle2 size={14} /> لا توجد إشعارات جديدة
               </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={markAllAsRead} 
          disabled={unreadCount === 0}
          className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 px-4 py-2.5 rounded-lg font-bold transition border shadow-sm w-full md:w-auto justify-center"
        >
          <CheckCircle2 size={18} className={unreadCount > 0 ? "text-blue-500" : "text-gray-400"} /> 
          تحديد الكل كمقروء
        </button>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-[var(--color-navy-900)] w-full md:w-auto">
          <Filter size={20} className="text-blue-500"/> تصفية الأحداث:
        </div>
        <div className="flex flex-col md:flex-row flex-wrap gap-3 w-full md:w-auto">
          
          {userRole !== 'MANAGER' && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border w-full md:w-auto">
              <Building2 size={16} className="text-gray-400" />
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="bg-transparent outline-none text-sm font-bold w-full cursor-pointer text-gray-700">
                <option value="">كل الإدارات</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border w-full md:w-auto">
            <AlertTriangle size={16} className="text-gray-400" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-transparent outline-none text-sm font-bold w-full cursor-pointer text-gray-700">
              <option value="ALL">جميع الحركات</option>
              <option value="NEW">إضافة جديد</option>
              <option value="EDIT">تعديلات</option>
              <option value="DELETE">حذف وإلغاء</option>
              <option value="TIMESHEET">إصدار تايم شيت 📄</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border w-full md:w-auto">
            <CheckCircle2 size={16} className="text-gray-400" />
            <select value={filterReadStatus} onChange={e => setFilterReadStatus(e.target.value)} className="bg-transparent outline-none text-sm font-bold w-full cursor-pointer text-gray-700">
              <option value="ALL">كل الحالات</option>
              <option value="UNREAD">غير مقروء</option>
              <option value="READ">مقروء</option>
            </select>
          </div>

        </div>
      </div>

      <div className="flex flex-col space-y-4">
        {loading && page === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border text-center flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="font-bold text-gray-500">جاري تحميل السجل...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border text-center flex flex-col items-center gap-2">
            <Bell className="text-gray-300 mb-2" size={40} />
            <h3 className="font-black text-gray-600 text-lg">لا توجد إشعارات</h3>
            <p className="font-bold text-gray-400 text-sm">لم يتم العثور على أي إشعارات تطابق الفلاتر المحددة.</p>
          </div>
        ) : (
          <>
            {filteredNotifications.map(notif => (
              <div 
                key={notif.id} 
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notif)}
                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(notif)}
                className={`
                  relative flex items-start gap-4 p-5 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${notif.is_read 
                    ? 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md' 
                    : 'bg-blue-50/40 border-blue-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5'}
                `}
              >
                {!notif.is_read && (
                  <span className="absolute top-5 right-5 w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                )}

                <div className={`p-2 rounded-xl shadow-sm flex-shrink-0 ${notif.is_read ? 'bg-gray-50' : 'bg-white'}`}>
                  {getNotificationIcon(notif.title, notif.is_read)}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-1.5">
                    <h3 className={`text-base truncate ${notif.is_read ? 'font-bold text-gray-600' : 'font-black text-[var(--color-navy-900)]'}`}>
                      {notif.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {notif.departments && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                          {notif.departments.name}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1 whitespace-nowrap">
                        <CalIcon size={12}/> {new Date(notif.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${notif.is_read ? 'text-gray-500 font-medium' : 'text-gray-700 font-semibold'}`}>
                    {notif.body}
                  </p>
                  
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4 pb-8">
                <button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  className="bg-white border shadow-sm hover:bg-gray-50 text-blue-600 font-bold px-6 py-2.5 rounded-full transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? <><Loader2 className="animate-spin" size={18}/> جاري التحميل...</> : 'تحميل المزيد من الإشعارات'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}