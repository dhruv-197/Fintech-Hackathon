import React, { useState, useMemo } from 'react';
import { GLAccount, ReviewStatus, User } from '../types';
import StatusBadge from './StatusBadge';
import { Check, X, ChevronsUpDown, Search, History } from 'lucide-react';

interface GLAccountTableProps {
  accounts: GLAccount[];
  currentUser: User;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onViewHistory: (account: GLAccount) => void;
}

const GLAccountTable: React.FC<GLAccountTableProps> = ({ accounts, currentUser, onApprove, onReject, onViewHistory }) => {
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof GLAccount | 'currentChecker'; direction: 'ascending' | 'descending' } | null>(null);

  const sortedAccounts = useMemo(() => {
    let sortableAccounts = [...accounts];
    if (sortConfig !== null) {
      sortableAccounts.sort((a, b) => {
        const aValue = sortConfig.key === 'currentChecker' ? (a.currentChecker || 'Finalized') : a[sortConfig.key];
        const bValue = sortConfig.key === 'currentChecker' ? (b.currentChecker || 'Finalized') : b[sortConfig.key];
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableAccounts;
  }, [accounts, sortConfig]);
  
  const filteredAccounts = sortedAccounts.filter(account =>
    Object.values(account).some(value =>
      String(value).toLowerCase().includes(filter.toLowerCase())
    )
  );

  const requestSort = (key: keyof GLAccount | 'currentChecker') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader = ({ tkey, label }: { tkey: keyof GLAccount | 'currentChecker', label: string }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(tkey)}>
      <div className="flex items-center">
        {label}
        <ChevronsUpDown className="ml-2 h-4 w-4" />
      </div>
    </th>
  );
  
  const isCFO = currentUser.role === 'CFO';

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mt-6">
       <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">GL Account Review Workflow</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader tkey="glAccountNumber" label="GL Account #" />
              <SortableHeader tkey="glAccount" label="GL Account Name" />
              <SortableHeader tkey="responsibleDept" label="Department" />
              <SortableHeader tkey="currentChecker" label="Current Stage" />
              <SortableHeader tkey="reviewStatus" label="Status" />
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAccounts.map((account) => {
              const canTakeAction = currentUser.role === account.currentChecker && account.reviewStatus !== ReviewStatus.Finalized;
              return (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{account.glAccountNumber}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{account.glAccount}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{account.responsibleDept}</td>
                 <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">{account.currentChecker || 'Finalized'}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge status={account.reviewStatus} />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center">
                  <div className="flex justify-center space-x-2">
                    <button
                        onClick={() => onViewHistory(account)}
                        className="p-2 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                        title="View History"
                    >
                        <History size={18} />
                    </button>
                    {!isCFO && (
                        <>
                        <button
                            onClick={() => onApprove(account.id)}
                            disabled={!canTakeAction}
                            className="p-2 text-green-600 rounded-full hover:bg-green-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                            title="Approve"
                        >
                            <Check size={18} />
                        </button>
                        <button
                            onClick={() => onReject(account.id)}
                            disabled={!canTakeAction}
                            className="p-2 text-red-600 rounded-full hover:bg-red-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                            title="Reject / Flag Mismatch"
                        >
                            <X size={18} />
                        </button>
                        </>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GLAccountTable;
