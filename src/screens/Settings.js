import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { C, CHROME_SPACE, R, T } from '../theme';
import { LANGS, useI18n } from '../i18n';
import { useLibrary } from '../library';
import { useCloud } from '../cloud';
import { Chip, Glass, GradButton, Press } from '../components/ui';

const ERRORS = ['bad_username', 'bad_password', 'username_taken', 'bad_login', 'network'];

function Account() {
  const { t } = useI18n();
  const cloud = useCloud();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!cloud.enabled) {
    return (
      <Glass style={st.card}>
        <Text style={[T.sub, { lineHeight: 19 }]}>{t('accountSetup')}</Text>
      </Glass>
    );
  }

  if (cloud.user) {
    const state = cloud.status === 'syncing' ? t('syncing') : cloud.status === 'error' ? t('syncError') : t('synced');
    return (
      <Glass style={st.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={st.avatar}>
            <Text style={[T.title, { color: '#fff' }]}>{cloud.user.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={T.head} numberOfLines={1}>@{cloud.user}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              {cloud.status === 'syncing' ? <ActivityIndicator size="small" color={C.cyan} style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} /> : <Ionicons name={cloud.status === 'error' ? 'alert-circle' : 'checkmark-circle'} size={14} color={cloud.status === 'error' ? C.danger : C.cyan} style={{ marginRight: 5 }} />}
              <Text style={T.sub}>{state}</Text>
            </View>
          </View>
        </View>
        <Text style={[T.sub, { marginTop: 14, lineHeight: 19 }]}>{t('accountHint')}</Text>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <GradButton ghost icon="sync" label={t('syncNow')} style={{ flex: 1, marginRight: 10 }} onPress={cloud.sync} />
          <GradButton ghost icon="log-out-outline" label={t('signOut')} style={{ flex: 1 }} onPress={cloud.signOut} />
        </View>
        <Press
          haptic
          style={{ alignSelf: 'center', marginTop: 16, padding: 6 }}
          onPress={() =>
            Alert.alert(t('deleteAccount'), t('deleteAccountAsk'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('deleteAccount'), style: 'destructive', onPress: () => cloud.deleteAccount().catch(() => Alert.alert(t('err_network'))) },
            ])
          }
        >
          <Text style={[T.sub, { color: C.danger, fontWeight: '600' }]}>{t('deleteAccount')}</Text>
        </Press>
      </Glass>
    );
  }

  const go = async (kind) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await (kind === 'up' ? cloud.signUp(username.trim(), password) : cloud.signIn(username.trim(), password));
      setPassword('');
    } catch (e) {
      setError(t(ERRORS.includes(e.message) ? 'err_' + e.message : 'err_other'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass style={st.card}>
      <Text style={[T.sub, { lineHeight: 19 }]}>{t('accountHint')}</Text>
      <TextInput value={username} onChangeText={setUsername} placeholder={t('username')} placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} selectionColor={C.cyan} style={st.input} accessibilityLabel={t('username')} />
      <TextInput value={password} onChangeText={setPassword} placeholder={t('password')} placeholderTextColor={C.faint} secureTextEntry autoCapitalize="none" selectionColor={C.cyan} style={st.input} accessibilityLabel={t('password')} />
      {error ? <Text style={[T.sub, { color: C.danger, marginTop: 10 }]}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 16, opacity: busy ? 0.5 : 1 }}>
        <GradButton label={t('signIn')} style={{ flex: 1, marginRight: 10 }} onPress={() => go('in')} />
        <GradButton ghost label={t('signUp')} style={{ flex: 1 }} onPress={() => go('up')} />
      </View>
    </Glass>
  );
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { t, pref, setLang } = useI18n();
  const lib = useLibrary();
  const version = (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0';

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: CHROME_SPACE + insets.bottom, paddingHorizontal: 20 }}>
      <Text style={T.large}>{t('settings')}</Text>

      <Text style={st.label}>{t('account')}</Text>
      <Account />

      <Text style={st.label}>{t('language')}</Text>
      <View style={st.wrap}>
        {LANGS.map((l) => (
          <View key={l.key} style={{ marginBottom: 8 }}>
            <Chip label={l.label || t('auto')} active={pref === l.key} onPress={() => setLang(l.key)} />
          </View>
        ))}
      </View>

      <Text style={st.label}>{t('storage')}</Text>
      <Glass style={st.card}>
        <Text style={T.head}>{t('downloadsCount', { n: lib.downloads.length })}</Text>
        {lib.downloads.length ? (
          <GradButton
            ghost
            icon="trash-outline"
            label={t('clearDownloads')}
            style={{ marginTop: 14 }}
            onPress={() =>
              Alert.alert(t('clearDownloads'), t('downloadsCount', { n: lib.downloads.length }), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('clearDownloads'), style: 'destructive', onPress: lib.clearDownloads },
              ])
            }
          />
        ) : null}
      </Glass>

      <Text style={st.label}>{t('about')}</Text>
      <Glass style={[st.card, { flexDirection: 'row', alignItems: 'center' }]}>
        <Image source={require('../../assets/icon.png')} style={{ width: 64, height: 64, borderRadius: 16 }} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={T.head}>LS music</Text>
          <Text style={[T.sub, { marginTop: 4, lineHeight: 18 }]}>{t('aboutBody')}</Text>
          <Text style={[T.cap, T.num, { marginTop: 6 }]}>v{version}</Text>
        </View>
      </Glass>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  label: { ...T.sub, color: C.faint, fontWeight: '600', marginTop: 30, marginBottom: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { padding: 18, borderRadius: R.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.violet },
  input: { height: 50, borderRadius: R.md, paddingHorizontal: 16, marginTop: 12, color: C.text, fontSize: 16, fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
});
