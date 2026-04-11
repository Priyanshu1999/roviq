'use client';

import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export interface SessionData {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt?: string;
  isCurrent: boolean;
}

export interface SessionsPageLabels {
  title: string;
  description: string;
  revokeAll: string;
  revoking: string;
  revoke: string;
  loading: string;
  noSessions: string;
  unknownDevice: string;
  unknownIp: string;
  current: string;
  created: string;
}

interface SessionsPageProps {
  sessions: SessionData[];
  loading: boolean;
  labels: SessionsPageLabels;
  formatDate: (dateString: string) => string;
  onRevoke: (sessionId: string) => Promise<void>;
  onRevokeAllOther: () => Promise<void>;
}

export function SessionsPage({
  sessions,
  loading,
  labels,
  formatDate,
  onRevoke,
  onRevokeAllOther,
}: SessionsPageProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await onRevoke(id);
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await onRevokeAllOther();
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-test-id="sessions-title">
            {labels.title}
          </h1>
          <p className="text-muted-foreground">{labels.description}</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleRevokeAll}
          disabled={revokingAll || loading}
        >
          {revokingAll ? labels.revoking : labels.revokeAll}
        </Button>
      </div>
      <div className="grid gap-4">
        {loading && <p className="text-muted-foreground">{labels.loading}</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-muted-foreground">{labels.noSessions}</p>
        )}
        {sessions.map((session) => (
          <Card key={session.id} data-test-id="session-item">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" data-test-id="session-user-agent">
                  {session.userAgent || labels.unknownDevice}
                </CardTitle>
                {session.isCurrent && <Badge variant="secondary">{labels.current}</Badge>}
              </div>
              <CardDescription data-test-id="session-ip-address">
                {session.ipAddress || labels.unknownIp}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {labels.created} {formatDate(session.createdAt)}
              </span>
              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                >
                  {revoking === session.id ? labels.revoking : labels.revoke}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
