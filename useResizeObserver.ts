"use client";

import { useEffect, useRef } from "react";

import { debounce } from "@/utils";

export type ResizeListener = (rect: DOMRectReadOnly) => void;

export class ResizeHandler {
  private target: Element;
  private interval: number;
  private onResize: ResizeListener;

  private observer: ResizeObserver;

  constructor(target: Element, onResize: ResizeListener, interval?: number) {
    if (interval === undefined) {
      this.onResize = onResize;
      this.interval = 0;
    } else {
      this.onResize = debounce(onResize, interval);
      this.interval = interval;
    }

    const callback: ResizeObserverCallback = (entries) => {
      this.onResize(entries[0].contentRect);
    };
    this.target = target;
    this.observer = new ResizeObserver(callback);
    this.start();
  }

  start() {
    this.observer.observe(this.target);
  }

  stop() {
    this.observer.disconnect();
  }

  updateListener(onResize: ResizeListener) {
    this.onResize =
      this.interval === 0 ? onResize : debounce(onResize, this.interval);
  }
}

export type IResizeHandler = InstanceType<typeof ResizeHandler>;

export type ResizeConfig = {
  target: React.RefObject<Element>;
  interval?: number;
};

const useResizeObserver = (
  { target, interval = 0 }: ResizeConfig,
  onResize: (rect: DOMRectReadOnly) => void,
  deps?: React.DependencyList,
) => {
  const resizeHandler = useRef<IResizeHandler | null>(null);

  useEffect(() => {
    if (target.current !== null && resizeHandler.current === null) {
      resizeHandler.current = new ResizeHandler(
        target.current,
        onResize,
        interval,
      );
    }

    if (target.current === null && resizeHandler.current !== null) {
      resizeHandler.current.stop();
      resizeHandler.current = null;
    }
  });

  useEffect(() => {
    if (resizeHandler.current !== null) {
      resizeHandler.current.updateListener(onResize);
    }
  }, deps);
};

export default useResizeObserver;
