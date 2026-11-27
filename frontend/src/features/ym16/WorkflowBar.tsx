import { NavLink } from 'react-router-dom';

const steps = [
  { id: 'batch-review', label: 'Review', index: 1 },
  { id: 'status-countdown', label: 'Hold', index: 2 },
  { id: 'farmer-evaluation', label: 'Responses', index: 3 },
  { id: 'confirmation-result', label: 'Locked', index: 4 },
];

export function WorkflowBar({ orderId, current }: { orderId: string; current: string }) {
  return (
    <nav className="ym16-stepper" aria-label="Reservation workflow">
      {steps.map((step) => {
        const active = current === step.id;
        const complete = steps.findIndex((item) => item.id === current) > steps.findIndex((item) => item.id === step.id);
        return (
          <NavLink
            key={step.id}
            to={`/buyer/reservations/${orderId}/${step.id}`}
            className={`ym16-step ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
          >
            <b>{step.index}</b>
            {step.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
