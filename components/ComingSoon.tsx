import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import React from 'react';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ElementType;
}

export default function ComingSoon({
  title,
  description,
  icon: Icon,
}: ComingSoonProps) {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-white max-w-2xl w-full p-8 md:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">

        {/* تأثيرات الخلفية */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-100 rounded-full blur-3xl opacity-50"></div>

        {/* الأيقونة المركزية */}
        <div className="relative mb-6 z-10">
          <div className="absolute inset-0 bg-[var(--color-navy-500)] rounded-2xl rotate-6 opacity-10"></div>

          <div className="bg-white p-5 rounded-2xl relative shadow-md border border-gray-100 text-[var(--color-navy-900)]">
            <Icon size={48} strokeWidth={1.5} />
          </div>
        </div>

        {/* العنوان */}
        <h1 className="text-3xl md:text-4xl font-black text-[var(--color-navy-900)] mb-2 z-10">
          {title}
        </h1>

        {/* الرسالة */}
        <p className="text-gray-600 font-semibold leading-relaxed max-w-lg mb-10 z-10">
          {description}
        </p>

        {/* العودة للرئيسية */}
        <Link
          href="/"
          className="group flex items-center gap-2 bg-[var(--color-navy-900)] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-600 hover:-translate-y-0.5 transition-all z-10"
        >
          <ArrowRight
            size={18}
            className="group-hover:-translate-x-1 transition-transform"
          />

          العودة للرئيسية
        </Link>

      </div>
    </div>
  );
}