"use client";
import React, { ReactNode, useRef } from "react";
import { makeStore } from "./store";
import { Provider } from "react-redux";
import { useAuth } from '@/components/auth/provider';

// Safely patch setPointerCapture and releasePointerCapture to prevent crashes from invalid pointer IDs (e.g. untrusted/synthetic events)
if (typeof window !== "undefined") {
  const originalSetPointerCapture = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = function (pointerId: number) {
    try {
      originalSetPointerCapture.call(this, pointerId);
    } catch (err) {
      console.warn("setPointerCapture failed:", err);
    }
  };

  const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    try {
      originalReleasePointerCapture.call(this, pointerId);
    } catch (err) {
      console.warn("releasePointerCapture failed:", err);
    }
  };
}

const AccountStore = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<ReturnType<typeof makeStore> | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();
  return <Provider store={storeRef.current}>{children}</Provider>;
};

const ReduxProvider = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAuth();
  // Hide/unmount private state before the new session cookie is established.
  // A changed UID creates a fresh store (including canvas and RTK caches).
  if (!ready) return null;
  return <AccountStore key={user?.uid ?? 'signed-out'}>{children}</AccountStore>;
};

export default ReduxProvider;
