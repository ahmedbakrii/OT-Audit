import type { Metadata } from "next";
import { Cairo } from "next/font/google"; 
import "./globals.css";

// استخدام خط كايرو ليكون مناسب وواضح للقراءة
const cairo = Cairo({ subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "OT Audit System",
  description: "نظام تدقيق الساعات الإضافية - HSE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>
        <main className="min-h-screen p-6">
          {children}
        </main>
      </body>
    </html>
  );
}