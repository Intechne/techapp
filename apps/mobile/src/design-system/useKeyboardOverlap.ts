import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, type KeyboardEvent, type View } from 'react-native';

/** How far the keyboard covers the bottom of a container (window coordinates). Never negative. */
export function keyboardOverlap(containerBottom: number, keyboardTop: number): number {
  return Math.max(0, Math.round(containerBottom - keyboardTop));
}

/**
 * Android 16 is edge-to-edge and ignores adjustResize, so the keyboard sits on top of pinned footers.
 * Measures the container against the keyboard's top edge on every show/hide, so it stays correct
 * whether or not the OS also resized the window (no double adjustment).
 */
export function useKeyboardOverlap(containerRef: RefObject<View | null>, enabled = true): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const onShow = (e: KeyboardEvent) => {
      const node = containerRef.current;
      if (!node) return;
      node.measureInWindow((_x, y, _w, h) => setOverlap(keyboardOverlap(y + h, e.endCoordinates.screenY)));
    };
    const onHide = () => setOverlap(0);
    const subs = [Keyboard.addListener('keyboardDidShow', onShow), Keyboard.addListener('keyboardDidHide', onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [containerRef, enabled]);
  return overlap;
}
