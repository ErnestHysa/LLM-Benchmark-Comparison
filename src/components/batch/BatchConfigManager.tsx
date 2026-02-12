/**
 * Batch Configuration Manager Component
 *
 * UI for managing saved batch configurations
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Trash2, Play, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BatchConfig {
  id: string;
  name: string;
  benchmarkIds: string[];
  modelIds: string[];
  evaluatorModel: string;
  evaluatorProvider: string;
  concurrency: number;
  scheduleConfig?: {
    type: string;
    cronExpression?: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface BatchConfigManagerProps {
  onLoadConfig?: (config: BatchConfig) => void;
}

export function BatchConfigManager({ onLoadConfig }: BatchConfigManagerProps) {
  const { toast } = useToast();

  const [configs, setConfigs] = useState<BatchConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/batch/configs');
      if (!response.ok) throw new Error('Failed to fetch configurations');

      const data = await response.json();
      setConfigs(data.configs);
    } catch (error) {
      toast({
        title: 'Failed to load configurations',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const createConfig = async () => {
    if (!newConfigName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the configuration.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // This would be called with actual configuration data from the BatchRunner
      // For now, we'll create a minimal config
      const response = await fetch('/api/batch/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newConfigName,
          benchmarkIds: [],
          modelIds: [],
          evaluatorModel: 'gpt-4o',
          evaluatorProvider: 'openai',
          concurrency: 5,
        }),
      });

      if (!response.ok) throw new Error('Failed to create configuration');

      await fetchConfigs();
      setCreateDialogOpen(false);
      setNewConfigName('');

      toast({
        title: 'Configuration created',
        description: `Saved configuration "${newConfigName}"`,
      });
    } catch (error) {
      toast({
        title: 'Failed to create configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (id: string) => {
    setDeleting(id);
    try {
      const response = await fetch(`/api/batch/configs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete configuration');

      setConfigs((prev) => prev.filter((c) => c.id !== id));

      toast({
        title: 'Configuration deleted',
        description: 'The configuration has been deleted.',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/batch/configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) throw new Error('Failed to update configuration');

      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive } : c))
      );
    } catch (error) {
      toast({
        title: 'Failed to update configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Saved Configurations</CardTitle>
            <CardDescription>
              {configs.length} saved configuration{configs.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Config
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Configuration</DialogTitle>
                <DialogDescription>
                  Save the current batch runner settings as a new configuration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="config-name">Configuration Name</Label>
                  <Input
                    id="config-name"
                    placeholder="My Batch Configuration"
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: This creates a minimal configuration. Configure it fully from the
                  Batch Runner first.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={createConfig} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No saved configurations. Create one from the Batch Runner.
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{config.name}</span>
                    <Badge variant={config.isActive ? 'default' : 'secondary'}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {config.benchmarkIds.length} benchmarks · {config.modelIds.length} models ·{' '}
                    {config.evaluatorProvider}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatDate(config.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.isActive}
                    onCheckedChange={(checked) => toggleActive(config.id, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadConfig?.(config)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteConfig(config.id)}
                    disabled={deleting === config.id}
                  >
                    {deleting === config.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
