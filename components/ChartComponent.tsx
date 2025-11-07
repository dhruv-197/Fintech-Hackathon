
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ReviewStatus } from '../types';

interface ChartComponentProps {
  data: { name: ReviewStatus; value: number }[];
}

const COLORS = {
  [ReviewStatus.Approved]: '#10B981', // Green-500
  [ReviewStatus.Pending]: '#F59E0B', // Amber-500
  [ReviewStatus.Rejected]: '#EF4444', // Red-500
};

const ChartComponent: React.FC<ChartComponentProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm h-full w-full">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Review Status Overview</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartComponent;
