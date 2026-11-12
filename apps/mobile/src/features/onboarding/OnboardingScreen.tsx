import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Screen, Select, Text, TextButton, colors, radius, space, tones } from '../../design-system';
import { track } from '../../lib/analytics';
import type { EducationStage } from '../../lib/database.types';
import { EDUCATION_STAGES, FALLBACK_INTERESTS } from './options';
import { usePrefs } from './PrefsProvider';

type Step = 'welcome' | 'stage' | 'interests';

/** Value proposition → education stage → interests → guest discovery. No account needed. */
export function OnboardingScreen() {
  const { update } = usePrefs();
  const [step, setStep] = useState<Step>('welcome');
  const [stage, setStage] = useState<EducationStage | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  useEffect(() => { track('onboarding_started'); }, []);

  /** `skip` keeps only the answers already confirmed with "Devam et"; nothing typed or tapped on the current step is saved. */
  const finish = (confirmed: { stage: EducationStage | null; interests: string[] }) => {
    update({ onboarded: true, educationStage: confirmed.stage, interestSlugs: confirmed.interests });
    track('onboarding_completed', { interests: confirmed.interests.length, stage: confirmed.stage });
  };
  const toggle = (slug: string) => setInterests((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  const skip = (confirmed: { stage: EducationStage | null; interests: string[] }) => <TextButton label="Şimdilik geç" onPress={() => finish(confirmed)} />;

  if (step === 'welcome') {
    return (
      <Screen footer={<><Button label="Başlayalım" iconRight="arrow" onPress={() => setStep('stage')} />{skip({ stage: null, interests: [] })}</>}>
        <StepLabel n={1} title="Hoş geldin" />
        <View style={styles.art}>
          <View style={styles.orbit} /><View style={styles.orbitTwo} /><View style={styles.orb} />
          <Text variant="title" style={{ color: colors.lime }}>merak.{'\n'}üretim.{'\n'}etki.</Text>
        </View>
        <Text variant="display" style={{ marginTop: space[6] }}>Bir fikrin varsa,{'\n'}bir yerin var.</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>
          Etkinlikleri keşfet, takımlara katıl, üret ve yaptıklarını görünür kıl. Göz atmak için hesap gerekmez.
        </Text>
      </Screen>
    );
  }
  if (step === 'stage') {
    return (
      <Screen footer={<><Button label="Devam et" disabled={!stage} onPress={() => setStep('interests')} />{skip({ stage: null, interests: [] })}</>}>
        <StepLabel n={2} title="Tanışalım" />
        <Text variant="display" style={{ marginTop: space[3], marginBottom: space[5] }}>Sen nereden{'\n'}başlıyorsun?</Text>
        <Select label="Sana uygun deneyimleri birlikte bulalım." options={EDUCATION_STAGES} value={stage} onChange={setStage} />
      </Screen>
    );
  }
  return (
    <Screen footer={<><Button label="Keşfetmeye başla" onPress={() => finish({ stage, interests })} />{skip({ stage, interests: [] })}</>}>
      <StepLabel n={3} title="Merak ettiklerin" />
      <Text variant="display" style={{ marginTop: space[3] }}>Neler ilgini{'\n'}çekiyor?</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>İstediğin kadar seç. Sonradan değiştirebilirsin.</Text>
      <View style={styles.chips}>
        {FALLBACK_INTERESTS.map((i) => <Chip key={i.slug} label={i.label} icon={i.icon} selected={interests.includes(i.slug)} onPress={() => toggle(i.slug)} />)}
      </View>
    </Screen>
  );
}

const STEPS = 3;
/** Text progress, not dots: "2/3 · Tanışalım". The accessibility label carries the count first ("Adım 2/3, Tanışalım"). */
function StepLabel({ n, title }: { n: number; title: string }) {
  return <Text variant="label" color="textSecondary" accessibilityLabel={`Adım ${n}/${STEPS}, ${title}`}>{`${n}/${STEPS} · ${title}`}</Text>;
}

const styles = StyleSheet.create({
  art: { backgroundColor: tones.ink.bg, borderRadius: radius.hero, minHeight: 250, padding: space[5], justifyContent: 'flex-end', overflow: 'hidden', marginTop: space[4] },
  orbit: { position: 'absolute', right: -40, top: -20, width: 210, height: 210, borderRadius: radius.pill, borderWidth: 12, borderColor: colors.primary, transform: [{ scaleY: 0.8 }, { rotate: '-20deg' }] },
  orbitTwo: { position: 'absolute', right: 6, top: 30, width: 116, height: 116, borderRadius: radius.pill, borderWidth: 8, borderColor: colors.lime, opacity: 0.85 },
  orb: { position: 'absolute', right: 52, top: 74, width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.apricot },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[6] },
});
