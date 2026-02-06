/**
 * BenchmarkBuilder Component
 *
 * Client component for building custom benchmarks
 * with rich prompt editor, templates, and validation
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Save,
  Eye,
  Copy,
  Check,
  X,
  Plus,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Category {
  value: string;
  label: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  prompt: string;
  tags: string[];
  isSystem: boolean;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
}

interface BenchmarkBuilderProps {
  categories: Category[];
  templates: Template[];
  collections: Collection[];
}

export function BenchmarkBuilder({ categories, templates, collections }: BenchmarkBuilderProps) {
  const router = useRouter();

  // Refs to track timeouts for cleanup
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<"builder" | "templates" | "preview">("builder");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [collectionId, setCollectionId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  // Add tag
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Apply template
  const applyTemplate = (template: Template) => {
    setName(template.name + " (Custom)");
    setDescription(`Custom version of: ${template.description}`);
    setPrompt(template.prompt);
    setPrimaryCategory(template.category);
    setDifficulty(template.difficulty);
    setTags(template.tags || []);
    setActiveTab("builder");
  };

  // Save benchmark
  const saveBenchmark = async () => {
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Benchmark name is required");
      return;
    }
    if (!prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    if (!primaryCategory) {
      setError("Please select a primary category");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          prompt: prompt.trim(),
          primaryCategory,
          difficulty,
          collectionId: collectionId || null,
          estimatedTokens: null,
          tags: tags.length > 0 ? JSON.stringify(tags) : null,
          isPublic: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSaved(true);
        // Clear any existing navigation timeout
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }
        navigationTimeoutRef.current = setTimeout(() => {
          router.push(`/benchmarks/${data.benchmark.id}`);
        }, 1000);
      } else {
        const err = await response.json();
        setError(err.error?.message || "Failed to save benchmark");
      }
    } catch {
      setError("Failed to save benchmark. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Copy prompt
  const [copied, setCopied] = useState(false);
  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    // Clear any existing timeout
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  // Get difficulty color
  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "beginner": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "intermediate": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "advanced": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "expert": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Editor */}
      <div className="lg:col-span-2 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-surface">
            <TabsTrigger value="builder">
              <Sparkles className="h-4 w-4 mr-2" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Lightbulb className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Builder Tab */}
          <TabsContent value="builder" className="space-y-6 mt-4">
            {/* Name & Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Benchmark Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., React Component Generator"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What this benchmark tests and why it matters..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Category & Difficulty */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="category">Primary Category *</Label>
                  <Select value={primaryCategory} onValueChange={setPrimaryCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${cat.color.replace("bg-", "bg-").split(" ")[0]}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="collection">Collection (Optional)</Label>
                  <Select value={collectionId} onValueChange={setCollectionId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Add to collection..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No collection</SelectItem>
                      {collections.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          <div className="flex items-center gap-2">
                            {col.icon && <span>{col.icon}</span>}
                            {col.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Prompt Editor */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Test Prompt</CardTitle>
                <Button variant="ghost" size="sm" onClick={copyPrompt}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter the prompt that will be sent to the LLM being tested..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{prompt.length} characters</span>
                  <span>Est. tokens: ~{Math.ceil(prompt.length / 4)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer">
                        {tag}
                        <X
                          className="h-3 w-3 ml-1"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => applyTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {template.isSystem && (
                        <Badge variant="outline" className="text-xs">Official</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={getDifficultyColor(template.difficulty)}>
                        {template.difficulty}
                      </Badge>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Benchmark Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">{name || "Untitled Benchmark"}</h3>
                  <p className="text-sm text-muted-foreground">{description || "No description"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {primaryCategory && (
                    <Badge>{categories.find((c) => c.value === primaryCategory)?.label}</Badge>
                  )}
                  <Badge className={getDifficultyColor(difficulty)}>{difficulty}</Badge>
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Prompt Preview</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-64">
                    {prompt || "No prompt content"}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Actions Card */}
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-error/10 text-error rounded-md text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button
              onClick={saveBenchmark}
              disabled={saving || saved}
              className="w-full"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Benchmark"}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/benchmarks")}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Be specific in your prompt about what you want the model to produce.</p>
            <p>• Include examples of expected output format.</p>
            <p>• Set appropriate difficulty level for meaningful comparisons.</p>
            <p>• Use tags to organize related benchmarks.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
