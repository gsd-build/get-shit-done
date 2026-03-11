/**
 * Verification types for test result streaming and gap reporting.
 *
 * Used by verificationStore and useVerification hook to manage
 * verification state during test execution.
 */

/** Severity level for gaps */
export type Severity = 'blocking' | 'major' | 'minor';

/** Status of verification process */
export type VerificationStatus = 'idle' | 'running' | 'complete';

/** Test result from verification execution */
export interface TestResult {
  requirementId: string;
  testName: string;
  passed: boolean;
  message?: string;
  duration: number;
}

/** Gap identified during verification */
export interface Gap {
  id: string;
  requirementId: string;
  description: string;
  severity: Severity;
}

/** Manual test item requiring human verification */
export interface ManualTest {
  id: string;
  description: string;
  passed: boolean | null;
  note?: string;
}
