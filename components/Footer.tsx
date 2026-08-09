'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  
  if (pathname === '/login') return null;

  return (
    <footer className="print:hidden bg-white border-t py-6 mt-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-gray-600 text-sm font-bold">
          © {new Date().getFullYear()} Powrded by Ahmed Salah
        </p>
      </div>
    </footer>
  );
}