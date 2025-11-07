
import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'upload' | 'chat') => void;
  currentView: 'dashboard' | 'upload' | 'chat';
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, onNavigate, currentView }) => {
  const NavLink: React.FC<{view: 'dashboard' | 'upload' | 'chat', children: React.ReactNode}> = ({view, children}) => {
    const isActive = currentView === view;
    return (
        <button 
            onClick={() => onNavigate(view)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            {children}
        </button>
    )
  }
    
  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-gray-800">FinSight Assurance</h1>
        <nav className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
            <NavLink view="upload">Data Ingestion</NavLink>
            <NavLink view="dashboard">Dashboard</NavLink>
            <NavLink view="chat">AI Assistant</NavLink>
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-800">{currentUser.name}</p>
          <p className="text-xs text-gray-500">{currentUser.role}</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
