import ComingSoon from '@/components/ComingSoon';
import { CheckCircle } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الموافقات والاعتمادات | OT Audit',
  description: 'نظام اعتماد الإجازات والأذونات - قريباً',
};

export default function ApprovalsPage() {
  return (
    <ComingSoon
      title=" الموافقات والاعتمادات"
      description="شاشة مخصصة لمديري الإدارات لمراجعة وقبول أو رفض طلبات الإجازات والأذونات المقدمة من الموظفين ومدخلي البيانات. سيتم تفعيلها قريباً."
      icon={CheckCircle}
    />
  );
}