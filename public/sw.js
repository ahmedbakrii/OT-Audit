self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker Activated for PWA & Push Notifications!');
});

// جوجل كروم بيشترط وجود دالة الـ fetch دي عشان يعترف بالتطبيق
self.addEventListener('fetch', (event) => {
  // بنسيبها فاضية مؤقتاً لأننا مش بنخزن بيانات أوفلاين حالياً
});

// ==========================================
// 🔴 الجزء الجديد الخاص باستقبال الإشعارات (Push Notifications)
// ==========================================
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo-name.png',
      badge: '/logo-name.png', // أيقونة صغيرة بتظهر في شريط الإشعارات
      dir: 'rtl',
      vibrate: [200, 100, 200, 100, 200], // نمط اهتزاز (رجّة) للموبايل
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // لما اليوزر يدوس على الإشعار من بره، يفتحله الموقع
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});