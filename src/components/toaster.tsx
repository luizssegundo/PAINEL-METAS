"use client";

import { useEffect, useState } from "react";

const EVENT_NAME = "app:toast";
let idCounter = 0;

export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: text }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
