self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker Activated!');
});

// جوجل كروم بيشترط وجود دالة الـ fetch دي عشان يعترف بالتطبيق
self.addEventListener('fetch', (event) => {
  // بنسيبها فاضية مؤقتاً لأننا مش بنخزن بيانات أوفلاين حالياً
});