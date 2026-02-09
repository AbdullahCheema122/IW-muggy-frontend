import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps extends React.HTMLAttributes<HTMLFormElement> {
  onSend?: (message: string) => void;
  disabled?: boolean;
  /**
   * Use React's submit event type (NOT DOM SubmitEvent) to avoid TS mismatch.
   */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function ChatInput({
  onSend,
  className,
  disabled,
  onSubmit,
  ...props
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(e);
    onSend?.(message);
    setMessage("");
  };

  const isDisabled = disabled || message.trim().length === 0;

  useEffect(() => {
    if (disabled) return;
    inputRef.current?.focus();
  }, [disabled]);

  return (
    <form
      {...props}
      onSubmit={handleSubmit}
      className={cn("flex items-center gap-2 rounded-md pl-1 text-sm", className)}
    >
      <input
        autoFocus
        ref={inputRef}
        type="text"
        value={message}
        disabled={disabled}
        placeholder="Type something..."
        onChange={(e) => setMessage(e.target.value)}
        className="flex-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />

      <Button
        size="sm"
        type="submit"
        variant={isDisabled ? "secondary" : "primary"}
        disabled={isDisabled}
        className="font-mono"
      >
        SEND.
      </Button>
    </form>
  );
}
