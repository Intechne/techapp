# HIG Audit: mobile

**Generated**: 2026-11-11
**Project**: /Users/omerakbulut/techapp-platform/apps/mobile
**Frameworks detected**: react-native
**Files scanned**: 97 code, 0 style, 4 config

**Quick stats**: 2 potential concerns, 124 positive patterns, 212 component usages detected across 8 HIG categories

## Instructions for AI Evaluator

You are reviewing a project for Apple Human Interface Guidelines compliance.
The HIG principles (accessibility, color systems, typography, responsive layout, motion) apply to all surfaces — native, web, and cross-platform.
For each category below, evaluate the code excerpts against the HIG reference material.

**Scoring**: Rate each category 1-10:
- **9-10**: Excellent HIG compliance, follows best practices
- **7-8**: Good compliance with minor improvements possible
- **5-6**: Partial compliance, several areas need attention
- **3-4**: Significant HIG violations
- **1-2**: Major violations or missing fundamental practices

**Output**: For each category, provide:
1. Score (1-10)
2. What's done well (cite specific code)
3. What needs improvement (cite specific file:line)
4. Specific fix recommendations

## Category: Controls

*112 detections across 28 file(s) — 0 concern(s), 0 positive(s)*

### Code Excerpts

**src/app/AppErrorBoundary\.tsx**
~~~tsx
L29: <Button label="Tekrar Dene" onPress={() => this.setState({ failed: false })} style={{ marginTop: space[3] }} />
~~~

**src/design\-system/components/Form\.tsx**
~~~tsx
L40: return <Input ref={ref} multiline textAlignVertical="top" {...props} style={[{ minHeight: 120, paddingTop: space[3] }, props.style]} />;
L98: return <Input label={label} value={value} onChangeText={(t) => onChangeText(format(t))} keyboardType="number-pad" placeholder="GG.AA.YYYY" maxLength={10} error={error} help={help} />;
~~~

**src/design\-system/components/States\.tsx**
~~~tsx
L18: {actionLabel && onAction && <Button kind="secondary" label={actionLabel} onPress={onAction} style={{ marginTop: space[2], alignSelf: 'stretch' }} />}
L31: {error.retryable && onRetry && <Button kind="secondary" label="Tekrar dene" onPress={onRetry} style={{ marginTop: space[2], alignSelf: 'stretch' }} />}
~~~

**src/features/auth/AuthEmailScreen\.tsx**
~~~tsx
L22: footer={<Button label="Kodu gönder" loading={send.isPending} onPress={() => { setTouched(true); if (isValidEmail(email)) send.mutate(email); }} />}
L30: <Input label="E-posta" value={email} onChangeText={setEmail} onBlur={() => setTouched(true)} autoCapitalize="none" autoComplete="email"
~~~

**src/features/auth/AuthOtpScreen\.tsx**
~~~tsx
L55: footer={<Button label="Doğrula" loading={verify.isPending} disabled={code.length < 6} onPress={() => verify.mutate()} />}>
L60: <Input label="Doğrulama kodu" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
~~~

**src/features/auth/ProfileBootstrapScreen\.tsx**
~~~tsx
L51: footer={<Button label="Devam et" loading={save.isPending} onPress={submit} />}>
L55: <Input label="Ad soyad" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
L58: <Select label="Eğitim aşaman" options={EDUCATION_STAGES} value={stage} onChange={setStage} />
~~~

**src/features/auth/StartupUnavailableScreen\.tsx**
~~~tsx
L32: <Button label="Tekrar Dene" onPress={onRetry} loading={retrying} style={{ marginTop: space[3] }} />
~~~

