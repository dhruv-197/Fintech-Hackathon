
import { User, UserRole } from './types';

export const PRIORITY_THRESHOLDS = {
  critical: 10,
  medium: 5,
};

export const USERS: User[] = [
  { id: 1, name: 'Alice', role: UserRole.Checker1 },
  { id: 2, name: 'Bob', role: UserRole.Checker2 },
  { id: 3, name: 'Charlie', role: UserRole.FinalChecker },
  { id: 4, name: 'Diana', role: UserRole.CFO },
  { id: 5, name: 'System', role: UserRole.Admin },
];

export const WORKFLOW_STAGES: (UserRole | null)[] = [
  UserRole.Checker1,
  UserRole.Checker2,
  UserRole.FinalChecker,
  null, // Represents Finalized state
];
