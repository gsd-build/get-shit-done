'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import { useEffect, useState } from 'react';

// Dynamic import for Swagger UI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/openapi')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setSpec(data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-red-600">Error Loading API Documentation</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="swagger-wrapper">
      <SwaggerUI spec={spec} />
      <style jsx global>{`
        .swagger-wrapper {
          padding: 0;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
