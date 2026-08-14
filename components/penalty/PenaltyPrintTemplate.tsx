'use client';

import React from 'react';
import './penalty-print.css';

export interface PenaltyPrintData {
  name?: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;

  dateOfPenalty?: string;
  typeOfPenalty?: string;
  subject?: string;

  otherRecommendation?: string;

  requestingDepartment?: string;
  departmentManager?: string;
  departmentManagerDate?: string;

  penaltyForEmployee?: string;

  hrManager?: string;
  hrManagerDate?: string;

  employeeSignature?: string;
  employeeAcknowledgementDate?: string;
}

interface PenaltyPrintProps {
  data: PenaltyPrintData;
  showPrintButton?: boolean;
}

export default function PenaltyPrintTemplate({
  data,
  showPrintButton = true,
}: PenaltyPrintProps) {
  const value = (text?: string) => text || '';

  const formatDate = (date?: string) => {
    if (!date) return '';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString('en-GB');
  };

  return (
    <div className="penalty-page">

      {showPrintButton && (
        <div className="penalty-controls no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="penalty-print-button"
          >
            طباعة الجزاء
          </button>
        </div>
      )}

      <div className="penalty-document">

        {/* =====================================================
            PAGE 1
        ====================================================== */}

        <section className="penalty-paper penalty-page-one">

          {/* HEADER */}

          <table className="penalty-header">
            <tbody>
              <tr>

                <td className="header-company">
                  <img
                    src="/energya-logo.png"
                    alt="Energya"
                    className="penalty-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </td>

                <td className="header-title">
                  <div className="title-en">
                    Penalty Request
                  </div>

                  <div className="title-ar">
                    نموذج طلب توقيع جزاءات
                  </div>
                </td>

                <td className="header-form">
                  <div>Form No:</div>

                  <div className="form-number">
                    HHE-HR-FO-027
                  </div>

                  <div>Issue A/0</div>
                </td>

              </tr>
            </tbody>
          </table>


          {/* EMPLOYEE INFORMATION */}

          <table className="employee-info-table">

            <tbody>

              <tr>

                <td className="employee-field field-left">
                  <span className="field-label">
                    Name
                  </span>

                  <span className="field-ar">
                    (الاسم)
                  </span>

                  <span className="field-value">
                    {value(data.name)}
                  </span>
                </td>

                <td className="employee-field field-right">
                  <span className="field-label">
                    Emp. ID
                  </span>

                  <span className="field-ar">
                    (رقم الموظف)
                  </span>

                  <span className="field-value">
                    {value(data.employeeId)}
                  </span>
                </td>

              </tr>


              <tr>

                <td className="employee-field field-left">
                  <span className="field-label">
                    Title
                  </span>

                  <span className="field-ar">
                    (الوظيفة)
                  </span>

                  <span className="field-value">
                    {value(data.title)}
                  </span>
                </td>

                <td className="employee-field field-right">
                  <span className="field-label">
                    Dept.
                  </span>

                  <span className="field-ar">
                    (الإدارة)
                  </span>

                  <span className="field-value">
                    {value(data.department)}
                  </span>
                </td>

              </tr>


              <tr>

                <td className="employee-field field-left">
                  <span className="field-label">
                    Location
                  </span>

                  <span className="field-ar">
                    (الموقع)
                  </span>

                  <span className="field-value">
                    {value(data.location)}
                  </span>
                </td>

                <td className="employee-field field-right">
                  <span className="field-label">
                    Date of Penalty
                  </span>

                  <span className="field-ar">
                    (تاريخ وقوع المخالفة)
                  </span>

                  <span className="field-value">
                    {formatDate(data.dateOfPenalty)}
                  </span>
                </td>

              </tr>

            </tbody>

          </table>


          {/* PENALTY TYPE */}

          <div className="section-block">

            <div className="section-title">
              Type of Penalty
            </div>

            <div className="section-title-ar">
              نوع المخالفة
            </div>

            <div className="section-line">
              {value(data.typeOfPenalty)}
            </div>

          </div>


          {/* SUBJECT */}

          <div className="section-block subject-block">

            <div className="section-title">
              Subject
            </div>

            <div className="section-title-ar">
              موضوع المخالفة
            </div>

            <div className="subject-area">
              {value(data.subject)}
            </div>

          </div>


          {/* OTHER RECOMMENDATION */}

          <div className="section-block recommendation-block">

            <div className="section-title">
              Other Recommendation
            </div>

            <div className="section-title-ar">
              توصيات أخرى
            </div>

            <div className="recommendation-area">
              {value(data.otherRecommendation)}
            </div>

          </div>


          {/* REQUESTING DEPARTMENT */}

          <div className="requesting-section">

            <div className="requesting-title">
              Sec./Dept asking for Penalty
            </div>

            <div className="requesting-title-ar">
              الإدارة الطالبة للجزاء
            </div>

            <div className="requesting-value">
              {value(data.requestingDepartment)}
            </div>

          </div>


          {/* MANAGER */}

          <div className="manager-row">

            <div className="manager-field">

              <div className="manager-title">
                Dept. Manager
              </div>

              <div className="manager-ar">
                مدير الإدارة
              </div>

              <div className="manager-value">
                {value(data.departmentManager)}
              </div>

            </div>


            <div className="manager-field">

              <div className="manager-title">
                Date
              </div>

              <div className="manager-ar">
                التاريخ
              </div>

              <div className="manager-value">
                {formatDate(data.departmentManagerDate)}
              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            PAGE 2
        ====================================================== */}

        <section className="penalty-paper penalty-page-two">

          {/* HEADER ON PAGE 2 */}

          <table className="penalty-header penalty-header-page-two">
            <tbody>
              <tr>

                <td className="header-company">
                  <img
                    src="/energya-logo.png"
                    alt="Energya"
                    className="penalty-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </td>

                <td className="header-title">
                  <div className="title-en">
                    Penalty Request
                  </div>

                  <div className="title-ar">
                    نموذج طلب توقيع جزاءات
                  </div>
                </td>

                <td className="header-form">
                  <div>Form No:</div>

                  <div className="form-number">
                    HHE-HR-FO-027
                  </div>

                  <div>Issue A/0</div>
                </td>

              </tr>
            </tbody>
          </table>


          {/* PENALTY DECISION */}

          <div className="decision-section">

            <div className="decision-title">
              Penalty for the Employee
            </div>

            <div className="decision-title-ar">
              الجزاء الموقع على الموظف
            </div>

            <div className="decision-area">
              {value(data.penaltyForEmployee)}
            </div>

          </div>


          {/* HR SIGNATURE */}

          <div className="approval-section">

            <div className="approval-box">

              <div className="approval-title">
                HR Manager
              </div>

              <div className="approval-ar">
                مدير إدارة الموارد البشرية
              </div>

              <div className="approval-name">
                {value(data.hrManager)}
              </div>

              <div className="approval-signature">
                Signature / التوقيع
              </div>

              <div className="approval-line">
                ........................................
              </div>

              <div className="approval-date">
                Date / التاريخ :
                <span>
                  {formatDate(data.hrManagerDate)}
                </span>
              </div>

            </div>


            <div className="approval-box employee-acknowledgement">

              <div className="approval-title">
                Employee Acknowledgement
              </div>

              <div className="approval-ar">
                إقرار الموظف بالعلم
              </div>

              <div className="approval-name">
                {value(data.name)}
              </div>

              <div className="approval-signature">
                Signature / التوقيع
              </div>

              <div className="approval-line">
                {value(data.employeeSignature)}
              </div>

              <div className="approval-date">
                Date / التاريخ :
                <span>
                  {formatDate(
                    data.employeeAcknowledgementDate
                  )}
                </span>
              </div>

            </div>

          </div>


          {/* EMPLOYEE INFORMATION REFERENCE */}

          <div className="employee-reference">

            <div className="reference-row">

              <div>
                <span className="reference-label">
                  Employee Name
                </span>

                <span className="reference-ar">
                  (اسم الموظف)
                </span>

                <span className="reference-value">
                  {value(data.name)}
                </span>
              </div>


              <div>
                <span className="reference-label">
                  Emp. ID
                </span>

                <span className="reference-ar">
                  (رقم الموظف)
                </span>

                <span className="reference-value">
                  {value(data.employeeId)}
                </span>
              </div>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}