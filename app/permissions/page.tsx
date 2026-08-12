import ComingSoon from '@/components/ComingSoon';
import { Clock } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الأذونات | OT Audit',
  description: 'نظام إدارة الأذونات - قريباً',
};

export default function PermissionsPage() {
  return (
    <ComingSoon
      title=" الأذونــــات"
      description="نعمل حالياً على تجهيز نظام الأذونات. سيتم تفعيل الصفحة قريباً لتقديم طلبات الأذونات ومتابعتها وإدارتها بالكامل من خلال النظام."
      icon={Clock}
    />
  );
}