**src/features/checkin/CheckInScreen\.tsx**
~~~tsx
L51: <Button kind="secondary" label="Kameraya izin ver" onPress={() => void requestPermission()} />
L60: {(mutation.data || mutation.error) ? <Button style={{ marginTop: space[4] }} label="Sıradaki katılımcı" onPress={next} /> : (
L62: <Input label="Kodu elle gir" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="TA1.…" help="Kamera okuyamazsa karttaki tam kodu yapıştırabilirsin." />
L63: <Button kind="secondary" label="Kodu doğrula" loading={mutation.isPending} disabled={!manual.trim()} onPress={() => submit(manual)} />
~~~

**src/features/community/CommunityScreen\.tsx**
~~~tsx
L64: <Button kind="secondary" icon="plus" label="Takım kur" onPress={createTeam} style={{ marginTop: space[2] }} />
~~~

**src/features/events/EventDetailScreen\.tsx**
~~~tsx
L48: <Button label={existing.status === 'confirmed' ? 'Katılım kartımı göster' : 'Kayıt durumumu gör'} icon="ticket"
L51: <Button label={full ? 'Kontenjan doldu' : 'Kayıt şu an yapılamıyor'} disabled />
L53: <Button label={full ? 'Bekleme listesine katıl' : 'Etkinliğe katıl'} iconRight="arrow" onPress={join} loading={eligibility.isPending} />
~~~

**src/features/events/EventRegistrationScreen\.tsx**
~~~tsx
L51: footer={<Button label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} />}>
L60: footer={<Button label={waitlist ? 'Bekleme listesine katıl' : 'Katılımı tamamla'} loading={submit.isPending}
~~~

**src/features/events/EventsListScreen\.tsx**
~~~tsx
L77: <Button label="Filtreyi uygula" onPress={() => { setOnlineOnly(draftOnline); setSheet(false); }} />
L78: <Button kind="secondary" label="Tüm filtreleri temizle" onPress={() => { setOnlineOnly(false); setType('all'); setSheet(false); }} />
~~~

**src/features/events/RegistrationStatusScreen\.tsx**
~~~tsx
L52: r.status === 'confirmed' ? <Button label="Katılım kartını göster" icon="ticket" onPress={() => navigation.navigate('ParticipationCard', { registrationId })} />
L53: : needsGuardian ? <Button label={canSendGuardian ? 'Veli onayı iste' : 'Bağlantıyı yeniden gönder'} icon="shield" onPress={() => navigation.navigate('GuardianRequest', { registrationId })} />
L54: : !live ? <Button kind="secondary" label="Etkinliğe dön" onPress={() => navigation.navigate('EventDetail', { eventId: r.event_id })} /> : undefined
L79: {live && <Button kind="danger" label="Kaydımı iptal et" style={{ marginTop: space[6] }} onPress={() => setConfirmCancel(true)} />}
L84: <Button kind="danger" label="Evet, iptal et" loading={cancel.isPending} onPress={() => cancel.mutate()} />
L85: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmCancel(false)} />
~~~

**src/features/guardian/GuardianRequestScreen\.tsx**
~~~tsx
L42: <Screen header={<AppHeader onBack={navigation.goBack} title="Veli onayı" />} footer={<Button label="Onay bağlantısını gönder" loading={send.isPending} onPress={submit} />}>
L51: <Input label="Velinin adı soyadı" value={name} onChangeText={setName} autoComplete="off" error={errors.name} />
L52: <Input label="Velinin e-posta adresi" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" error={errors.email}
~~~

**src/features/onboarding/OnboardingScreen\.tsx**
~~~tsx
L27: <Screen footer={<><Button label="Başlayalım" iconRight="arrow" onPress={() => setStep('stage')} /><TextButton label="Şimdilik sadece göz at" onPress={finish} /></>}>
L41: <Screen footer={<Button label="Devam et" disabled={!stage} onPress={() => setStep('interests')} />}>
L44: <Select label="Sana uygun deneyimleri birlikte bulalım." options={EDUCATION_STAGES} value={stage} onChange={setStage} />
L49: <Screen footer={<Button label={interests.length ? 'Keşfetmeye başla' : 'Seçmeden devam et'} onPress={finish} />}>
~~~

**src/features/opportunities/MyApplicationsScreen\.tsx**
~~~tsx
L42: <Button kind="danger" label="Evet, geri çek" loading={withdraw.isPending} onPress={() => target && withdraw.mutate(target)} />
L43: <Button kind="secondary" label="Vazgeç" onPress={() => setTarget(null)} />
~~~

**src/features/opportunities/OpportunityApplyScreen\.tsx**
~~~tsx
L42: footer={<Button label="Başvuruyu gönder" disabled={!!ineligible} loading={submit.isPending} onPress={() => { if (!accepted) { setShowError(true); return; } submit.mutate(); }} />}>
~~~

**src/features/opportunities/OpportunityDetailScreen\.tsx**
~~~tsx
L40: const footer = mine.data ? <Button kind="secondary" icon="check" label="Başvurumu gör" onPress={() => navigation.navigate('MyApplications')} />
L41: : closed ? <Button label="Başvurular kapandı" disabled /> : ineligible ? <Button label="Bu fırsata başvuramıyorsun" disabled /> : notOpen ? <Button label={`Başvurular ${formatDate(o.opens_at!)} tarihinde açılıyor`} disabled />
L42: : <Button label={external ? 'Başvuru sayfasına git' : 'Başvurunu hazırla'} iconRight={external ? 'link' : 'arrow'} onPress={apply} />;
~~~

**src/features/profile/CvShareCard\.tsx**
~~~tsx
L33: <Button icon="arrow" label={Platform.OS === 'web' ? 'Bağlantıyı kopyala' : 'Bağlantıyı paylaş'} onPress={() => void share()} />
L40: <Button kind="secondary" label="Paylaşım bağlantısı oluştur" loading={sharing.isPending} onPress={() => sharing.mutate(true)} />
~~~

**src/features/profile/EditProfileScreen\.tsx**
~~~tsx
L42: <Screen header={<AppHeader onBack={navigation.goBack} title="Profili düzenle" />} footer={<Button label="Kaydet" loading={save.isPending} onPress={submit} />}>
L50: <Input label="Kısa başlık" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Örn. Robotik takımında yazılımcı" help="Adının altında görünür." />
L52: <Input label="Şehir" value={city} onChangeText={setCity} maxLength={60} autoComplete="off" />
L53: <Select label="Eğitim aşaman" options={EDUCATION_STAGES} value={stage} onChange={setStage} />
L56: <Input label={`Beceriler (${skills.length} / ${MAX_SKILLS})`} value={skillInput} onChangeText={(t) => { setSkillInput(t); setSkillError(undefined); }} onSubmitEditing={commitSkill}
L58: <Button kind="secondary" label="Beceriyi ekle" disabled={!skillInput.trim()} onPress={commitSkill} />
~~~

**src/features/profile/ExperienceDetailScreen\.tsx**
~~~tsx
L34: footer={requestable ? <Button icon="verified" label={provenance === 'self' ? 'Doğrulama iste' : 'Yeniden doğrulama iste'} onPress={() => { request.reset(); setSheet(true); }} /> : undefined}>
L67: <Button kind="secondary" label="Düzenle" onPress={() => navigation.navigate('ExperienceEditor', { experienceId })} />
L68: {item.status === 'published' && <Button kind="secondary" loading={publication.isPending} label={onProfile ? 'Profilimden gizle' : 'Profilimde göster'}
L70: <Button kind="danger" label="Deneyimi sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />
L79: <Button label="İsteği gönder" disabled={!orgId} loading={request.isPending}
L86: <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate(experienceId, { onSuccess: () => { setConfirmDelete(false); toast.show('Deneyim silindi.'); navigation.goBack(); } })} />
L87: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
~~~

**src/features/profile/ExperienceEditorScreen\.tsx**
~~~tsx
L62: <Screen header={header} footer={<><Button label={showOnProfile ? 'Kaydet ve profilimde göster' : 'Kaydet'} loading={save.isPending && !pending} onPress={() => submit(true)} />
L63: {(!existing || existing.status === 'draft') && <Button kind="secondary" label="Taslak olarak kaydet" disabled={save.isPending} onPress={() => submit(false)} />}</>}>
L74: <Input label="Başlık" value={title} onChangeText={setTitle} maxLength={140} placeholder="Örn. Çizgi izleyen robot projesi" error={errors.title} />
L75: <Input label="Senin rolün" value={role} onChangeText={setRole} maxLength={80} placeholder="Örn. Yazılım, takım kaptanı, gönüllü eğitmen" />
L77: <Input label="Kurum / takım / etkinlik" value={org} onChangeText={setOrg} maxLength={120} />
L80: <Input label="Çıktı bağlantısı (isteğe bağlı)" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://" error={errors.link} help="Repo, video, sunum… Herkese açık bir bağlantı olsun." />
L92: <Button kind="danger" label="Yine de kaydet" loading={save.isPending} onPress={() => pending && run(pending)} />
L93: <Button kind="secondary" label="Vazgeç" onPress={() => setPending(null)} />
~~~

**src/features/profile/ProfileScreen\.tsx**
~~~tsx
L92: <Button style={{ marginTop: space[3] }} label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} /></View>
L102: <Button style={{ flex: 1, minWidth: 140 }} icon="plus" label="Deneyim ekle" onPress={() => navigation.navigate('ExperienceEditor', {})} />
L103: <Button style={{ flex: 1, minWidth: 140 }} kind="secondary" label="Profili düzenle" onPress={() => navigation.navigate('EditProfile')} />
L166: <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
L167: <Button kind="danger" label="Hesabımı sil" onPress={() => setConfirmDelete(true)} />
L173: <Button kind="danger" label="Evet, hesabımı sil" loading={del.isPending} onPress={() => del.mutate()} />
L174: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
~~~

**src/features/teams/CreateTeamScreen\.tsx**
~~~tsx
L31: <Screen header={<AppHeader onBack={navigation.goBack} title="Takım kur" />} footer={<Button label="Takımı oluştur" loading={create.isPending} onPress={submit} />}>
L36: <Input label="Takım adı" value={name} onChangeText={setName} maxLength={80} error={nameError} placeholder="Örn. Nova Robotik" />
L37: <Select label="Tür" options={KINDS} value={kind} onChange={setKind} />
L38: <Input label="Alan (isteğe bağlı)" value={category} onChangeText={setCategory} maxLength={60} placeholder="Robotik, yazılım, sosyal etki…" />
L39: <Input label="Kısa tanıtım (isteğe bağlı)" value={tagline} onChangeText={setTagline} maxLength={160} placeholder="Tek cümleyle ne yapıyorsunuz?" />
~~~

**src/features/teams/TeamDetailScreen\.tsx**
~~~tsx
L34: const footer = perms.isMember ? <Button label="Takım alanına git" iconRight="arrow" onPress={() => navigation.navigate('TeamWorkspace', { teamId })} />
L35: : m?.status === 'pending' ? <Button kind="secondary" label="İsteği geri çek" loading={withdraw.isPending} onPress={() => withdraw.mutate(m.id)} />
L36: : !t.accepts_join_requests ? <Button label="Şu an yeni üye almıyor" disabled />
L37: : <Button label="Katılma isteği gönder" loading={!!userId && membership.isPending} onPress={openJoin} />;
L76: <Button label="İsteği gönder" loading={join.isPending} onPress={() => join.mutate()} />
~~~

