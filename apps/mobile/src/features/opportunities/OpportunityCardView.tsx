import React from 'react';
import { View } from 'react-native';
import { Card, IconButton, MetadataRow, Tag, TechIcon, Text, colors, radius, space } from '../../design-system';
import { formatDate } from '../../lib/dates';
import type { OpportunityWithOrg } from './api';
import { OPPORTUNITY_TYPE, deadlineView, placeOf, urgencyTone } from './labels';

interface Props { item: OpportunityWithOrg; followed?: boolean; onPress: () => void; onToggleFollow?: () => void }

export const OpportunityCardView = React.memo(function OpportunityCardView({ item, followed, onPress, onToggleFollow }: Props) {
  const type = OPPORTUNITY_TYPE[item.type]; const deadline = deadlineView(item.closes_at);
  return (
    <Card onPress={onPress} style={{ gap: space[2], borderRadius: 19 }} accessibilityLabel={`${item.title}. ${type.label}. ${deadline.label}.`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><TechIcon name={type.icon} color={colors.primary} /></View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}><Tag label={type.label.toLocaleUpperCase('tr')} /><Tag label={deadline.label.toLocaleUpperCase('tr')} tone={urgencyTone(deadline.urgency)} icon="clock" /></View>
        {onToggleFollow && <IconButton icon="bookmark" filled={followed} color={followed ? colors.primary : colors.ink} accessibilityLabel={followed ? 'Takipten çıkar' : 'Son tarihi takip et'} onPress={onToggleFollow} />}
      </View>
      <Text variant="cardTitle">{item.title}</Text>
      <Text variant="bodySmall" color="textSecondary" numberOfLines={3}>{item.summary}</Text>
      <MetadataRow icon="event">Son başvuru: {formatDate(item.closes_at)}</MetadataRow>
      <MetadataRow icon="location">{[placeOf(item), item.audience_note].filter(Boolean).join(' · ')}</MetadataRow>
      {item.reward_note && <MetadataRow icon="spark">{item.reward_note}</MetadataRow>}
    </Card>
  );
});
