import type { VerificationStatus } from '@/types/verification';

interface ReportHeaderProps {
  status: VerificationStatus;
  overallPassed: boolean | null;
  passedCount: number;
  failedCount: number;
  runningTest?: string;
  summary?: string;
}

export function ReportHeader(_props: ReportHeaderProps) {
  // Stub component - will fail tests
  return <div>TODO: Implement ReportHeader</div>;
}
