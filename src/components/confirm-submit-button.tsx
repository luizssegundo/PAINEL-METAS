"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { showToast } from "@/components/toaster";

/**
 * Submit button for a Server Action form. Optionally asks for confirmation
 * before submitting, and shows a toast once the action settles — guards
 * against accidental clicks on activate/deactivate/delete/save actions.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  successMessage,
  className,
  children,
}: {
  confirmMessage?: string;
  successMessage?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && successMessage) {
      showToast(successMessage);
    }
    wasPending.current = pending;
  }, [pending, successMessage]);

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "..." : children}
    </button>
  );
}
