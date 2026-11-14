import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, layout, radius, space, type } from '../tokens';
import { Text } from '../Text';
import { TechIcon } from '../TechIcon';
import { ShakeOnError } from './ShakeOnError';

interface FieldShellProps { label: string; error?: string; help?: string; children: React.ReactNode }

// The field itself carries its name (accessibilityLabel) and help (accessibilityHint); the visible copies are not extra screen-reader stops.
const OFF_TREE = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

function FieldShell({ label, error, help, children }: FieldShellProps) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" {...OFF_TREE}>{label}</Text>
      {children}
      {error ? <Text variant="caption" color="danger" accessibilityLiveRegion="polite">{error}</Text>
        : help ? <Text variant="caption" color="textSecondary" {...OFF_TREE}>{help}</Text> : null}
    </View>
  );
}

/** `error` shakes the field and fires the error haptic whenever it changes to a new message: set it on submit/blur, never per keystroke. */
export interface InputProps extends TextInputProps { label: string; error?: string; help?: string }

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, help, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell label={label} error={error} help={help}>
      <ShakeOnError trigger={error}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ? undefined : help}
          placeholderTextColor={colors.textSecondary}
          {...rest}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, focused && styles.focused, !!error && styles.errored, style]}
        />
      </ShakeOnError>
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

/** On / off setting: label and plain-language helper on the left, a native switch on the right. The switch carries the label and its state. */
export function SwitchRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" breakStrategy="words" {...OFF_TREE}>{label}</Text>
        {description && <Text variant="caption" color="textSecondary" {...OFF_TREE}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} accessibilityHint={description}
        trackColor={{ false: colors.borderStrong, true: colors.primary }} thumbColor={colors.white} />
    </View>
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
    paddingHorizontal: space[4], fontFamily: fonts.body, fontSize: type.body.fontSize, color: colors.ink,
  },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  errored: { borderColor: colors.danger },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 52, borderRadius: radius.control, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: space[4],
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: type.body.fontSize, color: colors.ink, minHeight: layout.touchTarget },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: layout.touchTarget + space[2], paddingVertical: space[2] },
  toggleRow: { flexDirection: 'row', gap: space[3], minHeight: layout.touchTarget, alignItems: 'flex-start', paddingVertical: space[2] },
  box: { width: 24, height: 24, borderRadius: radius.small, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space[4] },
  radioCardChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radioDot: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  radioDotInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
});
