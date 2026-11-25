// YM29 · Yasindu Janapriya · 4-step workflow stepper for Screen 5 (Data Upload Review).

import { CheckCircle2, XCircle } from 'lucide-react';

export type UploadStepStage = 'upload' | 'review' | 'committed' | 'rejected';

export interface UploadStepperProps {
  stage: UploadStepStage;
  totalRows?: number;
  errorRows?: number;
}

export function UploadStepper({ stage, totalRows = 0, errorRows = 0 }: UploadStepperProps) {
  const stepIndex = stage === 'upload' ? 0 : stage === 'review' ? 2 : 3;

  const steps = [
    {
      num: 'STEP 01',
      title: 'Upload CSV',
      detail: totalRows > 0 ? `${totalRows.toLocaleString('en-US')} rows parsed` : 'Select up to 10,000 rows',
    },
    {
      num: 'STEP 02',
      title: 'Validate Schema & Keys',
      detail: totalRows > 0 ? 'Grades, kg, LKR & duplicate checks run' : 'Strict whole-file validation',
    },
    {
      num: 'STEP 03',
      title: 'Review Preview',
      detail:
        stage === 'upload'
          ? 'Pending upload'
          : errorRows > 0
            ? `${errorRows} issue(s) block publish`
            : '0 errors — ready to publish',
    },
    {
      num: 'STEP 04',
      title: stage === 'rejected' ? 'Rejected & Audited' : 'Publish to Database',
      detail:
        stage === 'committed'
          ? 'Committed to market_observations'
          : stage === 'rejected'
            ? 'Recorded in immutable audit_logs'
            : 'Requires zero validation errors',
    },
  ];

  return (
    <ol className="ym29-stepper" aria-label="CSV upload review progress">
      {steps.map((step, idx) => {
        const isDone = idx < stepIndex || (stage === 'committed' && idx === 3);
        const isActive = idx === stepIndex && stage !== 'committed' && stage !== 'rejected';
        const isRejected = stage === 'rejected' && idx === 3;
        const stateClass = isRejected
          ? 'ym29-step--rejected'
          : isDone
            ? 'ym29-step--done'
            : isActive
              ? 'ym29-step--active'
              : '';

        return (
          <li key={step.num} className={`ym29-step ${stateClass}`} aria-current={isActive ? 'step' : undefined}>
            <div className="ym29-step-head">
              <span>{step.num}</span>
              {isDone && <CheckCircle2 size={15} aria-hidden="true" />}
              {isRejected && <XCircle size={15} aria-hidden="true" />}
            </div>
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
          </li>
        );
      })}
    </ol>
  );
}
