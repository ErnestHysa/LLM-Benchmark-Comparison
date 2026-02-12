/**
 * Batch History Component
 *
 * Display and manage past batch runs
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Eye, Search, Filter } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BatchResults } from './BatchResults';

interface Batch {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

interface BatchHistoryProps {
  onSelectBatch?: (batchId: string) => void;
}

export function BatchHistory({ onSelectBatch }: BatchHistoryProps) {
  const { toast } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/batch');
      if (!response.ok) throw new Error('Failed to fetch batches');

      const data = await response.json();
      setBatches(data.batches);
      setFilteredBatches(data.batches);
    } catch (error) {
      toast({
        title: 'Failed to load batches',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Filter batches
  useEffect(() => {
    let filtered = batches;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query)
      );
    }

    setFilteredBatches(filtered);
  }, [batches, statusFilter, searchQuery]);

  const deleteBatch = async (id: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/batch/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete batch');

      // Remove from local state
      setBatches((prev) => prev.filter((b) => b.id !== id));
      setDeleteDialogOpen(false);
      setBatchToDelete(null);

      toast({
        title: 'Batch deleted',
        description: 'The batch has been deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete batch',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      FAILED: 'destructive',
      PARTIAL: 'secondary',
      RUNNING: 'outline',
      PENDING: 'secondary',
    };
    const labels: Record<string, string> = {
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      PARTIAL: 'Partial',
      RUNNING: 'Running',
      PENDING: 'Pending',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const calculateDuration = (started: string, completed?: string) => {
    const start = new Date(started);
    const end = completed ? new Date(completed) : new Date();
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    return `${Math.floor(diffMs / 3600000)}h`;
  };

  const calculateProgress = (batch: Batch) => {
    if (batch.totalRuns === 0) return 0;
    return (batch.completedRuns / batch.totalRuns) * 100;
  };

  // If a batch is selected, show its results
  if (selectedBatchId) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setSelectedBatchId(null)}
          className="mb-4"
        >
          ← Back to History
        </Button>
        <BatchResults batchId={selectedBatchId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch History</h2>
          <p className="text-muted-foreground">
            View and manage past batch runs
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="RUNNING">Running</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No batches found. Create your first batch run to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{batch.name}</div>
                        {batch.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {batch.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm">
                          {batch.completedRuns}/{batch.totalRuns}
                        </span>
                        {batch.status === 'RUNNING' && (
                          <span className="text-xs text-muted-foreground">
                            ({calculateProgress(batch).toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {calculateDuration(batch.startedAt, batch.completedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(batch.startedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBatchId(batch.id);
                            onSelectBatch?.(batch.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog
                          open={deleteDialogOpen && batchToDelete === batch.id}
                          onOpenChange={(open) => {
                            setDeleteDialogOpen(open);
                            if (!open) setBatchToDelete(null);
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBatchToDelete(batch.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={batch.status === 'RUNNING'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this batch and all its
                                results. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => batchToDelete && deleteBatch(batchToDelete)}
                                disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
