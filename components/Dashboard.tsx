
import React, { useMemo } from 'react';
import { GLAccount, ReviewStatus, User, UserRole, Priority } from '../types';
import { PRIORITY_THRESHOLDS } from '../constants';
import MetricsCard from './MetricsCard';
import ChartComponent from './ChartComponent';
import GLAccountTable from './GLAccountTable';
import { CheckCircle, Clock, XCircle, List, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  glAccounts: GLAccount[];
  currentUser: User;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onViewHistory: (account: GLAccount) => void;
}

const DepartmentPriorityBadge: React.FC<{priority: Priority}> = ({priority}) => {
    const styles = {
        [Priority.Critical]: "bg-red-100 text-red-800 border-red-300",
        [Priority.Medium]: "bg-yellow-100 text-yellow-800 border-yellow-300",
        [Priority.Low]: "bg-green-100 text-green-800 border-green-300",
    }
    return <span className={`px-2 py-1 text-xs font-bold rounded border ${styles[priority]}`}>{priority}</span>
}

const Dashboard: React.FC<DashboardProps> = ({ glAccounts, currentUser, onApprove, onReject, onViewHistory }) => {
  const metrics = useMemo(() => {
    const total = glAccounts.length;
    const finalized = glAccounts.filter(a => a.reviewStatus === ReviewStatus.Finalized).length;
    const pending = glAccounts.filter(a => a.reviewStatus === ReviewStatus.Pending || a.reviewStatus === ReviewStatus.Mismatch).length;
    const mistakes = glAccounts.reduce((acc, curr) => acc + curr.mistakeCount, 0);
    return { total, finalized, pending, mistakes };
  }, [glAccounts]);

  const departmentMetrics = useMemo(() => {
      const depts = [...new Set(glAccounts.map(a => a.responsibleDept))];
      return depts.map(dept => {
          const accountsInDept = glAccounts.filter(a => a.responsibleDept === dept);
          const mistakeCount = accountsInDept.reduce((acc, curr) => acc + curr.mistakeCount, 0);
          let priority = Priority.Low;
          if (mistakeCount >= PRIORITY_THRESHOLDS.critical) {
              priority = Priority.Critical;
          } else if (mistakeCount >= PRIORITY_THRESHOLDS.medium) {
              priority = Priority.Medium;
          }
          return {
              name: dept,
              totalAccounts: accountsInDept.length,
              mistakeCount,
              priority,
          }
      }).sort((a, b) => b.mistakeCount - a.mistakeCount);
  }, [glAccounts]);

  const chartData = useMemo(() => {
    // FIX: Explicitly type the accumulator to ensure correct type inference.
    const statusCounts = glAccounts.reduce((acc: Record<ReviewStatus, number>, account) => {
        const status = account.currentChecker === null ? ReviewStatus.Finalized : account.reviewStatus;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<ReviewStatus, number>);
    
    return Object.entries(statusCounts).map(([name, value]) => ({ name: name as ReviewStatus, value }));
  }, [glAccounts]);

  const deptBarChartData = useMemo(() => departmentMetrics.map(d => ({name: d.name, Accounts: d.totalAccounts})), [departmentMetrics]);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard 
          title="Total GL Accounts" 
          value={metrics.total} 
          icon={<List className="text-blue-500"/>} 
          color="bg-blue-100" 
        />
        <MetricsCard 
          title="Finalized Accounts" 
          value={metrics.finalized} 
          icon={<CheckCircle className="text-green-500"/>} 
          color="bg-green-100" 
        />
        <MetricsCard 
          title="Pending Review" 
          value={metrics.pending} 
          icon={<Clock className="text-yellow-500"/>} 
          color="bg-yellow-100" 
        />
        <MetricsCard 
          title="Total Mismatches" 
          value={metrics.mistakes} 
          icon={<AlertTriangle className="text-red-500"/>}
          color="bg-red-100" 
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <ChartComponent data={chartData} />
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
             <h3 className="text-lg font-semibold text-gray-700 mb-4">GLs per Department</h3>
             <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptBarChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Accounts" fill="#3B82F6" />
                </BarChart>
             </ResponsiveContainer>
        </div>
      </div>

       <div className="mt-6 bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Department Quality & Priority</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {departmentMetrics.map(dept => (
                    <div key={dept.name} className="border border-gray-200 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800">{dept.name}</span>
                            <DepartmentPriorityBadge priority={dept.priority} />
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Accounts: {dept.totalAccounts}</p>
                        <p className="text-sm text-gray-500">Mismatches: {dept.mistakeCount}</p>
                    </div>
                ))}
            </div>
       </div>

      <GLAccountTable accounts={glAccounts} currentUser={currentUser} onApprove={onApprove} onReject={onReject} onViewHistory={onViewHistory} />
    </div>
  );
};

export default Dashboard;
