'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, MessageSquare, FileText, CheckCircle } from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;

  const navItems = [
    { href: `/projects/${projectId}/execute`, label: 'Execute', icon: Play, ready: true },
    { href: `/projects/${projectId}/discuss`, label: 'Discuss', icon: MessageSquare, ready: true },
    { href: `/projects/${projectId}/plan`, label: 'Plan', icon: FileText, ready: true },
    { href: `/projects/${projectId}/verify`, label: 'Verify', icon: CheckCircle, ready: true },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 min-h-11 px-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-4">{projectId}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {navItems.map(({ href, label, icon: Icon, ready }) => (
            ready ? (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 p-6 bg-card border border-border rounded-lg hover:border-primary hover:shadow-md transition-all"
              >
                <Icon className="w-8 h-8 text-primary" />
                <span className="font-medium">{label}</span>
              </Link>
            ) : (
              <div
                key={label}
                className="flex flex-col items-center gap-2 p-6 bg-card/50 border border-border rounded-lg opacity-50 cursor-not-allowed"
              >
                <Icon className="w-8 h-8 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </div>
            )
          ))}
        </div>
      </div>
    </main>
  );
}
