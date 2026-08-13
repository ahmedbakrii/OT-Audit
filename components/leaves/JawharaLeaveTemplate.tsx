'use client';

import React from 'react';

export interface JawharaLeaveData {
  requestDate: string;

  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  dateOfJoin?: string;
  nationality?: string;

  clientName?: string;
  site?: string;

  leaveType?:
    | 'annual'
    | 'examination'
    | 'unpaid'
    | 'hajj'
    | 'medical'
    | 'emergency'
    | 'other'
    | 'vacationPay';

  phoneSaudi?: string;
  phoneHomeCountry?: string;
  email?: string;

  emergencyReason?: string;

  proposedTravelDate?: string;
  lastWorkingDay?: string;

  startDate: string;
  endDate: string;
  leaveDays: number;
  dutyResumptionDate?: string;

  destination?: string;
  lastVacationReturnDate?: string;

  contractPeriod?: string;
  contractExpiryDate?: string;

  exitReEntryPeriod?: string;

  iqamaNumber?: string;
  passportNumber?: string;

  iqamaExpiryDate?: string;
  passportExpiryDate?: string;

  employeeSignature?: string;
  clientAuthorizedSignature?: string;

  logoSrc?: string;
}

interface JawharaLeaveTemplateProps {
  data: JawharaLeaveData;
  showPrintButton?: boolean;
}

function CheckBox({ checked = false }: { checked?: boolean }) {
  return (
    <span className={`jawhara-checkbox ${checked ? 'checked' : ''}`}>
      {checked ? '✓' : ''}
    </span>
  );
}

