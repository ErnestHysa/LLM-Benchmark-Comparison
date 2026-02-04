/**
 * Model Output Modal Component
 *
 * Displays the full model output with syntax highlighting for code
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Code, FileText } from "lucide-react";
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

  if (trimmed.startsWith("<html") || trimmed.startsWith("<div")) {
    return "html";
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
  const { formatted, language } = formatOutput(output);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isCode = language !== "text" && language !== "markdown";
  const hasError = status === "FAILED" || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {isCode ? (
                  <Code className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg">{modelId}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
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
                    {output.length} characters
                  </span>
                </DialogDescription>
              </div>
            </div>
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
          </div>
        </DialogHeader>

        <div className="mt-4">
          {hasError ? (
            <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-error font-medium mb-2">Error Output</p>
              <p className="text-sm text-error/80 whitespace-pre-wrap">
                {error || output || "No output available"}
              </p>
            </div>
          ) : output ? (
            <ScrollArea className="h-[50vh] rounded-lg border border-border">
              <div className="p-4">
                {isCode ? (
                  <div className="rounded-md overflow-hidden">
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        lineHeight: "1.5",
                      }}
                      showLineNumbers
                      wrapLongLines
                    >
                      {formatted}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-sm font-mono">
                    {formatted}
                  </pre>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No output available</p>
              <p className="text-sm mt-2">
                {status === "PENDING" || status === "RUNNING"
                  ? "This model is still being evaluated..."
                  : "This model run produced no output."}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {isCode
              ? "Code syntax highlighting enabled"
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