**src/features/teams/TeamTaskEditorScreen\.tsx**
~~~tsx
L56: <Screen header={header} footer={<Button label={taskId ? 'Değişiklikleri kaydet' : 'Görevi ekle'} loading={save.isPending} onPress={submit} />}>
L60: <Input label="Görev" value={title} onChangeText={setTitle} maxLength={140} error={errors.title} placeholder="Örn. Şasi çizimini tamamla" />
L62: <Select label="Sorumlu" options={members} value={assignee} onChange={setAssignee} />
L64: <Select label="Öncelik" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
L65: <Select label="Durum" options={TASK_STATUS_OPTIONS} value={status} onChange={setStatus} />
L67: {taskId && <Button kind="danger" label="Görevi sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />}
L72: <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate()} />
L73: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L117: {perms.canManage && !!tasks.data?.length && <Button kind="secondary" icon="plus" label="Görev ekle" style={{ marginTop: space[5] }} onPress={() => navigation.navigate('TeamTaskEditor', { teamId })} />}
L144: <Button kind="danger" label="Takımdan ayrıl" style={{ marginTop: space[4] }} onPress={() => { leave.reset(); setConfirmLeave(true); }} />
L155: <Button label="Kabul et" style={{ flex: 1 }} disabled={decide.isPending} onPress={() => decide.mutate({ id: r.membership_id, accept: true })} />
L156: <Button kind="secondary" label="Reddet" style={{ flex: 1 }} disabled={decide.isPending} onPress={() => decide.mutate({ id: r.membership_id, accept: false })} />
L164: <Select label="Rol" options={ROLE_OPTIONS} value={roleDraft} onChange={setRoleDraft} />
L166: <Button label="Rolü kaydet" loading={changeRole.isPending} disabled={roleDraft === roleTarget?.role} onPress={() => roleTarget && changeRole.mutate({ id: roleTarget.membership_id, role: roleDraft })} />
L167: <Button kind="secondary" label="Vazgeç" onPress={() => setRoleTarget(null)} />
L171: <Input label="Unvan" value={titleDraft} onChangeText={setTitleDraft} maxLength={60} placeholder="Örn. Mekanik lideri, Yazılım sorumlusu" />
L174: <Button label="Unvanı kaydet" loading={changeTitle.isPending} disabled={titleDraft.trim() === (titleTarget?.title ?? '')} onPress={() => titleTarget && changeTitle.mutate({ id: titleTarget.membership_id, title: titleDraft })} />
L175: <Button kind="secondary" label="Vazgeç" onPress={() => setTitleTarget(null)} />
L181: <Button kind="danger" label="Evet, takımdan çıkar" loading={remove.isPending} onPress={() => removeTarget && remove.mutate(removeTarget.membership_id)} />
L182: <Button kind="secondary" label="Vazgeç" onPress={() => setRemoveTarget(null)} />
L188: <Button kind="danger" label="Evet, ayrıl" loading={leave.isPending} onPress={() => leave.mutate()} />
L189: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmLeave(false)} />
~~~

**src/features/volunteers/VolunteerSection\.tsx**
~~~tsx
L42: <Button icon="leaf" label="Gönüllü alanını aç" onPress={onOpenHub} />
L49: <Button kind="secondary" icon="leaf" label={status ? 'Yeniden başvur' : 'Gönüllü ol'} onPress={start} />
L58: <Button label="Başvuruyu gönder" loading={apply.isPending} onPress={() => apply.mutate()} />
L59: <Button kind="secondary" label="Vazgeç" onPress={() => setOpen(false)} />
L65: <Button kind="danger" label="Evet, çekil" loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
L66: <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmWithdraw(false)} />
~~~

### HIG Reference

*Load reference from skill: hig-components-controls*

### Evaluate

- Standard control usage (Button, Toggle, Picker, etc.)
- Proper button styles and roles
- Clear action labels and consistent interaction patterns

## Category: Foundations

*72 detections across 28 file(s) — 2 concern(s), 70 positive(s)*

### Code Excerpts

**src/app/AppErrorBoundary\.tsx**
~~~tsx
L26: <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: space[6], gap: space[3] }} accessibilityRole="alert"> // ✓ good
~~~

