import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, motion, radius, space } from '../tokens';
import { Text } from '../Text';
import { IconButton } from './Button';
import { useReducedMotion } from '../useReducedMotion';

interface SheetProps { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }

/** Bottom sheet. RN Modal traps screen-reader focus (accessibilityViewIsModal) and handles Android back. */
export function BottomSheet({ visible, title, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <RNModal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Kapat" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + space[5] }]}>
          <View style={styles.sheetHeader}>
            <Text variant="section" style={{ flex: 1 }}>{title}</Text>
            <IconButton icon="close" accessibilityLabel="Kapat" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[4] }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** Centered confirmation dialog. */
export function Modal({ visible, title, onClose, children }: SheetProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(opacity, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: motion.standard, useNativeDriver: true }).start(() => setToast(null));
    }, 3200);
  }, [opacity]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = useMemo(() => ({ show }), [show]);
  const bg = toast?.tone === 'danger' ? colors.danger : toast?.tone === 'success' ? colors.moss : colors.ink;
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + layout.bottomNavHeight + space[3], backgroundColor: bg, opacity }]}>
          <Text variant="bodySmall" color="white">{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingHorizontal: layout.gutter, paddingTop: space[4], maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space[3] },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutter },
  modal: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, padding: space[5], gap: space[4] },
  toast: { position: 'absolute', left: layout.gutter, right: layout.gutter, borderRadius: radius.control, paddingHorizontal: space[4], paddingVertical: space[3] },
});
