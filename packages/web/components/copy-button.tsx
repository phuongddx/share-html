import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CopyButton({
  text,
  label = "Copy",
  className = "",
  variant = "outline",
  size = "sm"
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
        } catch (fallbackError) {
          setCopyError(true);
          return;
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setCopied(true);
      setCopyError(false);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopyError(true);
      // Reset error state after 3 seconds
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  return (
    <Button
      onClick={handleCopy}
      variant={variant}
      size={size}
      className={className}
      disabled={copied}
      title={copyError ? "Failed to copy, try again" : copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? (
        <>
          <Check className="size-4" />
          Copied!
        </>
      ) : copyError ? (
        <>
          <Copy className="size-4" />
          Try Again
        </>
      ) : (
        <>
          <Copy className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}