export enum UserRole {
  Admin = 'Admin',
  CFO = 'CFO',
  Checker1 = 'Checker 1',
  Checker2 = 'Checker 2',
  Checker3 = 'Checker 3',
  Checker4 = 'Checker 4',
}

export enum ReviewStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Mismatch = 'Mismatch',
  Finalized = 'Finalized',
}

export enum Priority {
    Critical = 'Critical',
    Medium = 'Medium',
    Low = 'Low',
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
}

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  from: string;
  to: string;
  reason?: string;
}

export interface GLAccount {
  id: number;
  bsPl: string;
  statusCategory: 'Assets' | 'Liabilities' | 'Equity';
  glAccount: string;
  glAccountNumber: string;
  mainHead: string;
  subHead: string;
  responsibleDept: string;
  spoc: string;
  reviewer: string;
  reviewStatus: ReviewStatus;
  currentChecker: UserRole | null;
  auditLog: AuditLogEntry[];
  mistakeCount: number;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

export interface UploadError {
    row: number;
    message: string;
    data: string;
}