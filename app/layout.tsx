import './globals.css'
import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PWAInit from '@/components/PWAInit'

const cairo = Cairo({ subsets: ['arabic'] })

export const metadata: Metadata = {
  // استخدام القالب الذكي لأسماء التابات
  title: {
    default: 'STAFFCORE', // الاسم الافتراضي
    template: '%s', // الـ Next.js هيسمح للصفحات تغير الاسم براحتها
  },
  description: 'النظام المركزي لإدارة العمليات، شؤون الموظفين، والمطابقة الذكية',
  manifest: '/manifest.json',
  
  // اللمسة السحرية لأجهزة الآيفون والآيباد
  appleWebApp: {
    capable: true,
    title: 'STAFFCORE',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/logo.png', // لازم يكون عندك صورة logo.png في فولدر public
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body suppressHydrationWarning className={`${cairo.className} bg-[var(--color-neutral-100)] flex flex-col min-h-screen text-[var(--color-navy-900)]`}>
        {/* النافبار */}
        <Navbar />
        
        {/* مشغل التطبيق */}
        <PWAInit />
        
        {/* محتوى الصفحات */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* الفوتر */}
        <Footer />
      </body>
    </html>
  )
}