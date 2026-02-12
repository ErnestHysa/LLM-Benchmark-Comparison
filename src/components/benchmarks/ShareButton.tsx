"use client";

/**
 * Share Button Component
 *
 * Allows sharing benchmark results via clipboard or social media
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, Link, Check, Twitter, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  url: string;
  className?: string;
}

export function ShareButton({ title, url, className }: ShareButtonProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopyText = async () => {
    const text = `🏆 ${title}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText("text");
      setError(null);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setError("Failed to copy text. Please copy manually.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedText("link");
      setError(null);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy link to clipboard:", err);
      setError("Failed to copy link. Please copy manually.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`${title}`);
    const encodedUrl = encodeURIComponent(url);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
      "_blank",
      "width=550,height=420"
    );
  };

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (!open) {
        setError(null);
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {error && (
          <div className="px-2 py-1.5 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
        <DropdownMenuItem onClick={handleCopyText}>
          <Copy className="h-4 w-4 mr-2" />
          Copy summary
          {copiedText === "text" && (
            <Check className="h-4 w-4 ml-auto text-success" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <Link className="h-4 w-4 mr-2" />
          Copy link
          {copiedText === "link" && (
            <Check className="h-4 w-4 ml-auto text-success" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="h-4 w-4 mr-2" />
          Share on X
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple copy-to-clipboard button component
 */
interface CopyButtonProps {
  text: string;
  className?: string;
  onCopy?: () => void;
  onError?: (error: string) => void;
}

export function CopyButton({ text, className, onCopy, onError }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError(true);
      const errorMsg = "Failed to copy to clipboard";
      onError?.(errorMsg);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 w-8 p-0", className)}
      onClick={handleCopy}
      title={error ? "Failed to copy" : copied ? "Copied!" : "Copy"}
    >
      {error ? (
        <AlertCircle className="h-4 w-4 text-destructive" />
      ) : copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