**src/design\-system/TechIcon\.tsx**
~~~tsx
L21: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${((filled && iconFillPaths[name]) || iconPaths[name]).replaceAll('currentColor', color)}</svg>`, // ⚠ concern
~~~

**src/design\-system/Text\.tsx**
~~~tsx
L18: accessibilityRole={HEADINGS.includes(variant) ? 'header' : rest.accessibilityRole} // ✓ good
~~~

**src/design\-system/components/Button\.tsx**
~~~tsx
L30: accessibilityRole="button" // ✓ good
L31: accessibilityState={{ disabled: !!inactive, busy: !!loading }} // ✓ good
L68: accessibilityRole="button" // ✓ good
L87: <Pressable accessibilityRole="button" hitSlop={8} {...rest} style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}> // ✓ good
~~~

**src/design\-system/components/Chips\.tsx**
~~~tsx
L13: <Pressable accessibilityRole="button" accessibilityState={{ selected }} hitSlop={{ top: 2, bottom: 2 }} onPress={onPress} // ✓ good
L13: <Pressable accessibilityRole="button" accessibilityState={{ selected }} hitSlop={{ top: 2, bottom: 2 }} onPress={onPress} // ✓ good
L62: <View style={styles.segmented} accessibilityRole="tablist"> // ✓ good
L64: <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)} // ✓ good
L64: <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)} // ✓ good
~~~

**src/design\-system/components/Content\.tsx**
~~~tsx
L42: <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.organizer} // ✓ good
L43: accessibilityLabel={`Düzenleyen: ${name}${verified ? ', doğrulanmış kurum' : ''}`}> // ✓ good
L64: <Card padded={false} onPress={onPress} accessibilityLabel={`${model.title}. ${model.dateLabel}, ${model.placeLabel}. ${model.availability?.label ?? ''}`}> // ✓ good
L72: {onToggleSave && <IconButton icon="bookmark" filled={saved} color={saved ? colors.primary : colors.ink} accessibilityLabel={saved ? 'Kaydı kaldır' : 'Kaydet'} onPress={onToggleSave} />} // ✓ good
~~~

**src/design\-system/components/Form\.tsx**
~~~tsx
L22: export const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, help, style, onFocus, onBlur, ...rest }, ref) { // ✓ good
L28: accessibilityLabel={label} // ✓ good
L31: onFocus={(e) => { setFocused(true); onFocus?.(e); }} // ✓ good
L32: onBlur={(e) => { setFocused(false); onBlur?.(e); }} // ✓ good
L47: <TextInput accessibilityLabel={props.placeholder} placeholderTextColor={colors.textSecondary} returnKeyType="search" // ✓ good
L57: <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.toggleRow}> // ✓ good
L57: <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.toggleRow}> // ✓ good
L72: <Pressable accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onChange(true)} style={[styles.radioCard, checked && styles.radioCardChecked]}> // ✓ good
L72: <Pressable accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onChange(true)} style={[styles.radioCard, checked && styles.radioCardChecked]}> // ✓ good
L85: <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space[2] }}> // ✓ good
L85: <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space[2] }}> // ✓ good
~~~

**src/design\-system/components/Overlays\.tsx**
~~~tsx
L18: <Pressable accessibilityLabel="Kapat" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} /> // ✓ good
L22: <IconButton icon="close" accessibilityLabel="Kapat" onPress={onClose} /> // ✓ good
L36: <Pressable accessibilityLabel="Kapat" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} /> // ✓ good
~~~

**src/design\-system/components/Screen\.tsx**
~~~tsx
L54: {onBack && <IconButton icon="back" accessibilityLabel="Geri" onPress={onBack} style={{ marginLeft: -space[2] }} />} // ✓ good
L56: <View style={styles.brand} accessible accessibilityLabel="TechApp"> // ✓ good
~~~

**src/design\-system/components/States\.tsx**
~~~tsx
L27: <View style={styles.center} accessibilityRole="alert"> // ✓ good
L54: <View accessibilityLabel="Yükleniyor" accessibilityRole="progressbar" style={{ gap: space[4] }}> // ✓ good
L54: <View accessibilityLabel="Yükleniyor" accessibilityRole="progressbar" style={{ gap: space[4] }}> // ✓ good
L69: <View style={styles.offline} accessibilityRole="alert"> // ✓ good
~~~

**src/design\-system/components/Surface\.tsx**
~~~tsx
L19: <Pressable accessibilityRole="button" onPress={onPress} {...rest} style={({ pressed }) => [body, pressed && { opacity: 0.85 }]}> // ✓ good
L39: <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta ?? ''}`} onPress={onPress} // ✓ good
L39: <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta ?? ''}`} onPress={onPress} // ✓ good
L43: <Text variant="title" color="white" accessibilityRole="text" style={{ marginTop: space[6], maxWidth: '78%' }}> // ✓ good
L44: {parts[0]}{accent && parts.length > 1 && <Text variant="title" color="lime" accessibilityRole="text">{accent}</Text>}{parts[1]} // ✓ good
L85: <View style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}> // ✓ good
~~~

**src/design\-system/useLayout\.ts**
~~~typescript
L1: import { useWindowDimensions } from 'react-native'; // ✓ good
L11: const { width, height, fontScale } = useWindowDimensions(); // ✓ good
~~~

**src/features/auth/AuthEmailScreen\.tsx**
~~~tsx
L30: <Input label="E-posta" value={email} onChangeText={setEmail} onBlur={() => setTouched(true)} autoCapitalize="none" autoComplete="email" // ✓ good
~~~

**src/features/auth/AuthOtpScreen\.tsx**
~~~tsx
L61: textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus style={{ letterSpacing: 8, fontSize: 22 }} /> // ⚠ concern
~~~

**src/features/auth/StartupUnavailableScreen\.tsx**
~~~tsx
L26: <View style={{ gap: space[3] }} accessibilityRole="alert"> // ✓ good
~~~

**src/features/discovery/DiscoverScreen\.tsx**
~~~tsx
L68: <Screen header={<><AppHeader brand right={<IconButton icon="ticket" accessibilityLabel="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />} />{offline && <OfflineBanner />}</>} // ✓ good
~~~

**src/features/events/MyRegistrationsScreen\.tsx**
~~~tsx
L29: accessibilityLabel={`${item.event.title}, kayıt durumu`}> // ✓ good
~~~

**src/features/events/ParticipationCardScreen\.tsx**
~~~tsx
L36: <View accessible accessibilityRole="image" accessibilityLabel={`Giriş kodu. Kısa kod: ${c.short_code.split('').join(' ')}`} // ✓ good
L36: <View accessible accessibilityRole="image" accessibilityLabel={`Giriş kodu. Kısa kod: ${c.short_code.split('').join(' ')}`} // ✓ good
~~~

**src/features/opportunities/DeadlinesScreen\.tsx**
~~~tsx
L40: <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.title}. ${d.label}.`} onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: o.id })} // ✓ good
L40: <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.title}. ${d.label}.`} onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: o.id })} // ✓ good
~~~

**src/features/opportunities/OpportunityCardView\.tsx**
~~~tsx
L13: <Card onPress={onPress} style={{ gap: space[2], borderRadius: 19 }} accessibilityLabel={`${item.title}. ${type.label}. ${deadline.label}.`}> // ✓ good
L17: {onToggleFollow && <IconButton icon="bookmark" filled={followed} color={followed ? colors.primary : colors.ink} accessibilityLabel={followed ? 'Takipten çıkar' : 'Son tarihi takip et'} onPress={onToggleFollow} />} // ✓ good
~~~

**src/features/opportunities/OpportunityDetailScreen\.tsx**
~~~tsx
L45: <Screen header={<AppHeader onBack={navigation.goBack} title={type.label} right={follow.requiresAuth ? undefined : <IconButton icon="bookmark" filled={follow.ids.has(o.id)} color={follow.ids.has(o.id) ? colors.primary : colors.ink} accessibilityLabel={follow.ids.has(o.id) ? 'Takipten çıkar' : 'Son tarihi takip et'} onPress={() => follow.toggle(o.id)} />} />} // ✓ good
~~~

**src/features/profile/CvShareCard\.tsx**
~~~tsx
L34: <TextButton label="Paylaşımı kapat" color={colors.danger} disabled={sharing.isPending} onPress={() => sharing.mutate(false)} accessibilityHint="Mevcut bağlantı anında geçersiz olur" /> // ✓ good
~~~

**src/features/profile/EditProfileScreen\.tsx**
~~~tsx
L60: <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }} accessibilityLabel="Eklenen beceriler. Kaldırmak için dokun."> // ✓ good
~~~

**src/features/profile/ExperienceDetailScreen\.tsx**
~~~tsx
L77: : <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>{orgs.data.map((o) => <Radio key={o.id} label={o.name} checked={orgId === o.id} onChange={() => setOrgId(o.id)} />)}</View>} // ✓ good
~~~

**src/features/profile/ExperienceEditorScreen\.tsx**
~~~tsx
L70: <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }} accessibilityRole="radiogroup"> // ✓ good
L81: <View style={{ gap: space[2] }} accessibilityRole="radiogroup"> // ✓ good
~~~

**src/features/profile/ProfileScreen\.tsx**
~~~tsx
L30: <Card onPress={onPress} style={{ gap: space[2] }} accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}. Ayrıntıları aç`}> // ✓ good
L83: <Text variant="section" accessibilityRole="header">{profile.display_name ?? 'Adını ekle'}</Text> // ✓ good
L95: <View style={styles.stats} accessible accessibilityLabel={`${experiences.length} deneyim, ${verifiedCount} doğrulanmış, ${participations.length} katılım`}> // ✓ good
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L49: right={perms.canManage ? <IconButton icon="plus" accessibilityLabel="Yeni görev" onPress={() => navigation.navigate('TeamTaskEditor', { teamId })} /> : undefined} />; // ✓ good
L80: ? <TextButton label={label} iconRight="arrow" disabled={advance.isPending} onPress={() => advance.mutate(t)} accessibilityLabel={`${t.title}: ${label}`} /> // ✓ good
L82: {perms.canManage && <TextButton label="Düzenle" color={colors.textSecondary} onPress={() => navigation.navigate('TeamTaskEditor', { teamId, taskId: t.id })} accessibilityLabel={`${t.title}: düzenle`} />} // ✓ good
L104: <Text variant="caption" color="textSecondary" style={{ marginLeft: 'auto' }} accessibilityLabel={`${total} görevin ${doneCount} tanesi tamamlandı${overdueCount ? `, ${overdueCount} görev gecikti` : ''}`}>{doneCount} / {total} tamamlandı{overdueCount > 0 ? ` · ${overdueCount} gecikti` : ''}</Text> // ✓ good
L134: <TextButton label={r.title ? 'Unvanı değiştir' : 'Unvan ver'} onPress={() => { changeTitle.reset(); setTitleDraft(r.title ?? ''); setTitleTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: unvan ata`} /> // ✓ good
L136: <TextButton label="Rolü değiştir" onPress={() => { changeRole.reset(); setRoleDraft(r.role); setRoleTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: rolü değiştir`} /> // ✓ good
L137: <TextButton label="Takımdan çıkar" color={colors.danger} onPress={() => { remove.reset(); setRemoveTarget(r); }} accessibilityLabel={`${r.display_name ?? 'Üye'}: takımdan çıkar`} /> // ✓ good
~~~

**src/features/volunteers/VolunteerHubScreen\.tsx**
~~~tsx
L53: <View style={styles.stats} accessible accessibilityLabel={figures.map(([l, v]) => `${l}: ${v}`).join(', ')}> // ✓ good
~~~

### HIG Reference

*Load reference from skill: hig-foundations*

### Evaluate

- Color usage: system semantic colors vs hardcoded values
- Typography: Dynamic Type text styles vs fixed font sizes
- Accessibility: labels, hints, traits on interactive elements
- Dark mode: proper color adaptation, no hardcoded light/dark values
- Motion: Reduce Motion support for animations

## Category: Input Methods

*49 detections across 18 file(s) — 0 concern(s), 49 positive(s)*

### Code Excerpts

**src/design\-system/components/Form\.tsx**
~~~tsx
L98: return <Input label={label} value={value} onChangeText={(t) => onChangeText(format(t))} keyboardType="number-pad" placeholder="GG.AA.YYYY" maxLength={10} error={error} help={help} />; // ✓ good
L98: return <Input label={label} value={value} onChangeText={(t) => onChangeText(format(t))} keyboardType="number-pad" placeholder="GG.AA.YYYY" maxLength={10} error={error} help={help} />; // ✓ good
~~~

**src/features/auth/AuthEmailScreen\.tsx**
~~~tsx
L31: keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" placeholder="ornek@eposta.com" // ✓ good
~~~

**src/features/auth/AuthOtpScreen\.tsx**
~~~tsx
L61: textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus style={{ letterSpacing: 8, fontSize: 22 }} /> // ✓ good
~~~

**src/features/checkin/CheckInScreen\.tsx**
~~~tsx
L62: <Input label="Kodu elle gir" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="TA1.…" help="Kamera okuyamazsa karttaki tam kodu yapıştırabilirsin." /> // ✓ good
~~~

**src/features/discovery/DiscoverScreen\.tsx**
~~~tsx
L74: <SearchInput placeholder="Etkinlik ara" value={search} onChangeText={(t) => { setSearch(t); if (!t) setSubmitted(''); }} onSubmitEditing={() => setSubmitted(search)} /> // ✓ good
~~~

**src/features/opportunities/OpportunityApplyScreen\.tsx**
~~~tsx
L59: <TextArea label="Neden başvuruyorsun? (isteğe bağlı)" value={motivation} onChangeText={setMotivation} maxLength={2000} help={`${motivation.length} / 2000`} /> // ✓ good
~~~

**src/features/opportunities/labels\.ts**
~~~typescript
L61: export function opportunityIneligibility(o: Pick<OpportunityRow, 'min_age' | 'max_age' | 'guardian_required_under'>, isMinor: boolean | null | undefined): string | null { // ✓ good
L62: if (isMinor === true && ((o.min_age ?? 0) >= 18 || (o.guardian_required_under ?? 0) >= 18)) return 'Bu fırsata şimdilik yalnızca 18 yaş ve üzeri başvurabiliyor.'; // ✓ good
~~~

**src/features/profile/EditProfileScreen\.tsx**
~~~tsx
L50: <Input label="Kısa başlık" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Örn. Robotik takımında yazılımcı" help="Adının altında görünür." /> // ✓ good
L50: <Input label="Kısa başlık" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Örn. Robotik takımında yazılımcı" help="Adının altında görünür." /> // ✓ good
L51: <TextArea label="Hakkında" value={bio} onChangeText={setBio} maxLength={600} placeholder="Nelerle ilgileniyorsun, ne üretmek istiyorsun?" help={`${bio.length} / 600`} /> // ✓ good
L51: <TextArea label="Hakkında" value={bio} onChangeText={setBio} maxLength={600} placeholder="Nelerle ilgileniyorsun, ne üretmek istiyorsun?" help={`${bio.length} / 600`} /> // ✓ good
L52: <Input label="Şehir" value={city} onChangeText={setCity} maxLength={60} autoComplete="off" /> // ✓ good
L57: returnKeyType="done" maxLength={60} placeholder="Örn. Python, CAD, lehimleme" error={skillError} help="Virgülle ayırıp birden fazla ekleyebilirsin. Beceriler kendi beyanın olarak görünür." /> // ✓ good
L57: returnKeyType="done" maxLength={60} placeholder="Örn. Python, CAD, lehimleme" error={skillError} help="Virgülle ayırıp birden fazla ekleyebilirsin. Beceriler kendi beyanın olarak görünür." /> // ✓ good
~~~

**src/features/profile/ExperienceEditorScreen\.tsx**
~~~tsx
L74: <Input label="Başlık" value={title} onChangeText={setTitle} maxLength={140} placeholder="Örn. Çizgi izleyen robot projesi" error={errors.title} /> // ✓ good
L74: <Input label="Başlık" value={title} onChangeText={setTitle} maxLength={140} placeholder="Örn. Çizgi izleyen robot projesi" error={errors.title} /> // ✓ good
L75: <Input label="Senin rolün" value={role} onChangeText={setRole} maxLength={80} placeholder="Örn. Yazılım, takım kaptanı, gönüllü eğitmen" /> // ✓ good
L75: <Input label="Senin rolün" value={role} onChangeText={setRole} maxLength={80} placeholder="Örn. Yazılım, takım kaptanı, gönüllü eğitmen" /> // ✓ good
L76: <TextArea label="Senin katkın" value={contribution} onChangeText={setContribution} maxLength={2000} placeholder="Ne yaptın, ne ortaya çıktı? Takım işiyse kendi payını yaz." help={`${contribution.length} / 2000`} /> // ✓ good
L76: <TextArea label="Senin katkın" value={contribution} onChangeText={setContribution} maxLength={2000} placeholder="Ne yaptın, ne ortaya çıktı? Takım işiyse kendi payını yaz." help={`${contribution.length} / 2000`} /> // ✓ good
L77: <Input label="Kurum / takım / etkinlik" value={org} onChangeText={setOrg} maxLength={120} /> // ✓ good
L80: <Input label="Çıktı bağlantısı (isteğe bağlı)" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://" error={errors.link} help="Repo, video, sunum… Herkese açık bir bağlantı olsun." /> // ✓ good
~~~

**src/features/teams/CreateTeamScreen\.tsx**
~~~tsx
L36: <Input label="Takım adı" value={name} onChangeText={setName} maxLength={80} error={nameError} placeholder="Örn. Nova Robotik" /> // ✓ good
L36: <Input label="Takım adı" value={name} onChangeText={setName} maxLength={80} error={nameError} placeholder="Örn. Nova Robotik" /> // ✓ good
L38: <Input label="Alan (isteğe bağlı)" value={category} onChangeText={setCategory} maxLength={60} placeholder="Robotik, yazılım, sosyal etki…" /> // ✓ good
L38: <Input label="Alan (isteğe bağlı)" value={category} onChangeText={setCategory} maxLength={60} placeholder="Robotik, yazılım, sosyal etki…" /> // ✓ good
L39: <Input label="Kısa tanıtım (isteğe bağlı)" value={tagline} onChangeText={setTagline} maxLength={160} placeholder="Tek cümleyle ne yapıyorsunuz?" /> // ✓ good
L39: <Input label="Kısa tanıtım (isteğe bağlı)" value={tagline} onChangeText={setTagline} maxLength={160} placeholder="Tek cümleyle ne yapıyorsunuz?" /> // ✓ good
~~~

**src/features/teams/TeamDetailScreen\.tsx**
~~~tsx
L74: <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={500} placeholder="Neden katılmak istiyorsun, neye katkı verebilirsin?" /> // ✓ good
L74: <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={500} placeholder="Neden katılmak istiyorsun, neye katkı verebilirsin?" /> // ✓ good
~~~

**src/features/teams/TeamTaskEditorScreen\.tsx**
~~~tsx
L60: <Input label="Görev" value={title} onChangeText={setTitle} maxLength={140} error={errors.title} placeholder="Örn. Şasi çizimini tamamla" /> // ✓ good
L60: <Input label="Görev" value={title} onChangeText={setTitle} maxLength={140} error={errors.title} placeholder="Örn. Şasi çizimini tamamla" /> // ✓ good
L61: <TextArea label="Açıklama (isteğe bağlı)" value={description} onChangeText={setDescription} maxLength={2000} /> // ✓ good
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L171: <Input label="Unvan" value={titleDraft} onChangeText={setTitleDraft} maxLength={60} placeholder="Örn. Mekanik lideri, Yazılım sorumlusu" /> // ✓ good
L171: <Input label="Unvan" value={titleDraft} onChangeText={setTitleDraft} maxLength={60} placeholder="Örn. Mekanik lideri, Yazılım sorumlusu" /> // ✓ good
~~~

**src/features/volunteers/VolunteerSection\.tsx**
~~~tsx
L55: <TextArea label="Düzenleyen ekibe not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={500} placeholder="Hangi işte yardımcı olabilirsin? Örn. kayıt masası, saha yönlendirme." /> // ✓ good
L55: <TextArea label="Düzenleyen ekibe not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={500} placeholder="Hangi işte yardımcı olabilirsin? Örn. kayıt masası, saha yönlendirme." /> // ✓ good
~~~

**src/lib/analytics\.ts**
~~~typescript
L4: | 'registration_started' | 'registration_submitted' | 'guardian_required' | 'registration_confirmed' // ✓ good
~~~

**src/lib/database\.generated\.ts**
~~~typescript
L800: guardian_required_under: number | null // ✓ good
L842: guardian_required_under?: number | null // ✓ good
L884: guardian_required_under?: number | null // ✓ good
L1297: guardian_required_under: number | null // ✓ good
L1328: guardian_required_under?: number | null // ✓ good
L1359: guardian_required_under?: number | null // ✓ good
~~~

**src/lib/database\.types\.ts**
~~~typescript
L48: event_id: z.string(), authenticated: z.boolean(), eligible: z.boolean(), reasons: z.array(z.string()), guardian_required: z.boolean(), // ✓ good
~~~

**src/lib/errors\.ts**
~~~typescript
L14: auth_required: 'Devam etmek için giriş yapman gerekiyor.', // ✓ good
L33: guardian_not_required: 'Bu kayıt için veli onayı gerekmiyor.', // ✓ good
~~~

### HIG Reference

*Load reference from skill: hig-inputs*

### Evaluate

- Text input uses appropriate field types
- Keyboard shortcuts for power users (macOS/iPad)
- Gesture usage follows platform conventions

## Category: Status & Progress

*34 detections across 22 file(s) — 0 concern(s), 0 positive(s)*

### Code Excerpts

**src/design\-system/components/States\.tsx**
~~~tsx
L57: <Skeleton height={148} rounded={0} />
L59: <Skeleton width="30%" height={20} /><Skeleton width="85%" height={20} /><Skeleton width="55%" />
~~~

**src/features/auth/AuthEmailScreen\.tsx**
~~~tsx
L22: footer={<Button label="Kodu gönder" loading={send.isPending} onPress={() => { setTouched(true); if (isValidEmail(email)) send.mutate(email); }} />}
~~~

**src/features/auth/AuthOtpScreen\.tsx**
~~~tsx
L55: footer={<Button label="Doğrula" loading={verify.isPending} disabled={code.length < 6} onPress={() => verify.mutate()} />}>
~~~

**src/features/auth/ProfileBootstrapScreen\.tsx**
~~~tsx
L51: footer={<Button label="Devam et" loading={save.isPending} onPress={submit} />}>
~~~

**src/features/auth/StartupUnavailableScreen\.tsx**
~~~tsx
L32: <Button label="Tekrar Dene" onPress={onRetry} loading={retrying} style={{ marginTop: space[3] }} />
~~~

**src/features/checkin/CheckInScreen\.tsx**
~~~tsx
L63: <Button kind="secondary" label="Kodu doğrula" loading={mutation.isPending} disabled={!manual.trim()} onPress={() => submit(manual)} />
~~~

**src/features/events/EventDetailScreen\.tsx**
~~~tsx
L53: <Button label={full ? 'Bekleme listesine katıl' : 'Etkinliğe katıl'} iconRight="arrow" onPress={join} loading={eligibility.isPending} />
~~~

**src/features/events/EventRegistrationScreen\.tsx**
~~~tsx
L60: footer={<Button label={waitlist ? 'Bekleme listesine katıl' : 'Katılımı tamamla'} loading={submit.isPending}
~~~

**src/features/events/RegistrationStatusScreen\.tsx**
~~~tsx
L84: <Button kind="danger" label="Evet, iptal et" loading={cancel.isPending} onPress={() => cancel.mutate()} />
~~~

**src/features/guardian/GuardianRequestScreen\.tsx**
~~~tsx
L42: <Screen header={<AppHeader onBack={navigation.goBack} title="Veli onayı" />} footer={<Button label="Onay bağlantısını gönder" loading={send.isPending} onPress={submit} />}>
~~~

**src/features/opportunities/MyApplicationsScreen\.tsx**
~~~tsx
L42: <Button kind="danger" label="Evet, geri çek" loading={withdraw.isPending} onPress={() => target && withdraw.mutate(target)} />
~~~

**src/features/opportunities/OpportunityApplyScreen\.tsx**
~~~tsx
L42: footer={<Button label="Başvuruyu gönder" disabled={!!ineligible} loading={submit.isPending} onPress={() => { if (!accepted) { setShowError(true); return; } submit.mutate(); }} />}>
~~~

**src/features/profile/CvShareCard\.tsx**
~~~tsx
L40: <Button kind="secondary" label="Paylaşım bağlantısı oluştur" loading={sharing.isPending} onPress={() => sharing.mutate(true)} />
~~~

**src/features/profile/EditProfileScreen\.tsx**
~~~tsx
L42: <Screen header={<AppHeader onBack={navigation.goBack} title="Profili düzenle" />} footer={<Button label="Kaydet" loading={save.isPending} onPress={submit} />}>
~~~

**src/features/profile/ExperienceDetailScreen\.tsx**
~~~tsx
L68: {item.status === 'published' && <Button kind="secondary" loading={publication.isPending} label={onProfile ? 'Profilimden gizle' : 'Profilimde göster'}
L79: <Button label="İsteği gönder" disabled={!orgId} loading={request.isPending}
L86: <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate(experienceId, { onSuccess: () => { setConfirmDelete(false); toast.show('Deneyim silindi.'); navigation.goBack(); } })} />
~~~

**src/features/profile/ExperienceEditorScreen\.tsx**
~~~tsx
L62: <Screen header={header} footer={<><Button label={showOnProfile ? 'Kaydet ve profilimde göster' : 'Kaydet'} loading={save.isPending && !pending} onPress={() => submit(true)} />
L92: <Button kind="danger" label="Yine de kaydet" loading={save.isPending} onPress={() => pending && run(pending)} />
~~~

**src/features/profile/ProfileScreen\.tsx**
~~~tsx
L166: <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
L173: <Button kind="danger" label="Evet, hesabımı sil" loading={del.isPending} onPress={() => del.mutate()} />
~~~

**src/features/teams/CreateTeamScreen\.tsx**
~~~tsx
L31: <Screen header={<AppHeader onBack={navigation.goBack} title="Takım kur" />} footer={<Button label="Takımı oluştur" loading={create.isPending} onPress={submit} />}>
~~~

**src/features/teams/TeamDetailScreen\.tsx**
~~~tsx
L35: : m?.status === 'pending' ? <Button kind="secondary" label="İsteği geri çek" loading={withdraw.isPending} onPress={() => withdraw.mutate(m.id)} />
L37: : <Button label="Katılma isteği gönder" loading={!!userId && membership.isPending} onPress={openJoin} />;
L76: <Button label="İsteği gönder" loading={join.isPending} onPress={() => join.mutate()} />
~~~

**src/features/teams/TeamTaskEditorScreen\.tsx**
~~~tsx
L56: <Screen header={header} footer={<Button label={taskId ? 'Değişiklikleri kaydet' : 'Görevi ekle'} loading={save.isPending} onPress={submit} />}>
L72: <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate()} />
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L166: <Button label="Rolü kaydet" loading={changeRole.isPending} disabled={roleDraft === roleTarget?.role} onPress={() => roleTarget && changeRole.mutate({ id: roleTarget.membership_id, role: roleDraft })} />
L174: <Button label="Unvanı kaydet" loading={changeTitle.isPending} disabled={titleDraft.trim() === (titleTarget?.title ?? '')} onPress={() => titleTarget && changeTitle.mutate({ id: titleTarget.membership_id, title: titleDraft })} />
L181: <Button kind="danger" label="Evet, takımdan çıkar" loading={remove.isPending} onPress={() => removeTarget && remove.mutate(removeTarget.membership_id)} />
L188: <Button kind="danger" label="Evet, ayrıl" loading={leave.isPending} onPress={() => leave.mutate()} />
~~~

**src/features/volunteers/VolunteerSection\.tsx**
~~~tsx
L58: <Button label="Başvuruyu gönder" loading={apply.isPending} onPress={() => apply.mutate()} />
L65: <Button kind="danger" label="Evet, çekil" loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
~~~

### HIG Reference

*Load reference from skill: hig-components-status*

### Evaluate

- Progress indicators for long operations
- Appropriate use of determinate vs indeterminate progress

## Category: Content Display

*28 detections across 17 file(s) — 0 concern(s), 0 positive(s)*

### Code Excerpts

**src/design\-system/components/Content\.tsx**
~~~tsx
L64: <Card padded={false} onPress={onPress} accessibilityLabel={`${model.title}. ${model.dateLabel}, ${model.placeLabel}. ${model.availability?.label ?? ''}`}>
L84: <Card onPress={onPress} style={{ flex: 1, minHeight: 136, gap: space[2], borderRadius: 19 }}>
L94: <Card onPress={onPress} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start', borderRadius: 19 }}>
L112: <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
~~~

**src/features/checkin/CheckInScreen\.tsx**
~~~tsx
L39: <Card style={{ gap: space[2] }}>
L49: <Card style={{ gap: space[3] }}>
~~~

**src/features/events/EventRegistrationScreen\.tsx**
~~~tsx
L64: <Card style={{ marginTop: space[5], gap: space[2] }}>
~~~

**src/features/events/MyRegistrationsScreen\.tsx**
~~~tsx
L28: <Card onPress={() => navigation.navigate('RegistrationStatus', { registrationId: item.id })} style={{ gap: space[2] }}
~~~

**src/features/events/ParticipationCardScreen\.tsx**
~~~tsx
L26: <Card style={{ marginTop: space[5], padding: space[5] }}>
~~~

**src/features/events/RegistrationStatusScreen\.tsx**
~~~tsx
L63: <Card style={{ marginTop: space[6], gap: space[2] }}>
L71: <Card style={{ marginTop: space[3], gap: space[2] }}>
~~~

**src/features/opportunities/MyApplicationsScreen\.tsx**
~~~tsx
L28: <Card key={a.id} style={{ gap: space[2] }}>
~~~

**src/features/opportunities/OpportunityApplyScreen\.tsx**
~~~tsx
L49: <Card style={{ marginTop: space[3], gap: space[3] }}>
~~~

**src/features/opportunities/OpportunityCardView\.tsx**
~~~tsx
L13: <Card onPress={onPress} style={{ gap: space[2], borderRadius: 19 }} accessibilityLabel={`${item.title}. ${type.label}. ${deadline.label}.`}>
~~~

**src/features/profile/CvShareCard\.tsx**
~~~tsx
L24: <Card style={{ gap: space[3] }}>
~~~

**src/features/profile/EditProfileScreen\.tsx**
~~~tsx
L45: <Card style={{ gap: space[1] }}>
~~~

**src/features/profile/ExperienceDetailScreen\.tsx**
~~~tsx
L50: <Card style={{ marginTop: space[3], gap: space[2] }}>
~~~

**src/features/profile/ProfileScreen\.tsx**
~~~tsx
L30: <Card onPress={onPress} style={{ gap: space[2] }} accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}. Ayrıntıları aç`}>
L129: <Card key={p.event_id} style={{ gap: space[2] }}>
L136: <Card key={`v-${v.event_id}`} style={{ gap: space[2] }}>
L149: <Card key={t.team_id} style={styles.teamRow}>
~~~

**src/features/teams/TeamDetailScreen\.tsx**
~~~tsx
L63: <Card key={p.id} style={{ gap: space[2] }}>
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L68: <Card key={t.id} style={{ gap: space[2] }}>
L125: <Card key={r.membership_id} style={{ gap: space[3] }}>
L151: <Card key={r.membership_id} style={{ gap: space[3] }}>
~~~

**src/features/volunteers/VolunteerHubScreen\.tsx**
~~~tsx
L61: <Card key={a.id} style={[{ gap: space[2] }, a.pinned && { borderColor: colors.primary }]}>
L80: <Card key={t.name} style={{ gap: 2 }}><Text variant="label">{t.name}</Text>{!!t.category && <Text variant="caption" color="textSecondary">{t.category}</Text>}</Card>))}</ResponsiveGrid>
~~~

**src/features/volunteers/VolunteerSection\.tsx**
~~~tsx
L36: <Card style={{ gap: space[3] }}>
~~~

### HIG Reference

*Load reference from skill: hig-components-content*

### Evaluate

- Content display uses appropriate containers
- Image handling with proper async loading

## Category: Layout & Navigation

*24 detections across 5 file(s) — 0 concern(s), 0 positive(s)*

### Code Excerpts

**src/app/App\.tsx**
~~~tsx
L7: import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
L37: return <NavigationContainer key={session.identityEpoch} theme={navTheme} linking={linking}><RootNavigator /></NavigationContainer>;
~~~

**src/design\-system/components/Screen\.tsx**
~~~tsx
L3: import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
L28: <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
L42: </SafeAreaView>
~~~

**src/features/events/EventsListScreen\.tsx**
~~~tsx
L2: import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
L3: import { SafeAreaView } from 'react-native-safe-area-context';
L52: <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
L54: <FlatList
L80: </SafeAreaView>
~~~

**src/features/events/MyRegistrationsScreen\.tsx**
~~~tsx
L2: import { FlatList, RefreshControl, View } from 'react-native';
L3: import { SafeAreaView } from 'react-native-safe-area-context';
L19: <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
L21: <FlatList
L42: </SafeAreaView>
~~~

**src/navigation/RootNavigator\.tsx**
~~~tsx
L2: import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
L3: import { createNativeStackNavigator } from '@react-navigation/native-stack';
L38: const Root = createNativeStackNavigator<RootStackParamList>();
L39: const Tab = createBottomTabNavigator<MainTabParamList>();
L40: const Discover = createNativeStackNavigator<DiscoverStackParamList>();
L41: const Events = createNativeStackNavigator<EventsStackParamList>();
L42: const Opportunities = createNativeStackNavigator<OpportunitiesStackParamList>();
L43: const Community = createNativeStackNavigator<CommunityStackParamList>();
L44: const Profile = createNativeStackNavigator<ProfileStackParamList>();
~~~

### HIG Reference

*Load reference from skill: hig-components-layout*

### Evaluate

- Navigation pattern matches app structure (tabs for flat, sidebar for deep)
- Adaptive layout: responds to size classes, multitasking
- Standard navigation components (NavigationSplitView, not deprecated NavigationView)
- Consistent back navigation and spatial hierarchy

## Category: Dialogs & Presentations

*12 detections across 8 file(s) — 0 concern(s), 0 positive(s)*

### Code Excerpts

**src/features/events/RegistrationStatusScreen\.tsx**
~~~tsx
L81: <Modal visible={confirmCancel} title="Kaydını iptal edelim mi?" onClose={() => setConfirmCancel(false)}>
~~~

**src/features/opportunities/MyApplicationsScreen\.tsx**
~~~tsx
L39: <Modal visible={!!target} title="Başvurunu geri çekelim mi?" onClose={() => setTarget(null)}>
~~~

**src/features/profile/ExperienceDetailScreen\.tsx**
~~~tsx
L83: <Modal visible={confirmDelete} title="Deneyimi silelim mi?" onClose={() => setConfirmDelete(false)}>
~~~

**src/features/profile/ExperienceEditorScreen\.tsx**
~~~tsx
L90: <Modal visible={!!pending} title="Doğrulama geçersiz olacak" onClose={() => setPending(null)}>
~~~

**src/features/profile/ProfileScreen\.tsx**
~~~tsx
L170: <Modal visible={confirmDelete} title="Hesabını silelim mi?" onClose={() => setConfirmDelete(false)}>
~~~

**src/features/teams/TeamTaskEditorScreen\.tsx**
~~~tsx
L69: <Modal visible={confirmDelete} title="Görevi silelim mi?" onClose={() => setConfirmDelete(false)}>
~~~

**src/features/teams/TeamWorkspaceScreen\.tsx**
~~~tsx
L163: <Modal visible={!!roleTarget} title={`${roleTarget?.display_name ?? 'Üye'} için rol`} onClose={() => setRoleTarget(null)}>
L170: <Modal visible={!!titleTarget} title={`${titleTarget?.display_name ?? 'Üye'} için unvan`} onClose={() => setTitleTarget(null)}>
L178: <Modal visible={!!removeTarget} title="Üyeyi çıkaralım mı?" onClose={() => setRemoveTarget(null)}>
L185: <Modal visible={confirmLeave} title="Takımdan ayrılalım mı?" onClose={() => setConfirmLeave(false)}>
~~~

**src/features/volunteers/VolunteerSection\.tsx**
~~~tsx
L54: <Modal visible={open} title="Gönüllü başvurusu" onClose={() => setOpen(false)}>
L62: <Modal visible={confirmWithdraw} title="Gönüllülükten çekilelim mi?" onClose={() => setConfirmWithdraw(false)}>
~~~

### HIG Reference

*Load reference from skill: hig-components-dialogs*

### Evaluate

- Alerts used sparingly for important decisions
- Sheets for focused tasks, popovers for contextual info
- Confirmation dialogs for destructive actions

## Category: Interaction Patterns

*7 detections across 4 file(s) — 0 concern(s), 5 positive(s)*

### Code Excerpts

**src/app/App\.tsx**
~~~tsx
L20: import { AppErrorBoundary } from './AppErrorBoundary'; // ✓ good
L43: <AppErrorBoundary> // ✓ good
L50: </AppErrorBoundary> // ✓ good
~~~

**src/app/AppErrorBoundary\.tsx**
~~~tsx
L12: export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> { // ✓ good
~~~

**src/design\-system/brandMark\.generated\.ts**
~~~typescript
L2: export const brandMarkXml = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\"><rect width=\"1024\" height=\"1024\" rx=\"229\" fill=\"#4B46D6\"/><g transform=\"rotate(-12 512 512)\"><rect x=\"192\" y=\"192\" width=\"640\" height=\"640\" rx=\"164\" fill=\"#D9F36E\"/><g transform=\"translate(9 -6)\" fill=\"#4B46D6\"><path d=\"M322 338h360a18 18 0 0 1 18 18v76a18 18 0 0 1-18 18H560v230a18 18 0 0 1-18 18h-80a18 18 0 0 1-18-18V450H322a18 18 0 0 1-18-18v-76a18 18 0 0 1 18-18z\"/><circle cx=\"662\" cy=\"644\" r=\"54\"/></g></g></svg>"; // ✓ good
~~~

**src/design\-system/components/Overlays\.tsx**
~~~tsx
L61: Animated.timing(opacity, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
L63: Animated.timing(opacity, { toValue: 0, duration: motion.standard, useNativeDriver: true }).start(() => setToast(null));
~~~

### HIG Reference

*Load reference from skill: hig-patterns*

### Evaluate

- Drag and drop support where appropriate
- Pull-to-refresh for refreshable content
- Swipe actions follow HIG conventions
- Undo support for destructive actions

## Scoring Summary

| Category | Score (1-10) | Key Findings |
|----------|-------------|-------------|
| Controls | | |
| Foundations | | |
| Input Methods | | |
| Status & Progress | | |
| Content Display | | |
| Layout & Navigation | | |
| Dialogs & Presentations | | |
| Interaction Patterns | | |
| **Overall** | **/10** | |