export default function JawharaLeaveTemplate({
  data,
  showPrintButton = true,
}: JawharaLeaveTemplateProps) {

  return (
    <div className="leave-print-wrapper">

      {showPrintButton && (
        <div className="print-controls">
          <button
            type="button"
            onClick={() => window.print()}
            className="print-button"
          >
            Print Leave Request
          </button>
        </div>
      )}

      <div className="jawhara-page">

        {/* LOGO */}
        <div className="jawhara-logo-area">

          {data.logoSrc ? (
            <img
              src={data.logoSrc}
              alt="Jawhara HR"
              className="jawhara-logo"
            />
          ) : (
            <div className="jawhara-logo-fallback">
              <strong>جواهر HR</strong>
              <span>جواهر الموارد البشرية</span>
            </div>
          )}

        </div>

        {/* TITLE */}
        <div className="jawhara-title">
          CLIENT LEAVE APPLICATION FORM
        </div>

        {/* REQUEST DATE */}
        <div className="jawhara-row request-row">

          <div className="jawhara-cell request-note">
            To be filled by the Employee and submit to the Area Office
          </div>

          <div className="jawhara-label">
            Date of Request:
          </div>

          <div className="jawhara-value">
            {data.requestDate}
          </div>

        </div>

        {/* CLIENT */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Client Name:
          </div>

          <div className="jawhara-value large">
            {data.clientName}
          </div>

          <div className="jawhara-label">
            Site:
          </div>

          <div className="jawhara-value">
            {data.site}
          </div>

        </div>

        {/* EMPLOYEE */}
        <div className="jawhara-row employee-main-row">

          <div className="jawhara-label">
            Employee Name:
          </div>

          <div className="jawhara-value employee-name">
            {data.employeeName}
          </div>

          <div className="jawhara-label small-label">
            Employee Number:
          </div>

          <div className="jawhara-value employee-number">
            {data.employeeCode}
          </div>

          <div className="jawhara-label">
            Job Title:
          </div>

          <div className="jawhara-value">
            {data.jobTitle}
          </div>

        </div>

        {/* JOIN DATE / NATIONALITY */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Date of Join:
          </div>

          <div className="jawhara-value large">
            {data.dateOfJoin}
          </div>

          <div className="jawhara-label">
            Nationality:
          </div>

          <div className="jawhara-value">
            {data.nationality}
          </div>

        </div>

        {/* PURPOSE + CONTACT */}
        <div className="jawhara-purpose-header">

          <span>
            Purpose of Leave:
          </span>

          <span>
            Contact Details:
          </span>

        </div>

        <div className="jawhara-purpose-grid">

          <div className="jawhara-purpose-options">

            <div className="jawhara-option-column">

              <div>
                <CheckBox checked={data.leaveType === 'annual'} />
                <span>Annual</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'unpaid'} />
                <span>Unpaid</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'medical'} />
                <span>Medical</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'other'} />
                <span>Other</span>
              </div>

            </div>

            <div className="jawhara-option-column">

              <div>
                <CheckBox checked={data.leaveType === 'examination'} />
                <span>Examination</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'hajj'} />
                <span>Hajj / Umra</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'emergency'} />
                <span>Emergency</span>
              </div>

              <div>
                <CheckBox checked={data.leaveType === 'vacationPay'} />
                <span>Vacation Pay Only</span>
              </div>

            </div>

          </div>

          <div className="jawhara-contact">

            <div>
              <span>
                Phone (Saudi Arabia)
              </span>

              <strong>
                {data.phoneSaudi}
              </strong>
            </div>

            <div>
              <span>
                Phone (Home Country)
              </span>

              <strong>
                {data.phoneHomeCountry}
              </strong>
            </div>

            <div>
              <span>
                Email (Personal)
              </span>

              <strong>
                {data.email}
              </strong>
            </div>

          </div>

        </div>

        {/* EMERGENCY */}
        <div className="jawhara-emergency">

          <span>
            Remarks/Reason in case of Emergency:
          </span>

          <span className="emergency-value">
            {data.emergencyReason}
          </span>

        </div>

        {/* TRAVEL */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Proposed Travel Date:
          </div>

          <div className="jawhara-value">
            {data.proposedTravelDate}
          </div>

          <div className="jawhara-label">
            Last Day of Work:
          </div>

          <div className="jawhara-value">
            {data.lastWorkingDay}
          </div>

        </div>

        {/* LEAVE EFFECTIVE */}
        <div className="jawhara-leave-effective">

          <div className="jawhara-label">
            Leave Effective:
          </div>

          <div className="jawhara-small-label">
            From:
          </div>

          <div className="jawhara-value">
            {data.startDate}
          </div>

          <div className="jawhara-small-label">
            to:
          </div>

          <div className="jawhara-value">
            {data.endDate}
          </div>

          <div className="jawhara-label">
            Total Days Requested
          </div>

          <div className="jawhara-value">
            {data.leaveDays}
          </div>

          <div className="jawhara-label">
            Duty Resumption
          </div>

          <div className="jawhara-value">
            {data.dutyResumptionDate}
          </div>

        </div>

        {/* DESTINATION */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Destination:
          </div>

          <div className="jawhara-value large">
            {data.destination}
          </div>

          <div className="jawhara-label">
            Date Returned from the Last Vacation:
          </div>

          <div className="jawhara-value">
            {data.lastVacationReturnDate}
          </div>

        </div>

        {/* CONTRACT */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Contract Period & Expiry Date:
          </div>

          <div className="jawhara-value large">
            {data.contractPeriod}
            {data.contractExpiryDate
              ? ` / ${data.contractExpiryDate}`
              : ''}
          </div>

          <div className="jawhara-label">
            Exit Re-Entry Period:
          </div>

          <div className="jawhara-value">
            {data.exitReEntryPeriod}
          </div>

        </div>

        {/* IQAMA / PASSPORT */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Iqama Number:
          </div>

          <div className="jawhara-value large">
            {data.iqamaNumber}
          </div>

          <div className="jawhara-label">
            Passport Number:
          </div>

          <div className="jawhara-value">
            {data.passportNumber}
          </div>

        </div>

        {/* EXPIRY */}
        <div className="jawhara-row">

          <div className="jawhara-label">
            Iqama Expiry Date:
          </div>

          <div className="jawhara-value large">
            {data.iqamaExpiryDate}
          </div>

          <div className="jawhara-label">
            Passport Expiry Date:
          </div>

          <div className="jawhara-value">
            {data.passportExpiryDate}
          </div>

        </div>

        {/* SIGNATURES */}
        <div className="jawhara-signature-row">

          <div>
            Employee Signature
            <div className="jawhara-signature-space">
              {data.employeeSignature}
            </div>
          </div>

          <div>
            Client Authorized Signature & Stamp
            <div className="jawhara-signature-space">
              {data.clientAuthorizedSignature}
            </div>
          </div>

        </div>

        {/* NOTE */}
        <div className="jawhara-note">

          Note: Employees availing leave will be processed without affecting ERC monthly fees

        </div>

        {/* OFFICE USE */}
        <div className="jawhara-office-title">
          For JHRC Office Use Only
        </div>

        {/* SCOPES */}
        <div className="jawhara-scope-row">

          <div>
            ERC Scope:

            <CheckBox />

            ERE

            <CheckBox />

            AVP

            <CheckBox />

            Ticket
          </div>

          <div>
            Client Scope:

            <CheckBox />

            ERE

            <CheckBox />

            AVP

            <CheckBox />

            Ticket
          </div>

        </div>

        {/* FIRST APPROVAL ROW */}
        <div className="jawhara-approval-grid">

          <div>
            Time Sheet Coordinator
            <div className="approval-space" />
          </div>

          <div>
            Operation Supervisor
            <div className="approval-space" />
          </div>

          <div>
            Operation Manager
            <div className="approval-space" />
          </div>

          <div>
            HR Specialist
            <div className="approval-space" />
          </div>

        </div>

        {/* SECOND APPROVAL ROW */}
        <div className="jawhara-approval-grid second">

          <div>
            Client Relations Manager
            <div className="approval-space" />
          </div>

          <div>
            HR Manager
            <div className="approval-space" />
          </div>

          <div>
            CCO
            <div className="approval-space" />
          </div>

        </div>

        {/* GR REMARKS */}
        <div className="jawhara-gr">

          <strong>
            GR Remarks:
          </strong>

          <div />

        </div>

        {/* FOOTER */}
        <div className="jawhara-footer">
          JHRC-FRM/CORP-03 Rev.00 Issued Date 28/Jan/2020
        </div>

      </div>
    </div>
  );
}