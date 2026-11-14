import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal as RNModal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, motion, radius, space } from '../tokens';
import { timing } from '../motion';
import { Text } from '../Text';
import { IconButton } from './Button';
import { useReducedMotion } from '../useReducedMotion';
import { useKeyboardOverlap } from '../useKeyboardOverlap';

interface SheetProps { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }

interface FrameProps { title: string; onClose: () => void; children: React.ReactNode; /** The sheet is as tall as this content (no scrolling): for a native 'fitToContents' sheet. */ fit?: boolean }

/**
 * The inside of a native form-sheet route (presentation 'formSheet'): title, close, the form. The sheet itself (detents, grabber,
 * corner radius, dismiss by swipe or back key) is the navigator's; this is only its content. A tall sheet scrolls and keeps taps
 * on the form working while the keyboard is open.
 */
export function SheetFrame({ title, onClose, children, fit }: FrameProps) {
  const insets = useSafeAreaInsets();
  // A sheet at its full detent is not lifted by the keyboard (observed on Android): the scroll area is shortened by what the
  // keyboard covers, so the focused field scrolls into view and the send button stays reachable. A lifted sheet measures 0.
  const frame = useRef<View>(null);
  const covered = useKeyboardOverlap(frame);
  const scroll = useRef<ScrollView>(null);
  // These forms end with their text field and the send button: once the keyboard has shortened the scroll area, bring the end into view.
  useEffect(() => {
    if (fit || covered === 0) return undefined;
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [covered, fit]);
  const header = (
    <View style={styles.sheetHeader}>
      <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
      <IconButton icon="close" accessibilityLabel="Kapat" onPress={onClose} />
    </View>
  );
  return fit ? (
    <View ref={frame} style={[styles.sheet, { paddingBottom: insets.bottom + space[5] }]}>
      {header}
      <View style={{ gap: space[4] }}>{children}</View>
    </View>
  ) : (
    <View ref={frame} style={[styles.sheetTall, { paddingBottom: covered }]}>
      {header}
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: space[4], paddingBottom: insets.bottom + space[5] }}>{children}</ScrollView>
    </View>
  );
}

/** Centered confirmation dialog. */
export function Modal({ visible, title, onClose, children }: SheetProps) {
  const reduced = useReducedMotion();
  return (
    <RNModal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalWrap}>
        <Pressable accessibilityLabel="Kapat" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.modal}>
          <Text variant="section">{title}</Text>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

type ToastTone = 'neutral' | 'success' | 'danger';
interface ToastApi { show: (message: string, tone?: ToastTone) => void }
const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const progress = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    clearTimers();
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    progress.set(withTiming(1, timing('standard')));
    timers.current.push(setTimeout(() => {
      progress.set(withTiming(0, timing('exit')));
      timers.current.push(setTimeout(() => setToast(null), motion.exit));
    }, 3200));
  }, [progress]);
  useEffect(() => () => { clearTimers(); cancelAnimation(progress); }, [progress]);

  // Enter: 8 px up and fade in; exit: fade out. Reduced motion: opacity only, never a translate.
  const animated = useAnimatedStyle(() => (reduced
    ? { opacity: progress.get() }
    : { opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * space[2] }] }));

  const api = useMemo(() => ({ show }), [show]);
  const bg = toast?.tone === 'danger' ? colors.danger : toast?.tone === 'success' ? colors.moss : colors.ink;
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View style={[styles.toast, { pointerEvents: 'none', bottom: insets.bottom + layout.bottomNavHeight + space[3], backgroundColor: bg }, animated]}>
          <Text variant="bodySmall" color="white">{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: layout.gutter, paddingTop: space[6] },
  sheetTall: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: space[6] },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space[3] },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutter },
  modal: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, padding: space[5], gap: space[4] },
  toast: { position: 'absolute', left: layout.gutter, right: layout.gutter, borderRadius: radius.control, paddingHorizontal: space[4], paddingVertical: space[3] },
});
