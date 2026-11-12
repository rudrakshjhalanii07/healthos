import Head from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Icons, T } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { MIN_PASSWORD } from '@/lib/email';

const noop = () => () => {};
/** False while prerendering and hydrating, true after: the URL's token only exists in the browser. */
const useInBrowser = () => useSyncExternalStore(noop, () => true, () => false);

// The emailed reset link goes to Neon Auth, which sends the user here with `?token=…`,
// or with `?error=INVALID_TOKEN` when the link is bad or expired.
export default function ResetPassword() {
  const { token, error: linkError } = useLocalSearchParams<{ token?: string; error?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const inBrowser = useInBrowser();
  const usable = !!token && !linkError;
  const mismatch = confirmPw.length > 0 && confirmPw !== password;
  const canSubmit = usable && !busy && password.length >= MIN_PASSWORD && confirmPw === password;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { newPassword: password, token } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <Head>
        <title>HealthOS · Reset password</title>
      </Head>
      <View style={styles.panel}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icons.Flame size={18} color={Colors.onAccent} />
          </View>
          <T variant="title">HealthOS</T>
        </View>

        {!inBrowser ? null : done ? (
          <>
            <T variant="title" style={{ fontSize: 22 }}>
              Password updated
            </T>
            <T variant="body">Sign in with your new password.</T>
            <Button kind="primary" onPress={() => router.replace('/login')}>
              Go to sign in
            </Button>
          </>
        ) : !usable ? (
          <>
            <T variant="title" style={{ fontSize: 22 }}>
              Link expired
            </T>
            <T variant="body">This reset link is invalid or has expired. Links last 15 minutes. Request a new one from the sign-in screen.</T>
            <Button kind="primary" onPress={() => router.replace('/login')}>
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <T variant="title" style={{ fontSize: 22 }}>
                Choose a new password
              </T>
              <T variant="body">At least {MIN_PASSWORD} characters.</T>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                autoFocus
                style={styles.input}
                onSubmitEditing={submit}
              />
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                style={styles.input}
                onSubmitEditing={submit}
              />
            </View>
            {mismatch && (
              <T variant="caption" color={Colors.warn}>
                Passwords don’t match.
              </T>
            )}
            {error && (
              <T variant="caption" color={Colors.danger}>
                {error}
              </T>
            )}
            <Button kind="primary" disabled={!canSubmit} onPress={submit}>
              {busy ? 'One moment…' : 'Update password'}
            </Button>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  panel: {
    width: '100%',
    maxWidth: 380,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.two },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 15,
    outlineWidth: 0,
  },
});
