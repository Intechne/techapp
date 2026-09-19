import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';

type Kind = 'primary' | 'secondary' | 'lime' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  kind?: Kind;
  icon?: TechIconName;
  iconRight?: TechIconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Kind, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.white },
  secondary: { bg: colors.surface, pressed: colors.canvas, fg: colors.ink, border: colors.border },
  lime: { bg: colors.lime, pressed: '#C9E556', fg: colors.ink },
  danger: { bg: colors.dangerSoft, pressed: '#FBDDE0', fg: colors.danger },
};

export function Button({ label, kind = 'primary', icon, iconRight, loading, disabled, style, ...rest }: ButtonProps) {
  const p = palette[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border ?? 'transparent', opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <TechIcon name={icon} size={20} color={p.fg} />}
          <Text variant="label" style={{ color: p.fg, flexShrink: 1 }} numberOfLines={2} center>
            {label}
          </Text>
          {iconRight && <TechIcon name={iconRight} size={20} color={p.fg} />}
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: TechIconName;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  color?: string;
  filled?: boolean;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, color = colors.ink, filled, surface, style, ...rest }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [styles.iconButton, surface && styles.iconSurface, pressed && { opacity: 0.6 }, style]}
    >
      <TechIcon name={icon} color={color} filled={filled} size={22} />
    </Pressable>
  );
}

interface TextButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  icon?: TechIconName;
  iconRight?: TechIconName;
  color?: string;
}

export function TextButton({ label, icon, iconRight, color = colors.primary, ...rest }: TextButtonProps) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} {...rest} style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}>
      {icon && <TechIcon name={icon} size={18} color={color} />}
      <Text variant="label" style={{ color }}>{label}</Text>
      {iconRight && <TechIcon name={iconRight} size={18} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space[5], paddingVertical: space[3],
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  iconButton: { width: layout.touchTarget, height: layout.touchTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  iconSurface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  textButton: { minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
