"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";

type ScrollSnapshot = {
  scrollTop: number;
  windowY: number;
};

type SpravaTableScrollContextValue = {
  scrollRef: RefObject<HTMLDivElement | null>;
  runPreservingScroll: (action: () => void) => void;
  navigateObsah: (href: string) => void;
};

const SpravaTableScrollContext =
  createContext<SpravaTableScrollContextValue | null>(null);

function restoreScrollSnapshot(
  scrollEl: HTMLDivElement | null,
  snapshot: ScrollSnapshot
) {
  if (scrollEl) {
    scrollEl.scrollTop = snapshot.scrollTop;
  }
  if (window.scrollY !== snapshot.windowY) {
    window.scrollTo({ top: snapshot.windowY, left: 0, behavior: "auto" });
  }
}

export function SpravaTableScrollProvider({
  children,
  disableObsahNavigation = false,
}: {
  children: ReactNode;
  disableObsahNavigation?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRestoreRef = useRef<ScrollSnapshot | null>(null);
  const router = useRouter();

  const captureScroll = useCallback((): ScrollSnapshot => {
    return {
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      windowY: window.scrollY,
    };
  }, []);

  const runPreservingScroll = useCallback(
    (action: () => void) => {
      pendingRestoreRef.current = captureScroll();
      action();
    },
    [captureScroll]
  );

  const navigateObsah = useCallback(
    (href: string) => {
      if (disableObsahNavigation) return;
      pendingRestoreRef.current = captureScroll();
      router.replace(href, { scroll: false });
    },
    [captureScroll, disableObsahNavigation, router]
  );

  useLayoutEffect(() => {
    const snapshot = pendingRestoreRef.current;
    if (!snapshot) return;
    pendingRestoreRef.current = null;
    restoreScrollSnapshot(scrollRef.current, snapshot);
  });

  const value: SpravaTableScrollContextValue = {
    scrollRef,
    runPreservingScroll,
    navigateObsah,
  };

  return (
    <SpravaTableScrollContext.Provider value={value}>
      {children}
    </SpravaTableScrollContext.Provider>
  );
}

export function useSpravaTableScroll() {
  return useContext(SpravaTableScrollContext);
}
