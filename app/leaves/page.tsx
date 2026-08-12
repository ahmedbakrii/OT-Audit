import ComingSoon from '@/components/ComingSoon';
import { CalendarDays } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الإجازات | OT Audit',
  description: 'نظام إدارة الإجازات - قريباً',
};

export default function LeavesPage() {
  return (
    <ComingSoon
      title=" الأجـــــازات"
      description="نعمل حالياً على تجهيز نظام الإجازات. سيتم تفعيل الصفحة قريباً لتقديم طلبات الإجازات ومتابعتها وإدارتها بالكامل من خلال النظام."
      icon={CalendarDays}
    />
  );
}