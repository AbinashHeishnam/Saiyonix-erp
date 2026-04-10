import { useCallback } from "react";
import type { RefObject } from "react";

type PrintOptions = {
  center?: boolean;
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void;
};

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  if (!images.length) return;

  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const cleanup = () => {
              img.removeEventListener("load", onLoad);
              img.removeEventListener("error", onLoad);
            };
            const onLoad = () => {
              cleanup();
              resolve();
            };
            img.addEventListener("load", onLoad);
            img.addEventListener("error", onLoad);
          })
    )
  );
}

async function waitForFonts() {
  if ("fonts" in document && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

async function settleFrames(count = 2) {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export function usePrint(
  ref: RefObject<HTMLElement>,
  options: PrintOptions = {}
) {
  return useCallback(async () => {
    const root = ref.current;
    if (!root) return;

    if (options.onBeforePrint) {
      await options.onBeforePrint();
    }

    const body = document.body;
    body.classList.add("printing");
    root.classList.add("print-root");
    if (options.center) {
      root.classList.add("print-center");
    }

    const cleanup = () => {
      body.classList.remove("printing");
      root.classList.remove("print-root");
      root.classList.remove("print-center");
      if (options.onAfterPrint) {
        options.onAfterPrint();
      }
    };

    const afterPrintHandler = () => {
      window.removeEventListener("afterprint", afterPrintHandler);
      cleanup();
    };
    window.addEventListener("afterprint", afterPrintHandler);

    await waitForFonts();
    await waitForImages(root);
    await settleFrames(2);

    window.print();

    // Fallback cleanup if afterprint doesn't fire.
    window.setTimeout(() => {
      if (document.body.classList.contains("printing")) {
        cleanup();
      }
    }, 2000);
  }, [options, ref]);
}
