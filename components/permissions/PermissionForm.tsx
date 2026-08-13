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

        <div className="permission-header">

          <div className="company-box">
            <div className="company-logo">
              energya
            </div>

            <div className="company-ar">
              انيرجيا
            </div>

            <div className="company-sub">
              شركة هشام هلال السويدي وشركاه للصناعات الحديدية
            </div>

            <div className="company-en">
              Hisham Helal El Sewedy & Partners For Steel Industries Co.
            </div>
          </div>

          <div className="title-box">
            <div className="form-title">
              Exit / Delay Permission
            </div>

            <div className="form-title-ar">
              تصريح خروج / تأخير
            </div>
          </div>

          <div className="form-number-box">
            <div>Form No:</div>
            <div className="form-number">
              HHE-HR-FO-026
            </div>
            <div>Issue A/1</div>
          </div>

        </div>

        <div className="permission-body">

          <div className="info-grid">

            <div className="field">
              <div className="field-label">
                Date <span>(التاريخ)</span>
              </div>

              <div className="field-value">
                {value(data.date)}
              </div>
            </div>

            <div className="field">
              <div className="field-label right">
                Employee ID <span>(رقم الموظف)</span>
              </div>

              <div className="field-value right">
                {value(data.employeeId)}
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                Name <span>(الاسم)</span>
              </div>

              <div className="field-value">
                {value(data.name)}
              </div>
            </div>

            <div className="field">
              <div className="field-label right">
                Title <span>(الوظيفة)</span>
              </div>

              <div className="field-value right">
                {value(data.title)}
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                Section <span>(القسم)</span>
              </div>

              <div className="field-value">
                {value(data.section)}
              </div>
            </div>

            <div className="field">
              <div className="field-label right">
                Department <span>(الإدارة)</span>
              </div>

              <div className="field-value right">
                {value(data.department)}
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                Time of Exit <span>(وقت الخروج)</span>
              </div>

              <div className="field-value">
                {value(data.timeOfExit)}
              </div>
            </div>

            <div className="field">
              <div className="field-label right">
                Time of Entry <span>(وقت الدخول)</span>
              </div>

              <div className="field-value right">
                {value(data.timeOfEntry)}
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                Period of Exit <span>(مدة الإذن)</span>
              </div>

              <div className="field-value">
                {value(data.periodOfExit)}
              </div>
            </div>

            <div className="field">
              <div className="field-label right">
                Reason for Permission <span>(سبب الإذن)</span>
              </div>

              <div className="field-value right">
                {value(data.reason)}
              </div>
            </div>

          </div>

          <div className="special-section">

            <div className="special-title">
              ظروف خاصة
            </div>

            <div className="special-lines">
              <div>
                {value(data.specialCircumstances)}
              </div>

              <div></div>
            </div>

          </div>

          <div className="approval-section">

            <div className="approval-box">

              <div className="approval-title">
                Dept. Head
                <span>(الرئيس المباشر)</span>
              </div>

              <div className="signature-line">
                {value(data.deptHead)}
              </div>

            </div>

            <div className="approval-box">

              <div className="approval-title">
                Dept. Manager
                <span>(مدير الإدارة)</span>
              </div>

              <div className="signature-line">
                {value(data.deptManager)}
              </div>

            </div>

            <div className="approval-box">

              <div className="approval-title">
                HR Manager
                <span>(إدارة الموارد البشرية)</span>
              </div>

              <div className="signature-line">
                {value(data.hrManager)}
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}