import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Avatar, Button, Card, Chip, EmptyState, ErrorState, IconButton, Input, LoadingSkeleton, MetadataRow, Modal, Notice, ResponsiveGrid, Screen, SegmentedControl, Select, Tag, Text, TextButton, colors, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { decideJoin, fetchRoster, fetchTasks, fetchTeam, leaveTeam, removeMember, setMemberRole, setMemberTitle, setTaskStatus, teamKeys, type RosterEntry, type TeamTask } from './api';
import { PRIORITY_LABEL, ROLE_LABEL, ROLE_OPTIONS, ROLE_TONE, TASK_ADVANCE_LABEL, TASK_STATUS_LABEL } from './labels';
import { TASK_ORDER, canAdvanceTask, groupTasks, isOverdue, isoToDisplayDate, nextStatus, onlyMine, permissionsFor, type TeamRole } from './logic';

type Tab = 'Görevler' | 'Üyeler' | 'İstekler';

export function TeamWorkspaceScreen({ navigation, route }: NativeStackScreenProps<CommunityStackParamList, 'TeamWorkspace'>) {
  const { teamId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const [tab, setTab] = useState<Tab>('Görevler');
  const [roleTarget, setRoleTarget] = useState<RosterEntry | null>(null); const [roleDraft, setRoleDraft] = useState<TeamRole>('member');
  const [titleTarget, setTitleTarget] = useState<RosterEntry | null>(null); const [titleDraft, setTitleDraft] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RosterEntry | null>(null); const [confirmLeave, setConfirmLeave] = useState(false);

  const team = useQuery({ queryKey: teamKeys.detail(teamId), queryFn: () => fetchTeam(teamId) });
  // The roster is the authority for "who am I here": it only answers for active members (403 team_members_only otherwise).
  const roster = useQuery({ queryKey: teamKeys.roster(teamId), queryFn: () => fetchRoster(teamId), enabled: !!userId, retry: false });
  const tasks = useQuery({ queryKey: teamKeys.tasks(teamId), queryFn: () => fetchTasks(teamId), enabled: roster.isSuccess });

  const me = roster.data?.find((r) => r.user_id === userId) ?? null;
  const perms = permissionsFor(me);
  const active = useMemo(() => (roster.data ?? []).filter((r) => r.status === 'active'), [roster.data]);
  const pending = useMemo(() => (roster.data ?? []).filter((r) => r.status === 'pending'), [roster.data]);
  const nameOf = useMemo(() => new Map(active.map((r) => [r.user_id, r.display_name ?? 'İsimsiz üye'])), [active]);
  const visibleTasks = useMemo(() => (mineOnly ? onlyMine(tasks.data ?? [], userId) : tasks.data ?? []), [tasks.data, mineOnly, userId]);
  const grouped = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);
  const total = tasks.data?.length ?? 0; const doneCount = (tasks.data ?? []).filter((t) => t.status === 'done').length; const overdueCount = (tasks.data ?? []).filter((t) => isOverdue(t)).length;

  const refreshTeam = () => qc.invalidateQueries({ queryKey: ['teams'] });
  const onError = (e: unknown) => toast.show(toAppError(e).message, 'danger');
  const advance = useMutation({ mutationFn: (t: TeamTask) => setTaskStatus(t.id, nextStatus(t.status)!), onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.tasks(teamId) }), onError });
  const decide = useMutation({ mutationFn: (v: { id: string; accept: boolean }) => decideJoin(v.id, v.accept), onSuccess: async (_d, v) => { await refreshTeam(); toast.show(v.accept ? 'Takıma eklendi.' : 'İstek reddedildi.', v.accept ? 'success' : 'neutral'); }, onError });
  const changeRole = useMutation({ mutationFn: (v: { id: string; role: TeamRole }) => setMemberRole(v.id, v.role), onSuccess: async () => { setRoleTarget(null); await refreshTeam(); toast.show('Rol güncellendi.', 'success'); } });
  const changeTitle = useMutation({ mutationFn: (v: { id: string; title: string }) => setMemberTitle(v.id, v.title), onSuccess: async (_d, v) => { setTitleTarget(null); await qc.invalidateQueries({ queryKey: teamKeys.roster(teamId) }); toast.show(v.title.trim() ? 'Unvan güncellendi.' : 'Unvan kaldırıldı.', 'success'); } });
  const remove = useMutation({ mutationFn: (id: string) => removeMember(id), onSuccess: async () => { setRemoveTarget(null); await refreshTeam(); toast.show('Üye takımdan çıkarıldı.'); } });
  const leave = useMutation({ mutationFn: () => leaveTeam(teamId), onSuccess: async () => { setConfirmLeave(false); await refreshTeam(); toast.show('Takımdan ayrıldın.'); navigation.popTo('CommunityHome'); } });

  const header = <AppHeader onBack={navigation.goBack} title={team.data?.name ?? 'Takım alanı'}
    right={perms.canManage ? <IconButton icon="plus" accessibilityLabel="Yeni görev" onPress={() => navigation.navigate('TeamTaskEditor', { teamId })} /> : undefined} />;

  if (!userId) return <Screen header={header}><EmptyState icon="community" title="Takım alanı üyeler içindir" body="Giriş yaptığında üyesi olduğun takımların alanı burada açılır." actionLabel="Giriş yap" onAction={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} /></Screen>;
  if (roster.isPending) return <Screen header={header}><LoadingSkeleton variant="row" /></Screen>;
  if (roster.isError) {
    const err = toAppError(roster.error);
    return (
      <Screen header={header}>
        {err.code === 'team_members_only'
          ? <EmptyState icon="shield" title="Bu alan yalnızca takım üyelerine açık" body="Takıma katılma isteği gönderebilirsin; kabul edildiğinde görevler ve üyeler burada görünür." actionLabel="Takım sayfasına git" onAction={() => navigation.replace('TeamDetail', { teamId })} />
          : <ErrorState error={err} onRetry={() => void roster.refetch()} />}
      </Screen>
    );
  }

  const tabs: readonly Tab[] = perms.canManage ? ['Görevler', 'Üyeler', 'İstekler'] : ['Görevler', 'Üyeler'];
  const taskCard = (t: TeamTask) => {
    const overdue = isOverdue(t); const label = TASK_ADVANCE_LABEL[t.status];
    return (
      <Card key={t.id} style={{ gap: space[2] }}>
        {t.priority !== 'normal' && <View style={{ flexDirection: 'row' }}><Tag label={PRIORITY_LABEL[t.priority]} tone={t.priority === 'high' ? 'apricot' : 'neutral'} /></View>}
        <Text variant="cardTitle">{t.title}</Text>
        <MetadataRow icon="profile">{t.assignee_id ? nameOf.get(t.assignee_id) ?? 'Eski üye' : 'Atanmadı'}</MetadataRow>
        {!!t.due_date && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <MetadataRow icon="clock">Son tarih: {isoToDisplayDate(t.due_date)}</MetadataRow>
            {overdue && <Tag label="GECİKTİ" tone="danger" />}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
          {label && canAdvanceTask(t, userId, perms)
            ? <TextButton label={label} iconRight="arrow" disabled={advance.isPending} onPress={() => advance.mutate(t)} accessibilityLabel={`${t.title}: ${label}`} />
            : <View />}
          {perms.canManage && <TextButton label="Düzenle" color={colors.textSecondary} onPress={() => navigation.navigate('TeamTaskEditor', { teamId, taskId: t.id })} accessibilityLabel={`${t.title}: düzenle`} />}
        </View>
      </Card>
    );
  };

  return (
    <Screen wide header={header} refreshing={roster.isRefetching || tasks.isRefetching} onRefresh={() => { void roster.refetch(); void tasks.refetch(); void team.refetch(); }}>
      <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center', marginBottom: space[3], flexWrap: 'wrap' }}>
        {me && <Tag label={ROLE_LABEL[me.role]} tone={ROLE_TONE[me.role]} />}
        <Text variant="caption" color="textSecondary">{active.length} üye{pending.length > 0 && perms.canManage ? ` · ${pending.length} bekleyen istek` : ''}</Text>
      </View>
      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      {tab === 'Görevler' && (
        <View style={{ marginTop: space[4] }}>
          {tasks.isPending ? <LoadingSkeleton variant="row" /> : tasks.isError ? <ErrorState error={toAppError(tasks.error)} onRetry={() => void tasks.refetch()} />
            : tasks.data.length === 0 ? <EmptyState icon="check" title="Henüz görev yok" body={perms.canManage ? 'İlk görevi ekle; kime ait olduğu ve son tarihi herkes için net olsun.' : 'Kaptan ya da mentor görev eklediğinde burada göreceksin.'} actionLabel={perms.canManage ? 'Görev ekle' : undefined} onAction={() => navigation.navigate('TeamTaskEditor', { teamId })} />
              : (<>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap', marginBottom: space[4] }}>
                  <Chip label="Tüm görevler" selected={!mineOnly} onPress={() => setMineOnly(false)} />
                  <Chip label="Bana atananlar" selected={mineOnly} onPress={() => setMineOnly(true)} />
                  <Text variant="caption" color="textSecondary" style={{ marginLeft: 'auto' }} accessibilityLabel={`${total} görevin ${doneCount} tanesi tamamlandı${overdueCount ? `, ${overdueCount} görev gecikti` : ''}`}>{doneCount} / {total} tamamlandı{overdueCount > 0 ? ` · ${overdueCount} gecikti` : ''}</Text>
                </View>
                <ResponsiveGrid gap={space[4]}>
                  {TASK_ORDER.map((status) => (
                    <View key={status} style={{ gap: space[3] }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                        <Text variant="section">{TASK_STATUS_LABEL[status]}</Text><Text variant="label" color="textSecondary">{grouped[status].length}</Text>
                      </View>
                      {grouped[status].length === 0 ? <Text variant="bodySmall" color="textSecondary">Bu sütun boş.</Text> : grouped[status].map(taskCard)}
                    </View>
                  ))}
                </ResponsiveGrid>
              </>)}
          {perms.canManage && !!tasks.data?.length && <Button kind="secondary" icon="plus" label="Görev ekle" style={{ marginTop: space[5] }} onPress={() => navigation.navigate('TeamTaskEditor', { teamId })} />}
        </View>
      )}

      {tab === 'Üyeler' && (
        <View style={{ marginTop: space[4], gap: space[3] }}>
          <ResponsiveGrid>
            {active.map((r) => (
              <Card key={r.membership_id} style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <Avatar name={r.display_name} />
                  <View style={{ flex: 1, gap: 4 }}><Text variant="label">{r.display_name ?? 'İsimsiz üye'}{r.user_id === userId ? ' (sen)' : ''}</Text>
                    {!!r.title && <Text variant="bodySmall" color="textSecondary">{r.title}</Text>}
                    <View style={{ flexDirection: 'row' }}><Tag label={ROLE_LABEL[r.role]} tone={ROLE_TONE[r.role]} /></View></View>
                </View>
                {perms.canManage && (
                  <View style={{ flexDirection: 'row', gap: space[4], flexWrap: 'wrap' }}>
                    <TextButton label={r.title ? 'Unvanı değiştir' : 'Unvan ver'} onPress={() => { changeTitle.reset(); setTitleDraft(r.title ?? ''); setTitleTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: unvan ata`} />
                    {perms.isCaptain && r.user_id !== userId && (<>
                    <TextButton label="Rolü değiştir" onPress={() => { changeRole.reset(); setRoleDraft(r.role); setRoleTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: rolü değiştir`} />
                    <TextButton label="Takımdan çıkar" color={colors.danger} onPress={() => { remove.reset(); setRemoveTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: takımdan çıkar`} />
                    </>)}
                  </View>
                )}
              </Card>
            ))}
          </ResponsiveGrid>
          <Button kind="danger" label="Takımdan ayrıl" style={{ marginTop: space[4] }} onPress={() => { leave.reset(); setConfirmLeave(true); }} />
        </View>
      )}

      {tab === 'İstekler' && perms.canManage && (
        <View style={{ marginTop: space[4], gap: space[3] }}>
          {pending.length === 0 ? <EmptyState icon="community" title="Bekleyen istek yok" body="Yeni katılma istekleri burada görünür." /> : pending.map((r) => (
            <Card key={r.membership_id} style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}><Avatar name={r.display_name} tone="apricot" /><Text variant="label" style={{ flex: 1 }}>{r.display_name ?? 'İsimsiz kullanıcı'}</Text></View>
              {r.message ? <Text variant="bodySmall" color="textSecondary">“{r.message}”</Text> : <Text variant="caption" color="textSecondary">Not eklenmemiş.</Text>}
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <Button label="Kabul et" style={{ flex: 1 }} disabled={decide.isPending} onPress={() => decide.mutate({ id: r.membership_id, accept: true })} />
                <Button kind="secondary" label="Reddet" style={{ flex: 1 }} disabled={decide.isPending} onPress={() => decide.mutate({ id: r.membership_id, accept: false })} />
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={!!roleTarget} title={`${roleTarget?.display_name ?? 'Üye'} için rol`} onClose={() => setRoleTarget(null)}>
        <Select label="Rol" options={ROLE_OPTIONS} value={roleDraft} onChange={setRoleDraft} />
        {changeRole.error && <Notice tone="danger">{toAppError(changeRole.error).message}</Notice>}
        <Button label="Rolü kaydet" loading={changeRole.isPending} disabled={roleDraft === roleTarget?.role} onPress={() => roleTarget && changeRole.mutate({ id: roleTarget.membership_id, role: roleDraft })} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setRoleTarget(null)} />
      </Modal>

      <Modal visible={!!titleTarget} title={`${titleTarget?.display_name ?? 'Üye'} için unvan`} onClose={() => setTitleTarget(null)}>
        <Input label="Unvan" value={titleDraft} onChangeText={setTitleDraft} maxLength={60} placeholder="Örn. Mekanik lideri, Yazılım sorumlusu" />
        <Text variant="caption" color="textSecondary">Unvan, kişinin takımda ne yaptığını anlatır ve CV’sinde takım adıyla birlikte görünür. Yetki vermez; yetkiler rolden gelir. Boş bırakırsan unvan kaldırılır.</Text>
        {changeTitle.error && <Notice tone="danger">{toAppError(changeTitle.error).message}</Notice>}
        <Button label="Unvanı kaydet" loading={changeTitle.isPending} disabled={titleDraft.trim() === (titleTarget?.title ?? '')} onPress={() => titleTarget && changeTitle.mutate({ id: titleTarget.membership_id, title: titleDraft })} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setTitleTarget(null)} />
      </Modal>

      <Modal visible={!!removeTarget} title="Üyeyi çıkaralım mı?" onClose={() => setRemoveTarget(null)}>
        <Text variant="bodySmall" color="textSecondary">{removeTarget?.display_name ?? 'Bu üye'} takım alanını artık göremez. Üzerindeki görevler atanmamış olarak kalır.</Text>
        {remove.error && <Notice tone="danger">{toAppError(remove.error).message}</Notice>}
        <Button kind="danger" label="Evet, takımdan çıkar" loading={remove.isPending} onPress={() => removeTarget && remove.mutate(removeTarget.membership_id)} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setRemoveTarget(null)} />
      </Modal>

      <Modal visible={confirmLeave} title="Takımdan ayrılalım mı?" onClose={() => setConfirmLeave(false)}>
        <Text variant="bodySmall" color="textSecondary">Görevleri ve üyeleri artık göremezsin. İstersen sonra yeniden katılma isteği gönderebilirsin.</Text>
        {leave.error && <Notice tone="danger">{toAppError(leave.error).code === 'last_captain' ? 'Takımın tek kaptanı sensin. Ayrılmadan önce başka bir üyeyi kaptan yap.' : toAppError(leave.error).message}</Notice>}
        <Button kind="danger" label="Evet, ayrıl" loading={leave.isPending} onPress={() => leave.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmLeave(false)} />
      </Modal>
    </Screen>
  );
}
