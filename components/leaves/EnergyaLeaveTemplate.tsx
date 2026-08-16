'use client';

import React from 'react';
import HSEManagerSignature from '@/components/HSEManagerSignature';

export interface EnergyaLeaveData {
  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  department: string;
  leaveType: 'annual' | 'deduct' | 'hajj' | 'other';
  startDate: string;
  endDate: string;
  leaveDays: number;
  replacementName?: string;
  requesterSignature?: string;
  requesterSignatureDate?: string;
  annualBalance?: string;
  balanceBeforeLeave?: string;
  balanceAfterLeave?: string;
  personnelSignature?: string;
  personnelSignatureDate?: string;
  managerDecision?: 'approved' | 'rejected';
  rejectionReason?: string;
  managerName?: string;
  managerTitle?: string;
  managerSignatureDate?: string;
  managementSignature?: string;
  managementSignatureDate?: string;
  logoSrc?: string;
}

interface EnergyaLeaveTemplateProps {
  data: EnergyaLeaveData;
  showPrintButton?: boolean;
}

function CheckBox({ checked = false }: { checked?: boolean }) {
  return <span className={`leave-checkbox ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>;
}

function DateLine({ label, value }: { label: string; value?: string; }) {
  return (
    <div className="eng-date-row">
      <span className="eng-date-label">{label}</span>
      <span className="eng-date-value">{value || '____ / ____ / ______'}</span>
    </div>
  );
}

export default function EnergyaLeaveTemplate({ data, showPrintButton = true }: EnergyaLeaveTemplateProps) {
  return (
    <div className="leave-print-wrapper">
      {showPrintButton && (
        <div className="print-controls"><button type="button" onClick={() => window.print()} className="print-button">Print Leave Request</button></div>
      )}

      <div className="energya-page">
        {/* HEADER */}
        <div className="eng-header">
          <div className="eng-header-logo">
            {data.logoSrc ? <img src={data.logoSrc} alt="Energya" className="eng-logo" /> : (
              <div className="eng-logo-fallback"><strong>energya</strong><span>انيرجيا</span><small>Steel Solutions</small></div>
            )}
          </div>
          <div className="eng-header-title"><span>Leave Request</span><span className="eng-arabic-title">طلب إجازة</span></div>
          <div className="eng-header-form"><strong>Form:</strong><div>HHE-HR-FO-004</div><div>Issue A/1</div></div>
        </div>

        {/* EMPLOYEE SECTION */}
        <section className="eng-section eng-requester-section">
          <div className="eng-section-heading">
            <div className="eng-heading-en">This Section is to be filled by the Leave Requester:</div>
            <div className="eng-heading-ar">هذا الجزء يملأ بمعرفة طالب الإجازة:</div>
          </div>
          <div className="eng-field-row">
            <div className="eng-field-left"><span className="eng-label">Name:</span><span className="eng-line-value">{data.employeeName}</span></div>
            <div className="eng-field-right"><span className="eng-ar-label">الاسم:</span><span className="eng-ar-value">{data.employeeName}</span></div>
          </div>
          <div className="eng-field-row">
            <div className="eng-field-left eng-double">
              <div><span className="eng-label">Employee Code</span><span className="eng-line-value short">{data.employeeCode}</span></div>
              <div><span className="eng-label">Title:</span><span className="eng-line-value short">{data.jobTitle}</span></div>
            </div>
            <div className="eng-field-right eng-double">
              <div><span className="eng-ar-label">رقم الموظف:</span><span className="eng-ar-value">{data.employeeCode}</span></div>
              <div><span className="eng-ar-label">الوظيفة:</span><span className="eng-ar-value">{data.jobTitle}</span></div>
            </div>
          </div>
          <div className="eng-field-row">
            <div className="eng-field-left"><span className="eng-label">Sector / Department:</span><span className="eng-line-value">{data.department}</span></div>
            <div className="eng-field-right"><span className="eng-ar-label">القطاع / الإدارة:</span><span className="eng-ar-value">{data.department}</span></div>
          </div>
          <div className="eng-approval-intro">
            <span>Kindly approve my request for vacation as follows:</span><span dir="rtl">أرجو الموافقة على منحي إجازة وفقاً لما يلي:</span>
          </div>
          <div className="eng-leave-type">
            <div className="eng-leave-type-title"><strong>Type of Leave</strong><strong dir="rtl">نوع الإجازة:</strong></div>
            <div className="eng-leave-options">
              <div className="eng-option"><span>Annual</span><CheckBox checked={data.leaveType === 'annual'} /></div>
              <div className="eng-option"><span>Deduct</span><CheckBox checked={data.leaveType === 'deduct'} /></div>
              <div className="eng-option"><span>Hajj</span><CheckBox checked={data.leaveType === 'hajj'} /></div>
              <div className="eng-option"><span>Other</span><CheckBox checked={data.leaveType === 'other'} /></div>
            </div>
            <div className="eng-ar-leave-options">
              <div><span>سنوية</span><CheckBox checked={data.leaveType === 'annual'} /></div>
              <div><span>بالخصم</span><CheckBox checked={data.leaveType === 'deduct'} /></div>
              <div><span>لأداء الحج</span><CheckBox checked={data.leaveType === 'hajj'} /></div>
              <div><span>أخرى ...</span><CheckBox checked={data.leaveType === 'other'} /></div>
            </div>
          </div>
          <div className="eng-dates">
            <DateLine label="Leave Start Date:" value={data.startDate} />
            <div className="eng-date-ar"><span>تاريخ بدء الإجازة:</span><strong>{data.startDate}</strong></div>
            <DateLine label="Leave End Date:" value={data.endDate} />
            <div className="eng-date-ar"><span>تاريخ انتهاء الإجازة:</span><strong>{data.endDate}</strong></div>
            <div className="eng-days-row">
              <span>No of Leave Days:</span><strong>({data.leaveDays})</strong>
              <span className="arabic-days">عدد أيام الإجازة:</span><strong dir="rtl">({data.leaveDays} أيام)</strong>
            </div>
          </div>
          <div className="eng-signature-row">
            <div><span>Signature:</span><span className="signature-line">{data.requesterSignature || ''}</span></div>
            <div><span>Date:</span><span className="signature-line">{data.requesterSignatureDate || ''}</span></div>
            <div dir="rtl"><span>التوقيع:</span><span className="signature-line">{data.requesterSignature || ''}</span></div>
            <div dir="rtl"><span>التاريخ:</span><span className="signature-line">{data.requesterSignatureDate || ''}</span></div>
          </div>
          <div className="eng-replacement-row">
            <div><span>Replacement name:</span><span className="replacement-line">{data.replacementName}</span></div>
            <div><span>Signature:</span><span className="replacement-line">{data.replacementName ? '' : ''}</span></div>
            <div dir="rtl"><span>اسم الموظف البديل:</span></div>
            <div dir="rtl"><span>التوقيع:</span></div>
          </div>
        </section>

        {/* PERSONNEL SECTION */}
        <section className="eng-section eng-personnel-section">
          <div className="eng-section-heading">
            <div className="eng-heading-en">This Section is to be filled by the Personnel Section:</div>
            <div className="eng-heading-ar">هذا الجزء يملأ بمعرفة قسم الشؤون الإدارية:</div>
          </div>
          <div className="eng-balance-row">
            <div>Annual Balance:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
            <div dir="rtl">الرصيد السنوي:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
          </div>
          <div className="eng-balance-row">
            <div>Balance Before Leave:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
            <div dir="rtl">الرصيد قبل إجازة:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
          </div>
          <div className="eng-balance-row">
            <div>Balance After Leave:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
            <div dir="rtl">الرصيد بعد إجازة:<span className="balance-value">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span></div>
          </div>
          <div className="eng-personnel-signature">
            <div>Personnel Signature:<span className="long-line"></span></div>
            <div>Date:<span className="long-line"></span></div>
            <div dir="rtl">توقيع شؤون العاملين:<span className="long-line"></span></div>
            <div dir="rtl">التاريخ:<span className="long-line"></span></div>
          </div>
        </section>

        {/* DIRECT SUPERVISOR */}
        <section className="eng-section eng-supervisor-section">
          <div className="eng-section-heading">
            <div className="eng-heading-en">This Section is to be filled by the requester's Direct Supervisor:</div>
            <div className="eng-heading-ar">هذا الجزء يملأ بمعرفة الرئيس المباشر لطالب الإجازة:</div>
          </div>
          
          <div className="eng-decision-row">
            <div className="eng-decision-en">
              <span>I agree</span><CheckBox checked={data.managerDecision === 'approved'} />
              <span>I decline</span><CheckBox checked={data.managerDecision === 'rejected'} />
              <span>the Leave Request</span>
            </div>
            <div className="eng-decision-ar" dir="rtl">
              <span>أوافق</span><CheckBox checked={data.managerDecision === 'approved'} />
              <span>لا أوافق</span><CheckBox checked={data.managerDecision === 'rejected'} />
              <span>على طلب الإجازة</span>
            </div>
          </div>
          
          <div className="eng-reason-row">
            <span>Reason(s) for Decline:</span><span className="reason-line">{data.rejectionReason || ''}</span><span dir="rtl">سبب الرفض:</span>
          </div>
          
          <div className="eng-manager-row">
            <div><span>Name:</span><span className="manager-line font-bold text-gray-800">{data.managerName}</span></div>
            <div dir="rtl"><span>الاسم:</span><span className="manager-line font-bold text-gray-800">{data.managerName}</span></div>
          </div>
          <div className="eng-manager-row">
            <div><span>Title:</span><span className="manager-line">{data.managerTitle}</span></div>
            <div dir="rtl"><span>الوظيفة:</span><span className="manager-line">{data.managerTitle}</span></div>
          </div>

 {/* 🔴 منطقة التوقيع السحرية */}
          <div className="eng-manager-row relative mt-4">
            {/* الكلام الأساسي للورقة */}
            <div className="w-full flex justify-between">
              <div><span>Signature:</span><span className="manager-line"></span></div>
              <div dir="rtl"><span>التوقيع:</span><span className="manager-line"></span></div>
            </div>

            {/* 🔴 الختم يظهر فوق الكلام لو تم الاعتماد (تم رفعه لفوق بـ top-[-80px]) */}
            {data.managerDecision === 'approved' && (
              <div className="absolute top-[-80px] right-0 pr-8 w-1/2 flex justify-end pointer-events-none">
                <HSEManagerSignature approvalDate={data.managerSignatureDate} />
              </div>
            )}
          </div>
        </section>

        {/* MANAGEMENT */}
        <div className="eng-management">
          <div>Management Signature:<span className="management-line"></span></div>
          <div>Date:<span className="management-line"></span></div>
          <div dir="rtl">اعتماد الإدارة:<span className="management-line"></span></div>
          <div dir="rtl">التاريخ:<span className="management-line"></span></div>
        </div>

      </div>
    </div>
  );
}