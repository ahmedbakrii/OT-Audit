'use client';
import React from 'react';
import './assignment-print.css';

export interface AssignmentPrintData {
  date: string;
  departmentName: string;
  employees: any[];
  companyType?: 'Energya' | 'Jawhara';
}

interface AssignmentPrintProps {
  data: AssignmentPrintData;
  showPrintButton?: boolean;
}

export default function AssignmentPrintTemplate({ data, showPrintButton = true }: AssignmentPrintProps) {
  const isJawhara = data.companyType === 'Jawhara';

  return (
    <div className="w-full bg-white flex flex-col items-center py-2 print:py-0">
      {showPrintButton && (
        <div className="no-print w-[210mm] flex justify-end mb-4">
          <button onClick={() => window.print()} className="bg-[var(--color-navy-900)] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">
            🖨️ طباعة التكليف
          </button>
        </div>
      )}

      <div className="assignment-print">
        <table className="assignment-header break-inside-avoid">
          <tbody>
            <tr>
              <td className="header-company">
                <img src="/energya-logo.png" alt="Energya" className="company-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </td>
              <td className="header-title">
                <div className="title-en">Overtime Approval</div>
                <div className="title-ar">نموذج تكليف عمل إضافي</div>
              </td>
              <td className="header-form">
                <div>Form No:</div>
                <div className="form-number">HHE-HR-FO-029</div>
                <div>Issue A/1</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="assignment-info break-inside-avoid">
          <tbody>
            <tr>
              <td className="info-left"><span>Date</span><span dir="rtl">(التاريخ)</span> : <span className="info-value">{new Date(data.date).toLocaleDateString('en-GB')}</span></td>
              <td className="info-right"><span>Day</span><span dir="rtl">(اليوم)</span> : <span className="info-value">{new Date(data.date).toLocaleDateString('ar-EG', { weekday: 'long' })}</span></td>
            </tr>
            <tr>
              <td className="info-left"><span>Department</span><span dir="rtl">(الإدارة)</span> : <span className="info-value">{data.departmentName}</span></td>
              <td className="info-right"><span>Section</span><span dir="rtl">(القسم)</span> : <span className="info-value">{data.departmentName}</span></td>
            </tr>
          </tbody>
        </table>

        {/* 🔴 إضافة كلمة عمالة جواهر قبل الجدول لو كانت الشركة جوهرة */}
        {isJawhara && (
          <div className="text-center font-bold text-lg mt-4 mb-2 underline decoration-2 underline-offset-4 break-inside-avoid">
            جواء
          </div>
        )}

        <table className={`assignment-table ${!isJawhara ? 'mt-3' : ''}`}>
          <colgroup><col className="col-no"/><col className="col-id"/><col className="col-name"/><col className="col-title"/><col className="col-time"/><col className="col-time"/></colgroup>
          <thead>
            <tr>
              <th>م</th>
              <th><div>Emp. ID</div><div>رقم الوظيفي</div></th>
              <th><div>Name</div><div>الإســــــم</div></th>
              <th><div>Title</div><div>الوظيفة</div></th>
              <th><div>From</div><div>من الساعة</div></th>
              <th><div>To</div><div>إلى الساعة</div></th>
            </tr>
          </thead>
          <tbody>
            {data.employees?.map((emp, idx) => (
              <tr key={idx} className="break-inside-avoid">
                <td>{idx + 1}</td>
                <td>{emp.emp_number}</td>
                <td className="employee-name">{emp.employees?.name}</td>
                <td className="employee-job">{emp.employees?.job_title}</td>
                <td dir="ltr">{emp.basicEnd}</td>
                <td dir="ltr">{emp.actualEnd}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="signature-table break-inside-avoid">
          <tbody>
            <tr>
              <td>
                <div className="signature-title"><div>Direct Manager</div><div dir="rtl">(الرئيس المباشر)</div></div>
                <div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div>
                <div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div>
              </td>
              <td>
                <div className="signature-title"><div>Head of Dept.</div><div dir="rtl">(المسئول المهندس)</div></div>
                <div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div>
                <div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div>
              </td>
              <td>
                <div className="signature-title"><div>Department Manager</div><div dir="rtl">(مدير الإدارة)</div></div>
                <div className="signature-name">Name <span dir="rtl">(الإسم)</span> : .....................</div>
                <div className="signature-line">Signature <span dir="rtl">(التوقيع)</span> : </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}