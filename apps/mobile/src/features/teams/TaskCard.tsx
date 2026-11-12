import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, MetadataRow, Tag, Text, TextButton, colors, space } from '../../design-system';
import type { TeamTask } from './api';
import { PRIORITY_LABEL, PRIORITY_TONE } from './labels';
import { isoToDisplayDate } from './logic';

interface TaskCardProps {
  task: TeamTask;
  assignee: string;
  overdue: boolean;
  /** Label of the advance action ("Başla" / "Tamamla"); undefined when this person cannot move the task. */
  advanceLabel?: string;
  advancing: boolean;
  onAdvance: () => void;
  /** Managers only. */
  onEdit?: () => void;
}

/**
 * Kanban task card, a RowCard sibling: same surface and radius, tag row (priority, overdue) → title → meta lines → actions.
 * The actions are real buttons, so unlike RowCard the card itself is not one press target.
 */
export function TaskCard({ task, assignee, overdue, advanceLabel, advancing, onAdvance, onEdit }: TaskCardProps) {
  const priority = task.priority === 'normal' ? null : task.priority;
  return (
    <Card style={styles.card}>
      {(!!priority || overdue) && (
        <View style={styles.tags}>
          {priority && <Tag label={PRIORITY_LABEL[priority]} tone={PRIORITY_TONE[priority]} />}
          {overdue && <Tag label="GECİKTİ" tone="danger" />}
        </View>
      )}
      <Text variant="cardTitle" breakStrategy="words">{task.title}</Text>
      <MetadataRow icon="profile">{assignee}</MetadataRow>
      {!!task.due_date && <MetadataRow icon="clock">Son tarih: {isoToDisplayDate(task.due_date)}</MetadataRow>}
      <View style={styles.actions}>
        {advanceLabel
          ? <TextButton label={advanceLabel} iconRight="arrow" disabled={advancing} onPress={onAdvance} accessibilityLabel={`${task.title}: ${advanceLabel}`} />
          : <View />}
        {onEdit && <TextButton label="Düzenle" color={colors.textSecondary} onPress={onEdit} accessibilityLabel={`${task.title}: düzenle`} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' },
});
