'use client';

import React from 'react';

export interface PermissionFormData {
  company?: 'Energya' | 'Jawhara' | 'Contractor' | string;

  date?: string;
  employeeId?: string;
  name?: string;
  title?: string;
  section?: string;
  department?: string;

  timeOfExit?: string;
  timeOfEntry?: string;
  periodOfExit?: string;

  reason?: string;
  specialCircumstances?: string;

  deptHead?: string;
  deptManager?: string;
  hrManager?: string;
}

interface PermissionFormProps {
  data: PermissionFormData;
}

export default function PermissionForm({
  data,
}: PermissionFormProps) {
  const value = (text?: string) => text || '';

  return (
    <div className="permission-page">
      <div className="permission-paper">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="permission-header">

          {/* Company Logo */}
          <div className="header-company">

            <div className="energya-row">
              <img
                src="/energya-logo.png"
                alt="Energya Steel Solutions"
                className="energya-logo-image"
              />
            </div>
          </div>


          {/* Main Title */}
          <div className="header-title">

            <div className="main-title">
              Exit / Delay Permission
            </div>

            <div className="arabic-title">
              (تصريح خروج / تأخير)
            </div>

          </div>


          {/* Form Number */}
          <div className="header-form">

            <div className="form-label">
              Form No:
            </div>

            <div className="form-number">
              HHE-HR-FO-026
            </div>

            <div className="form-issue">
              Issue A/1
            </div>

          </div>

        </div>


        {/* =====================================================
            FORM BODY
        ===================================================== */}

        <div className="permission-content">


          {/* ===================================================
              DATE / EMPLOYEE ID
          =================================================== */}

          <div className="form-row row-1">

            <div className="left-field">

              <span className="label">
                Date <span className="arabic">(التاريخ)</span>:
              </span>

              <span className="value">
                {value(data.date)}
              </span>

            </div>


            <div className="right-field">

              <span className="label">
                Employee ID <span className="arabic">(رقم الموظف)</span>:
              </span>

              <span className="value">
                {value(data.employeeId)}
              </span>

            </div>

          </div>


          {/* ===================================================
              NAME / TITLE
          =================================================== */}

          <div className="form-row row-2">

            <div className="left-field">

              <span className="label">
                Name <span className="arabic">(الاسم)</span>:
              </span>

              <span className="value name-value">
                {value(data.name)}
              </span>

            </div>


            <div className="right-field">

              <span className="label">
                Title <span className="arabic">(الوظيفة)</span>:
              </span>

              <span className="value">
                {value(data.title)}
              </span>

            </div>

          </div>


          {/* ===================================================
              SECTION / DEPARTMENT
          =================================================== */}

          <div className="form-row row-3">

            <div className="left-field">

              <span className="label">
                Section <span className="arabic">(القسم)</span>:
              </span>

              <span className="value section-value">
                {value(data.section)}
              </span>

            </div>


            <div className="right-field">

              <span className="label">
                Department <span className="arabic">(الإدارة)</span>:
              </span>

              <span className="value">
                {value(data.department)}
              </span>

            </div>

          </div>


          {/* ===================================================
              EXIT / ENTRY TIME
          =================================================== */}

          <div className="form-row row-4">

            <div className="left-field">

              <span className="label">
                Time of Exit <span className="arabic">(وقت الخروج)</span>:
              </span>

              <span className="value">
                {value(data.timeOfExit)}
              </span>

            </div>


            <div className="right-field">

              <span className="label">
                Time of Entry <span className="arabic">(وقت الدخول)</span>:
              </span>

              <span className="value">
                {value(data.timeOfEntry)}
              </span>

            </div>

          </div>


          {/* ===================================================
              PERIOD / REASON
          =================================================== */}

          <div className="form-row row-5">

            <div className="left-field">

              <span className="label">
                Period of Exit <span className="arabic">(مدة الإذن)</span>:
              </span>

              <span className="value">
                {value(data.periodOfExit)}
              </span>

            </div>


            <div className="right-field">

              <span className="label">
                Reason for Permission <span className="arabic">(سبب الإذن)</span>:
              </span>

              <span className="value">
                {value(data.reason)}
              </span>

            </div>

          </div>


          {/* ===================================================
              SPECIAL CIRCUMSTANCES
          =================================================== */}

          <div className="special-section">

            <div className="special-title">
              ظروف خاصة
            </div>

            <div className="special-line">
              {value(data.specialCircumstances)}
            </div>

            <div className="special-line"></div>

          </div>


          {/* ===================================================
              APPROVALS
          =================================================== */}

          <div className="approval-section">


            {/* Dept. Head */}

            <div className="approval-column">

              <div className="approval-heading">
                Dept. Head
              </div>

              <div className="approval-arabic">
                (الرئيس المباشر)
              </div>

              <div className="signature">
                {value(data.deptHead)}
              </div>

            </div>


            {/* Dept. Manager */}

            <div className="approval-column">

              <div className="approval-heading">
                Dept Manager
              </div>

              <div className="approval-arabic">
                (مدير الإدارة)
              </div>

              <div className="signature">
                {value(data.deptManager)}
              </div>

            </div>


            {/* HR Manager */}

            <div className="approval-column">

              <div className="approval-heading">
                HR Manager
              </div>

              <div className="approval-arabic">
                (إدارة الموارد البشرية)
              </div>

              <div className="signature">
                {value(data.hrManager)}
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}