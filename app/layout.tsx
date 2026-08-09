import './globals.css'
import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const cairo = Cairo({ subsets: ['arabic'] })

export const metadata: Metadata = {
  title: 'OT Audit System',
  description: 'نظام التدقيق والمطابقة الذكي لساعات العمل الإضافية',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} bg-[var(--color-neutral-100)] flex flex-col min-h-screen text-[var(--color-navy-900)]`}>
        {/* النافبار */}
        <Navbar />
        
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