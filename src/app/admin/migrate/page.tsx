'use client';

import { useEffect, useState } from 'react';

interface MigrationStatus {
  beneficiaries_table: boolean;
  bvn_encrypted_column: boolean;
  nin_encrypted_column: boolean;
  pgcrypto_extension: boolean;
  fk_notification_preferences: boolean;
}

const SUPABASE_SQL_EDITOR_URL = 'https://supabase.com/dashboard/project/vhzsnsovfjnztawzuueo/sql/new';

export default function MigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/migration-status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  const allApplied = status && Object.values(status).every(v => v === true);

  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-ink mb-2">Gate 2 — Database Migrations</h1>
        <p className="text-gray-600 mb-6">
          Check and apply database migrations for Gate 2 (PII Encryption + Beneficiaries Table + FK Fixes)
        </p>

        {loading ? (
          <p>Checking migration status...</p>
        ) : allApplied ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-green-800">✅ All migrations applied!</h2>
            <p className="text-green-600 mt-1">All Gate 2 database changes are in place.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-amber-800">⚠️ Migrations pending</h2>
              <p className="text-amber-700 mt-1 mb-4">
                The following database changes need to be applied in the Supabase SQL Editor.
              </p>

              <div className="space-y-2 mb-4">
                {status && Object.entries(status).map(([key, applied]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={applied ? 'text-green-600' : 'text-amber-600'}>
                      {applied ? '✅' : '❌'}
                    </span>
                    <span className="text-sm font-mono">{key}</span>
                  </div>
                ))}
              </div>

              <a
                href={SUPABASE_SQL_EDITOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-800 transition-colors"
              >
                Open Supabase SQL Editor →
              </a>
              <p className="text-xs text-amber-600 mt-3">
                Paste the contents of <code className="bg-amber-100 px-1 rounded">APPLY_GATE2_MIGRATIONS.sql</code> from the repo root
                into the SQL editor and click Run.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
