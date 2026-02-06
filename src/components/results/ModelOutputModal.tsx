/**
 * Model Output Modal Component
 *
 * Displays the full model output with syntax highlighting for code
 * Full-screen modal to handle long outputs without cutting off
 */

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Code, FileText, X, Maximize2, Minimize2 } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface ModelOutputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  output: string;
  status?: string;
  error?: string;
}

type Language =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "csharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "swift"
  | "kotlin"
  | "sql"
  | "json"
  | "yaml"
  | "xml"
  | "html"
  | "css"
  | "bash"
  | "markdown"
  | "text";

// Detect language from content
function detectLanguage(content: string): Language {
  const trimmed = content.trim().toLowerCase();

  // Code block indicators
  const codeBlockMatch = content.match(/```(\w+)?/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const lang = codeBlockMatch[1].toLowerCase();
    if (
      [
        "js",
        "javascript",
        "ts",
        "typescript",
        "python",
        "py",
        "java",
        "cpp",
        "c++",
        "csharp",
        "c#",
        "go",
        "rust",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "sql",
        "json",
        "yaml",
        "yml",
        "xml",
        "html",
        "css",
        "bash",
        "sh",
        "markdown",
        "md",
      ].includes(lang)
    ) {
      const langMap: Record<string, Language> = {
        js: "javascript",
        javascript: "javascript",
        ts: "typescript",
        typescript: "typescript",
        py: "python",
        python: "python",
        cpp: "cpp",
        "c++": "cpp",
        "c#": "csharp",
        yml: "yaml",
        md: "markdown",
        sh: "bash",
      };
      return langMap[lang] || (lang as Language);
    }
  }

  // Pattern matching
  if (
    trimmed.startsWith("import ") ||
    trimmed.includes("function ") ||
    trimmed.includes("const ") ||
    trimmed.includes("let ") ||
    trimmed.includes("=>") ||
    trimmed.includes("console.")
  ) {
    return "javascript";
  }

  if (
    trimmed.startsWith("def ") ||
    trimmed.includes("import ") ||
    trimmed.includes("class ") ||
    trimmed.includes("print(") ||
    trimmed.includes("self.")
  ) {
    return "python";
  }

  if (
    trimmed.startsWith("public class") ||
    trimmed.includes("private ") ||
    trimmed.includes("public ") ||
    trimmed.includes("System.out")
  ) {
    return "java";
  }

  if (trimmed.startsWith("#include") || trimmed.includes("std::")) {
    return "cpp";
  }

  if (trimmed.startsWith("package ") || trimmed.includes("namespace ")) {
    return "java";
  }

  if (trimmed.startsWith("package main") || trimmed.includes("func ")) {
    return "go";
  }

  if (trimmed.startsWith("fn ") || trimmed.includes("let mut ")) {
    return "rust";
  }

  if (trimmed.startsWith("$") || trimmed.startsWith("#!/")) {
    return "bash";
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  if (trimmed.startsWith("SELECT ") || trimmed.startsWith("select ")) {
    return "sql";
  }

  if (trimmed.startsWith("<html") || trimmed.startsWith("<div") || trimmed.startsWith("<!DOCTYPE")) {
    return "html";
  }

  if (trimmed.startsWith("<style") || trimmed.includes("}")) {
    // Check for CSS patterns
    if (trimmed.includes("{") && trimmed.includes("}") && trimmed.includes(":")) {
      return "css";
    }
  }

  if (trimmed.startsWith("# ")) {
    return "markdown";
  }

  // Default to text
  return "text";
}

// Extract code from markdown code blocks
function extractCode(content: string): { code: string; language: Language } {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(codeBlockRegex));

  if (matches.length === 1) {
    // Single code block - just show the code
    const match = matches[0];
    if (match) {
      const lang = (match[1] || "text") as string;
      const code = (match[2] || "") as string;
      return {
        code: code.trim(),
        language: lang.toLowerCase() as Language,
      };
    }
  }

  if (matches.length > 1) {
    // Multiple code blocks - show all with markdown headers
    return { code: content, language: "markdown" };
  }

  // No code blocks detected
  const language = detectLanguage(content);
  return { code: content, language };
}

// Format output for display
function formatOutput(output: string): { formatted: string; language: Language } {
  const trimmed = output.trim();
  const { code, language } = extractCode(trimmed);
  return { formatted: code, language };
}

export function ModelOutputModal({
  open,
  onOpenChange,
  modelId,
  output,
  status,
  error,
}: ModelOutputModalProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const { formatted, language } = formatOutput(output || "");

  // Cleanup timeout on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output || "");
      if (!isMountedRef.current) return;

      setCopied(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout with proper cleanup
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopied(false);
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isCode = language !== "text" && language !== "markdown";
  const hasError = status === "FAILED" || error;
  const hasContent = output && output.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] flex flex-col",
          isFullscreen ? "w-screen h-screen max-w-none rounded-none mx-0" : "max-w-6xl w-[calc(100vw-2rem)] sm:w-[95vw]"
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {hasError ? (
                  <FileText className="h-5 w-5 text-error" />
                ) : isCode ? (
                  <Code className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg">{modelId}</DialogTitle>
                {/* Use div instead of DialogDescription (which renders <p>) to avoid hydration error with nested <div> from Badge */}
                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      isCode
                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {language}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {output?.length || 0} characters
                  </span>
                  {output && (
                    <span className="text-xs text-muted-foreground">
                      {output.split("\n").length} lines
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content area with flexible height */}
        <div className="flex-1 min-h-0 flex flex-col mt-4">
          {!hasContent && !hasError ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-8">
              <div>
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No output available</p>
                <p className="text-sm mt-2">
                  {status === "PENDING" || status === "RUNNING"
                    ? "This model is still being evaluated..."
                    : "This model run produced no output."}
                </p>
              </div>
            </div>
          ) : hasError ? (
            <ScrollArea className="flex-1 rounded-lg border border-border">
              <div className="p-4">
                <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                  <p className="text-error font-medium mb-2">Error Output</p>
                  <pre className="text-sm text-error/80 whitespace-pre-wrap break-words">
                    {error || output || "No error details available"}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 rounded-lg border border-border">
              <div className="p-4 min-h-full">
                {isCode ? (
                  <div className="rounded-md overflow-hidden bg-[#1e1e1e]">
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        lineHeight: "1.6",
                        background: "#1e1e1e",
                      }}
                      showLineNumbers
                      wrapLongLines={true}
                      lineNumberStyle={{
                        color: "#858585",
                        fontSize: "0.75rem",
                        minWidth: "3em",
                      }}
                    >
                      {formatted}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-sm font-mono text-foreground">
                    {formatted}
                  </pre>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer - fixed at bottom */}
        <div className="flex-shrink-0 flex items-center justify-between text-sm text-muted-foreground pt-4 mt-4 border-t border-border">
          <p className="text-xs">
            {isCode
              ? "Code syntax highlighting enabled - Line wraps enabled"
              : "Plain text output"}
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
