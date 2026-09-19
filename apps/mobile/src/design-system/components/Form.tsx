import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, layout, radius, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon } from '../TechIcon';

interface FieldShellProps { label: string; error?: string; help?: string; children: React.ReactNode }

function FieldShell({ label, error, help, children }: FieldShellProps) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label">{label}</Text>
      {children}
      {error ? <Text variant="caption" color="danger" accessibilityLiveRegion="polite">{error}</Text>
        : help ? <Text variant="caption" color="textSecondary">{help}</Text> : null}
    </View>
  );
}

export interface InputProps extends TextInputProps { label: string; error?: string; help?: string }

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, help, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell label={label} error={error} help={help}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        {...rest}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[styles.input, focused && styles.focused, !!error && styles.errored, style]}
      />
    </FieldShell>
  );
});

export const TextArea = forwardRef<TextInput, InputProps>(function TextArea(props, ref) {
  return <Input ref={ref} multiline textAlignVertical="top" {...props} style={[{ minHeight: 120, paddingTop: space[3] }, props.style]} />;
});

export function SearchInput(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <TechIcon name="search" size={20} color={colors.textSecondary} />
      <TextInput accessibilityLabel={props.placeholder} placeholderTextColor={colors.textSecondary} returnKeyType="search"
        autoCorrect={false} {...props} style={[styles.searchInput, props.style]} />
    </View>
  );
}

interface ToggleProps { label: string; description?: string; checked: boolean; onChange: (next: boolean) => void; error?: string }

export function Checkbox({ label, description, checked, onChange, error }: ToggleProps) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.toggleRow}>
      <View style={[styles.box, checked && styles.boxChecked, !!error && { borderColor: colors.danger }]}>
        {checked && <TechIcon name="check" size={16} color={colors.white} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySmall">{label}</Text>
        {description && <Text variant="caption" color="textSecondary">{description}</Text>}
        {error && <Text variant="caption" color="danger">{error}</Text>}
      </View>
    </Pressable>
  );
}

export function Radio({ label, description, checked, onChange }: ToggleProps) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onChange(true)} style={[styles.radioCard, checked && styles.radioCardChecked]}>
      <View style={[styles.radioDot, checked && { borderColor: colors.primary }]}>{checked && <View style={styles.radioDotInner} />}</View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {description && <Text variant="caption" color="textSecondary">{description}</Text>}
      </View>
    </Pressable>
  );
}

/** Single-choice list; on mobile a radio group is more usable than a native dropdown. */
export function Select<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string; description?: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space[2] }}>
      <Text variant="label">{label}</Text>
      {options.map((o) => <Radio key={o.value} label={o.label} description={o.description} checked={o.value === value} onChange={() => onChange(o.value)} />)}
    </View>
  );
}

/** Date entry as GG.AA.YYYY with auto-separators. Validation lives in lib/dates (and again on the server). */
export function DateField({ label, value, onChangeText, error, help }: { label: string; value: string; onChangeText: (v: string) => void; error?: string; help?: string }) {
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.');
  };
  return <Input label={label} value={value} onChangeText={(t) => onChangeText(format(t))} keyboardType="number-pad" placeholder="GG.AA.YYYY" maxLength={10} error={error} help={help} />;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
    paddingHorizontal: space[4], fontFamily: fonts.body, fontSize: 16, color: colors.ink,
  },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  errored: { borderColor: colors.danger },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 52, borderRadius: radius.control, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: space[4],
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, minHeight: layout.touchTarget },
  toggleRow: { flexDirection: 'row', gap: space[3], minHeight: layout.touchTarget, alignItems: 'flex-start', paddingVertical: space[2] },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space[4] },
  radioCardChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radioDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  radioDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
