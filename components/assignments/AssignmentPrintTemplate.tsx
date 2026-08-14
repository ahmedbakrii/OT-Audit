'use client';

import React from 'react';
import './assignment-print.css';

export interface AssignmentPrintEmployee {
  emp_number?: string | number;

  employees?: {
    name?: string;
    job_title?: string;
  };

  basicEnd?: string;
  actualEnd?: string;

  totalHours?: string | number;
  remarks?: string;
}

export interface AssignmentPrintData {
  date: string;
  departmentName: string;
  employees: AssignmentPrintEmployee[];
  companyType?: 'Energya' | 'Jawhara';
}

interface AssignmentPrintProps {
  data: AssignmentPrintData;
  showPrintButton?: boolean;
}

export default function AssignmentPrintTemplate({
  data,
  showPrintButton = true,
}: AssignmentPrintProps) {
  const isJawhara = data.companyType === 'Jawhara';

  const formatDate = (date?: string) => {
    if (!date) return '//';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString('en-GB');
  };

  const getDayName = (date?: string) => {
    if (!date) return '';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'long',
    });
  };

  const calculateTotalHours = (
    from?: string,
    to?: string,
    providedTotal?: string | number
  ) => {
    if (
      providedTotal !== undefined &&
      providedTotal !== null &&
      providedTotal !== ''
    ) {
      return String(providedTotal);
    }

    if (!from || !to) {
      return '';
    }

    const parseTime = (time: string) => {
      const match = time.match(/^(\d{1,2}):(\d{2})$/);

      if (!match) return null;

      return {
        hours: Number(match[1]),
        minutes: Number(match[2]),
      };
    };

    const start = parseTime(from);
    const end = parseTime(to);

    if (!start || !end) {
      return '';
    }

    let startMinutes = start.hours * 60 + start.minutes;
    let endMinutes = end.hours * 60 + end.minutes;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    const totalMinutes = endMinutes - startMinutes;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours}`;
    }

    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  return (
    <div className="assignment-page">

      {showPrintButton && (
        <div className="assignment-print-controls no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="assignment-print-button"
          >
            طباعة التكليف
          </button>
        </div>
      )}

      <div className="assignment-print">

        {/* HEADER */}
        <table className="assignment-header">
          <tbody>
            <tr>

              {/* COMPANY LOGO */}
              <td className="header-company">
                <img
                  src="/energya-logo.png"
                  alt="Energya Steel Solutions"
                  className="company-logo"
                />
              </td>

              {/* TITLE */}
              <td className="header-title">
                <div className="title-en">
                  Overtime Approval
                </div>

                <div className="title-ar">
                  نموذج تكليف عمل إضافي
                </div>
              </td>

              {/* FORM NUMBER */}
              <td className="header-form">
                <div>Form No:</div>

                <div className="form-number">
                  HHE-HR-FO-029
                </div>

                <div>Issue A/1</div>
              </td>

            </tr>
          </tbody>
        </table>


        {/* DATE / DAY */}
        <table className="assignment-info">
          <tbody>

            <tr>
              <td className="info-left">
                <span className="info-label">
                  Date
                </span>

                <span className="info-ar">
                  (التاريخ)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value">
                  {formatDate(data.date)}
                </span>
              </td>

              <td className="info-right">
                <span className="info-label">
                  Day
                </span>

                <span className="info-ar">
                  (اليوم)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value">
                  {getDayName(data.date)}
                </span>
              </td>
            </tr>


            <tr>
              <td className="info-left">
                <span className="info-label strong">
                  Department
                </span>

                <span className="info-ar">
                  (الإدارة)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value strong">
                  {data.departmentName || ''}
                </span>
              </td>

              <td className="info-right">
                <span className="info-label strong">
                  Section
                </span>

                <span className="info-ar">
                  (القسم)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value strong">
                  {data.departmentName || ''}
                </span>
              </td>
            </tr>

          </tbody>
        </table>


        {/* JAWHARA LABEL */}
        {isJawhara && (
          <div className="jawhara-label">
            (جــواهـــر)
          </div>
        )}


        {/* EMPLOYEE TABLE */}
        <table className="assignment-table">

          <colgroup>
            <col className="col-no" />
            <col className="col-id" />
            <col className="col-name" />
            <col className="col-title" />
            <col className="col-time" />
            <col className="col-time" />
            <col className="col-total" />
            <col className="col-remarks" />
          </colgroup>

          <thead>
            <tr>

              <th>
                <div className="header-ar-only">
                  م
                </div>
              </th>

              <th>
                <div>Emp. ID</div>
                <div>رقم</div>
                <div>الوظيفي</div>
              </th>

              <th>
                <div>Name</div>
                <div>الإســــــــم</div>
              </th>

              <th>
                <div>Title</div>
                <div>الوظيفة</div>
              </th>

              <th>
                <div>From</div>
                <div>من</div>
                <div>الساعة</div>
              </th>

              <th>
                <div>To</div>
                <div>إلى</div>
                <div>الساعة</div>
              </th>

              <th>
                <div>Total</div>
                <div>عدد</div>
                <div>الساعات</div>
              </th>

              <th>
                <div>Remarks</div>
                <div>ملاحظات</div>
              </th>

            </tr>
          </thead>

          <tbody>

            {data.employees?.map((employee, index) => {

              const name =
                employee.employees?.name || '';

              const jobTitle =
                employee.employees?.job_title || '';

              const employeeId =
                employee.emp_number !== undefined
                  ? String(employee.emp_number)
                  : '';

              const total =
                calculateTotalHours(
                  employee.basicEnd,
                  employee.actualEnd,
                  employee.totalHours
                );

              return (
                <tr
                  key={`${employeeId}-${index}`}
                  className="employee-row"
                >

                  <td>
                    {index + 1}
                  </td>

                  <td>
                    {employeeId}
                  </td>

                  <td className="employee-name">
                    {name}
                  </td>

                  <td className="employee-job">
                    {jobTitle}
                  </td>

                  <td className="time-cell">
                    {employee.basicEnd || ''}
                  </td>

                  <td className="time-cell">
                    {employee.actualEnd || ''}
                  </td>

                  <td className="total-cell">
                    {total}
                  </td>

                  <td className="remarks-cell">
                    {employee.remarks || ''}
                  </td>

                </tr>
              );
            })}

            {/* Keep the same 5 blank rows as the original Word form */}
            {Array.from({
              length: Math.max(
                0,
                5 - (data.employees?.length || 0)
              ),
            }).map((_, index) => (
              <tr
                key={`empty-row-${index}`}
                className="employee-row empty-row"
              >
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}

          </tbody>
        </table>


        {/* SIGNATURES */}
        <table className="signature-table">
          <tbody>
            <tr>

              {/* DIRECT MANAGER */}
              <td>
                <div className="signature-title">
                  <span>
                    Direct Manager
                  </span>

                  <span className="signature-ar">
                    (الرئيس المباشر)
                  </span>
                </div>

                <div className="signature-name">
                  Name <span>(الإسم)</span>:
                  <span className="dots">
                    .....................
                  </span>
                </div>

                <div className="signature-line">
                  Signature
                  <span>(التوقيع)</span>
                  :
                </div>
              </td>


              {/* HEAD OF DEPARTMENT */}
              <td>
                <div className="signature-title">
                  <span>
                    Head of Dept.
                  </span>

                  <span className="signature-ar">
                    (المسئول المهندس)
                  </span>
                </div>

                <div className="signature-name">
                  Name <span>(الإسم)</span>:
                  <span className="dots">
                    .....................
                  </span>
                </div>

                <div className="signature-line">
                  Signature
                  <span>(التوقيع)</span>
                  :
                </div>
              </td>


              {/* DEPARTMENT MANAGER */}
              <td>
                <div className="signature-title">
                  <span>
                    Department Manager
                  </span>

                  <span className="signature-ar">
                    (مدير الإدارة)
                  </span>
                </div>

                <div className="signature-name">
                  Name <span>(الإسم)</span>:
                  <span className="dots">
                    .....................
                  </span>
                </div>

                <div className="signature-line">
                  Signature
                  <span>(التوقيع)</span>
                  :
                </div>
              </td>

            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}