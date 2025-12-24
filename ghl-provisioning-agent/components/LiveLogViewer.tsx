'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  step?: string;
  progress?: number;
}

interface LiveLogViewerProps {
  jobId: string;
  autoScroll?: boolean;
  maxLines?: number;
}

export function LiveLogViewer({ jobId, autoScroll = true, maxLines = 1000 }: LiveLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    connectToSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId]);

  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const connectToSSE = () => {
    setError(null);
    setIsConnected(false);

    try {
      const eventSource = new EventSource(`/api/provision/jobs/${jobId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        addLog('info', 'Connected to live log stream');
      };

      eventSource.addEventListener('job_status', (event) => {
        const data = JSON.parse(event.data);
        addLog('info', `Job status: ${data.status} (${data.progress}%)`);
      });

      eventSource.addEventListener('step_update', (event) => {
        const data = JSON.parse(event.data);
        const level = data.status === 'failed' ? 'error' : 'info';
        addLog(level, `[${data.step}] ${data.message}`, data.step, data.progress);
      });

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        addLog('info', `Progress: ${data.progress}%`);
      });

      eventSource.addEventListener('completed', (event) => {
        const data = JSON.parse(event.data);
        addLog('info', `✓ Job completed successfully! Sub-account ID: ${data.subAccountId}`);
        eventSource.close();
        setIsConnected(false);
      });

      eventSource.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data);
        addLog('error', `✗ Error: ${data.message}`);
      });

      eventSource.onerror = () => {
        setError('Connection lost. Click reconnect to retry.');
        setIsConnected(false);
        eventSource.close();
      };
    } catch (err) {
      setError('Failed to connect to log stream');
      setIsConnected(false);
    }
  };

  const addLog = (level: LogEntry['level'], message: string, step?: string, progress?: number) => {
    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      step,
      progress,
    };

    setLogs((prev) => {
      const updated = [...prev, newLog];
      return updated.slice(-maxLines);
    });
  };

  const handleReconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    connectToSSE();
  };

  const handleCopyLogs = async () => {
    const logsText = logs
      .map((log) => `[${formatDateTime(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(logsText);
      toast({
        title: 'Copied',
        description: 'Logs copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy logs to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadLogs = () => {
    const logsText = logs
      .map((log) => `[${formatDateTime(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${jobId}-logs-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: 'Logs downloaded successfully',
    });
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-error';
      case 'warn':
        return 'text-warning';
      case 'info':
        return 'text-gray-700';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-gray-700';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warn':
        return <Clock className="h-4 w-4" />;
      case 'info':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Live Logs</CardTitle>
            <Badge variant={isConnected ? 'success' : 'secondary'}>
              <div className={`mr-1 h-2 w-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoScroll(!isAutoScroll)}
            >
              Auto-scroll {isAutoScroll ? 'ON' : 'OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLogs}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
              <Download className="h-4 w-4" />
            </Button>
            {error && (
              <Button variant="outline" size="sm" onClick={handleReconnect}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-error bg-error/10 p-3">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <div className="h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm">
          {logs.length === 0 && (
            <p className="text-center text-gray-500">Waiting for logs...</p>
          )}
          {logs.map((log, index) => (
            <div
              key={index}
              className={`mb-2 flex gap-2 ${getLevelColor(log.level)}`}
            >
              <span className="flex-shrink-0 text-xs text-gray-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="flex-shrink-0">{getLevelIcon(log.level)}</span>
              <span className="flex-1 break-words">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{logs.length} log entries</span>
          {logs.length >= maxLines && (
            <span className="text-warning">
              Maximum {maxLines} lines reached. Older logs are being removed.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
