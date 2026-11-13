import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, space, timeline } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { stepStateText, type RegistrationStep, type RegistrationStepKey, type StepState, type TeamStepKey } from './Status';

const stepIcon: Record<RegistrationStepKey | TeamStepKey, TechIconName> = { registered: 'task', guardian: 'shield', confirmed: 'verified', card: 'ticket', members: 'team', review: 'clock' };

/** Each state differs by shape/glyph as well as colour: check = done, filled = current, ring = todo, clock = waiting, cross = failed/skipped. */
const look: Record<StepState, { bg: string; border: string; fg: string }> = {
  done: { bg: colors.moss, border: colors.moss, fg: colors.white },
  current: { bg: colors.primary, border: colors.primary, fg: colors.white },
  todo: { bg: colors.surface, border: colors.borderStrong, fg: colors.textSecondary },
  blocked: { bg: colors.apricot, border: colors.apricot, fg: colors.ink },
  failed: { bg: colors.dangerSoft, border: colors.danger, fg: colors.danger },
  skipped: { bg: colors.surfaceSunken, border: colors.borderStrong, fg: colors.textSecondary },
};

const DOT = timeline.dot;

/** Vertical step line. Presentational only: pass the steps from `registrationSteps`. Static, no motion. */
export function StatusTimeline({ steps }: { steps: RegistrationStep[] }) {
  if (steps.length === 0) return null;
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const l = look[step.state];
        const icon: TechIconName = step.state === 'done' ? 'check' : step.state === 'blocked' ? 'clock' : step.state === 'failed' || step.state === 'skipped' ? 'close' : stepIcon[step.key];
        const last = i === steps.length - 1;
        return (
          <View key={step.key} accessible accessibilityRole="text" accessibilityLabel={`${step.label}, ${stepStateText[step.state]}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: l.bg, borderColor: l.border }]}>
                <TechIcon name={icon} size={timeline.icon} color={l.fg} filled={step.state === 'current'} />
              </View>
              {!last && <View style={[styles.line, { backgroundColor: step.state === 'done' ? colors.moss : colors.border }]} />}
            </View>
            <View style={styles.text}>
              <Text variant="label" color={step.state === 'todo' || step.state === 'skipped' ? 'textSecondary' : 'ink'}>{step.label}</Text>
              <Text variant="caption" color="textSecondary">{stepStateText[step.state]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[3], minHeight: DOT + space[3] },
  rail: { alignItems: 'center', width: DOT },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: timeline.stroke, alignItems: 'center', justifyContent: 'center' },
  line: { width: timeline.stroke, flex: 1, marginVertical: space[1] },
  text: { flex: 1, paddingTop: space[1], paddingBottom: space[3] },
});
