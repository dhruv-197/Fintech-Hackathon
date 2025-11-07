
import React from 'react';

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-full ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
};

export default MetricsCard;
