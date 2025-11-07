import { User, UserRole } from './types';

export const PRIORITY_THRESHOLDS = {
  critical: 10,
  medium: 5,
};

export const USERS: User[] = [
  { id: 1, name: 'Alice', role: UserRole.Checker1 },
  { id: 2, name: 'Bob', role: UserRole.Checker2 },
  { id: 3, name: 'Charlie', role: UserRole.Checker3 },
  { id: 4, name: 'Eve', role: UserRole.Checker4 },
  { id: 5, name: 'Diana', role: UserRole.CFO },
  { id: 6, name: 'System', role: UserRole.Admin },
];

export const WORKFLOW_STAGES: (UserRole | null)[] = [
  UserRole.Checker1,
  UserRole.Checker2,
  UserRole.Checker3,
  UserRole.Checker4,
  null, // Represents Finalized state
];