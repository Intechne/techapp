import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Screen, Select, Text, TextButton, colors, radius, space } from '../../design-system';
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

  const finish = () => {
    update({ onboarded: true, educationStage: stage, interestSlugs: interests });
    track('onboarding_completed', { interests: interests.length, stage });
  };
  const toggle = (slug: string) => setInterests((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  if (step === 'welcome') {
    return (
      <Screen footer={<><Button label="Başlayalım" iconRight="arrow" onPress={() => setStep('stage')} /><TextButton label="Şimdilik sadece göz at" onPress={finish} /></>}>
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
      <Screen footer={<Button label="Devam et" disabled={!stage} onPress={() => setStep('interests')} />}>
        <Text variant="eyebrow" color="textSecondary">1 / 2 · TANIŞALIM</Text>
        <Text variant="display" style={{ marginTop: space[2], marginBottom: space[5] }}>Sen nereden{'\n'}başlıyorsun?</Text>
        <Select label="Sana uygun deneyimleri birlikte bulalım." options={EDUCATION_STAGES} value={stage} onChange={setStage} />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button label={interests.length ? 'Keşfetmeye başla' : 'Seçmeden devam et'} onPress={finish} />}>
      <Text variant="eyebrow" color="textSecondary">2 / 2 · MERAK ETTİKLERİN</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Neler ilgini{'\n'}çekiyor?</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>İstediğin kadar seç. Sonradan değiştirebilirsin.</Text>
      <View style={styles.chips}>
        {FALLBACK_INTERESTS.map((i) => <Chip key={i.slug} label={i.label} icon={i.icon} selected={interests.includes(i.slug)} onPress={() => toggle(i.slug)} />)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { backgroundColor: '#253E35', borderRadius: radius.hero, minHeight: 250, padding: space[5], justifyContent: 'flex-end', overflow: 'hidden', marginTop: space[4] },
  orbit: { position: 'absolute', right: -40, top: -20, width: 210, height: 210, borderRadius: 105, borderWidth: 12, borderColor: colors.primary, transform: [{ scaleY: 0.8 }, { rotate: '-20deg' }] },
  orbitTwo: { position: 'absolute', right: 6, top: 30, width: 116, height: 116, borderRadius: 58, borderWidth: 8, borderColor: colors.lime, opacity: 0.85 },
  orb: { position: 'absolute', right: 52, top: 74, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.apricot },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[6] },
});
