import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';

// إعداد المفاتيح (VAPID)
webpush.setVapidDetails(
  'mailto: hseenergyasteel@gmail.com', // يفضل تحط إيميلك الحقيقي هنا
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  try {
    const { title, body, url, department_id, role } = await req.json();

    // 1. تحديد من سيستلم الإشعار (المدير، أو الأدمن)
    let query = supabase.from('push_subscriptions').select('*, users!inner(role, department_id)');
    
    // لو الإشعار يخص إدارة معينة، نبعته لمديرها والأدمن بس
    if (department_id) {
      query = query.or(`department_id.eq.${department_id},role.eq.ADMIN,role.eq.FACTORY_MANAGER`);
    }

    const { data: subscriptions, error } = await query;
    if (error || !subscriptions) throw new Error('لا توجد اشتراكات للإشعارات');

    // 2. إرسال الإشعار لكل المشتركين عبر جوجل (Web Push)
    const payload = JSON.stringify({ title, body, url });
    
    const pushPromises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(pushSubscription, payload).catch(err => {
        // لو الاشتراك منتهي (اليوزر مسح المتصفح)، نمسحه من الداتابيز
        if (err.statusCode === 410 || err.statusCode === 404) {
          supabase.from('push_subscriptions').delete().eq('id', sub.id).then();
        }
      });
    });

    await Promise.all(pushPromises);
    return NextResponse.json({ success: true, message: 'تم الإرسال للموبايلات بنجاح!' });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}