import './globals.css'
import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PWAInit from '@/components/PWAInit'

const cairo = Cairo({ subsets: ['arabic'] })

export const metadata: Metadata = {
  title: {
    default: 'STAFFCORE', 
    template: '%s', 
  },
  description: 'النظام المركزي لإدارة العمليات، شؤون الموظفين، والمطابقة الذكية',
  manifest: '/manifest.json',
  
  appleWebApp: {
    capable: true,
    title: 'STAFFCORE',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/logo.png', 
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* 🔴 اللمسة السحرية: استدعاء خط الإيد الخاص بتاريخ الإمضاء */}
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className={`${cairo.className} bg-[var(--color-neutral-100)] flex flex-col min-h-screen text-[var(--color-navy-900)]`}>
        <Navbar />
        <PWAInit />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}