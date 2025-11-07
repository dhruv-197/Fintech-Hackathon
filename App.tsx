
import React, { useState } from 'react';
import { GLAccount, User, UserRole, ReviewStatus, AuditLogEntry } from './types';
import { WORKFLOW_STAGES } from './constants';
import LoginPage from './components/LoginPage';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ChatInterface from './components/ChatInterface';
import WorkflowModal from './components/WorkflowModal';

type View = 'upload' | 'dashboard' | 'chat';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [view, setView] = useState<View>('upload');
  const [modalState, setModalState] = useState<{account: GLAccount, mode: 'history' | 'reject'} | null>(null);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setGlAccounts([]);
    setView('upload');
  };

  const handleAddAccounts = (newAccounts: GLAccount[]) => {
    setGlAccounts(prev => [...prev, ...newAccounts]);
    setView('dashboard');
  };

  const createAuditLog = (account: GLAccount, action: string, from: string, to: string, reason?: string): AuditLogEntry => ({
    timestamp: new Date().toISOString(),
    user: currentUser!.name,
    role: currentUser!.role,
    action,
    from,
    to,
    reason,
  });

  const handleApprove = (id: number) => {
    setGlAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === id && acc.currentChecker === currentUser?.role) {
          const currentStageIndex = WORKFLOW_STAGES.indexOf(acc.currentChecker);
          const nextStage = WORKFLOW_STAGES[currentStageIndex + 1];
          const isFinalized = nextStage === null;

          const log = createAuditLog(acc, `Approve - ${acc.currentChecker}`, acc.currentChecker!, nextStage ?? 'Finalized');

          return {
            ...acc,
            currentChecker: nextStage,
            reviewStatus: isFinalized ? ReviewStatus.Finalized : ReviewStatus.Pending,
            auditLog: [...acc.auditLog, log],
          };
        }
        return acc;
      })
    );
  };

  const handleReject = (id: number) => {
    const account = glAccounts.find(acc => acc.id === id);
    if(account) {
        setModalState({account, mode: 'reject'});
    }
  };
  
  const handleSubmitReason = (reason: string) => {
      if(!modalState) return;
      const { account } = modalState;

      setGlAccounts(prevAccounts => 
        prevAccounts.map(acc => {
            if(acc.id === account.id && acc.currentChecker === currentUser?.role){
                const log = createAuditLog(acc, `Reject / Mismatch - ${acc.currentChecker}`, acc.currentChecker!, UserRole.Checker1, reason);
                return {
                    ...acc,
                    currentChecker: UserRole.Checker1, // Reset to Checker 1
                    reviewStatus: ReviewStatus.Mismatch,
                    mistakeCount: acc.mistakeCount + 1,
                    auditLog: [...acc.auditLog, log]
                }
            }
            return acc;
        })
      );
      setModalState(null);
  }

  const handleViewHistory = (account: GLAccount) => {
    setModalState({ account, mode: 'history' });
  };
  
  const closeModal = () => setModalState(null);

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header currentUser={currentUser} onLogout={handleLogout} onNavigate={setView} currentView={view} />
      <main>
        {view === 'upload' && <UploadView onAddAccounts={handleAddAccounts} currentAccounts={glAccounts} />}
        {view === 'dashboard' && <Dashboard glAccounts={glAccounts} currentUser={currentUser} onApprove={handleApprove} onReject={handleReject} onViewHistory={handleViewHistory} />}
        {view === 'chat' && <ChatInterface glAccounts={glAccounts} />}
      </main>
      {modalState && currentUser && (
        <WorkflowModal
          account={modalState.account}
          mode={modalState.mode}
          onClose={closeModal}
          onSubmitReason={handleSubmitReason}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default App;
