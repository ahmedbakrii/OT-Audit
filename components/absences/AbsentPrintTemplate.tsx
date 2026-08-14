'use client';

import React from 'react';
import './absent-print.css';

export interface AbsentEmployee {
  emp_number?: string | number;

  employees?: {
    name?: string;
  };

  name?: string;

  reason?: string;

  remarks?: string;
}

export interface AbsentPrintData {
  date: string;

  departmentName?: string;

  sectionName?: string;

  shift?: string;

  companyType?: 'Energya' | 'Jawhara';

  employees: AbsentEmployee[];
}

interface AbsentPrintProps {
  data: AbsentPrintData;

  showPrintButton?: boolean;
}

export default function AbsentPrintTemplate({
  data,
  showPrintButton = true,
}: AbsentPrintProps) {

  const isJawhara =
    data.companyType === 'Jawhara';


  const formatDate = (date?: string) => {
    if (!date) return '';

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


  const getEmployeeName = (
    employee: AbsentEmployee
  ) => {
    return (
      employee.employees?.name ||
      employee.name ||
      ''
    );
  };


  return (
    <div className="absent-page">

      {/* =====================================================
          PRINT BUTTON
      ===================================================== */}

      {showPrintButton && (
        <div className="absent-print-controls no-print">

          <button
            type="button"
            onClick={() => window.print()}
            className="absent-print-button"
          >
            طباعة كشف الغياب
          </button>

        </div>
      )}


      {/* =====================================================
          A4 PAPER
      ===================================================== */}

      <div className="absent-print">


        {/* ===================================================
            HEADER
        =================================================== */}

        <table className="absent-header">

          <tbody>

            <tr>


              {/* COMPANY */}

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
                  Absent List
                </div>

                <div className="title-ar">
                  كشف الغياب
                </div>

              </td>


              {/* FORM NUMBER */}

              <td className="header-form">

                <div>
                  Form No:
                </div>

                <div className="form-number">
                  HHE-HR-FO-030
                </div>

                <div>
                  Issue A/0
                </div>

              </td>


            </tr>

          </tbody>

        </table>


        {/* ===================================================
            INFORMATION
        =================================================== */}

        <table className="absent-info">

          <tbody>


            {/* DATE / DEPARTMENT */}

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
                  Dept./ Section
                </span>

                <span className="info-ar">
                  (القسم)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value strong">
                  {data.departmentName ||
                    data.sectionName ||
                    ''}
                </span>

              </td>

            </tr>


            {/* SHIFT */}

            <tr>

              <td className="info-left">

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


              <td className="info-right">

                <span className="info-label">
                  Time Sheet
                </span>

                <span className="info-ar">
                  (الوردية)
                </span>

                <span className="info-colon">
                  :
                </span>

                <span className="info-value strong">
                  {data.shift || ''}
                </span>

              </td>

            </tr>

          </tbody>

        </table>


        {/* ===================================================
            JAWHARA LABEL
        =================================================== */}

        {isJawhara && (
          <div className="jawhara-label">
            (جــواهـــر)
          </div>
        )}


        {/* ===================================================
            ABSENT EMPLOYEES TABLE
        =================================================== */}

        <table className="absent-table">


          <colgroup>

            <col className="col-no" />

            <col className="col-name" />

            <col className="col-id" />

            <col className="col-reason" />

            <col className="col-remarks" />

          </colgroup>


          <thead>

            <tr>


              <th>
                م
              </th>


              <th>

                <div>
                  Employee Name
                </div>

                <div>
                  اسماء الغياب
                </div>

              </th>


              <th>

                <div>
                  Emp. ID
                </div>

                <div>
                  الرقم
                </div>

                <div>
                  الوظيفي
                </div>

              </th>


              <th>

                <div>
                  Reason of Absent
                </div>

                <div>
                  سبب الغياب
                </div>

              </th>


              <th>

                <div>
                  Remarks
                </div>

                <div>
                  ملاحظات
                </div>

              </th>


            </tr>

          </thead>


          <tbody>

            {data.employees?.map(
              (employee, index) => (

                <tr
                  key={`${employee.emp_number || 'employee'}-${index}`}
                  className="absent-row"
                >

                  <td>
                    {index + 1}
                  </td>


                  <td className="employee-name">
                    {getEmployeeName(employee)}
                  </td>


                  <td>
                    {employee.emp_number || ''}
                  </td>


                  <td className="reason-cell">
                    {employee.reason || ''}
                  </td>


                  <td className="remarks-cell">
                    {employee.remarks || ''}
                  </td>

                </tr>

              )
            )}

          </tbody>

        </table>


        {/* ===================================================
            SIGNATURE
        =================================================== */}

        <div className="signature-section">


          <div className="signature-box">

            <div className="signature-title">
              Head of Warehousing
            </div>

            <div className="signature-ar">
              رئيس المخازن
            </div>

            <div className="signature-line">
              ................................................
            </div>

          </div>


          <div className="signature-box">

            <div className="signature-title">
              Department Manager
            </div>

            <div className="signature-ar">
              مدير الإدارة
            </div>

            <div className="signature-line">
              ................................................
            </div>

          </div>


          <div className="signature-box">

            <div className="signature-title">
              Direct Manager
            </div>

            <div className="signature-ar">
              الرئيس المباشر
            </div>

            <div className="signature-line">
              ................................................
            </div>

          </div>


        </div>


      </div>

    </div>
  );
}