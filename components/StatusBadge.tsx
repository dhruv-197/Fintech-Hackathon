import React from 'react';
import { ReviewStatus } from '../types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusStyles: { [key in ReviewStatus]: string } = {
    [ReviewStatus.Approved]: 'bg-teal-100 text-teal-800',
    [ReviewStatus.Pending]: 'bg-yellow-100 text-yellow-800',
    [ReviewStatus.Rejected]: 'bg-red-100 text-red-800',
    [ReviewStatus.Mismatch]: 'bg-orange-100 text-orange-800',
    [ReviewStatus.Finalized]: 'bg-green-100 text-green-800',
  };

  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
