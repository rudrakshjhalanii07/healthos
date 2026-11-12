import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button, Icons, T } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { MIN_PASSWORD, normalizeEmail } from '@/lib/email';
import { useStore } from '@/lib/store';

function lastSeen(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'active today';
  if (days === 1) return 'active yesterday';
  return `active ${days} days ago`;
}

type Mode = 'signIn' | 'signUp' | 'forgot';

const COPY: Record<Mode, { title: string; body: string; submit: string }> = {
  signIn: { title: 'Welcome back', body: 'Sign in to open your plan on this device.', submit: 'Sign in' },
  signUp: {
    title: 'Create your account',
    body: `Use an email you can reach, so you can reset your password. At least ${MIN_PASSWORD} characters.`,
    submit: 'Create account',
  },
  forgot: { title: 'Reset your password', body: 'We’ll email you a link to choose a new password.', submit: 'Send reset link' },
};

export default function Login() {
  const { ready, users, signIn, signUp, forgetUser } = useStore();
  const [mode, setMode] = useState<Mode>('signIn');
  const [emailText, setEmailText] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!ready) return <View style={styles.screen} />;

  const email = normalizeEmail(emailText);
  const mismatch = mode === 'signUp' && confirmPw.length > 0 && confirmPw !== password;
  const canSubmit =
    !!email &&
    !busy &&
    (mode === 'forgot' ||
      (mode === 'signIn' ? password.length > 0 : password.length >= MIN_PASSWORD && confirmPw === password));

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirmPw('');
  };

  const submit = async () => {
    if (!email || !canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else if (mode === 'signUp') await signUp(email, password);
      else {
        await api('/api/auth/request-password-reset', {
          method: 'POST',
          body: { email, redirectTo: `${window.location.origin}/reset-password` },
        });
        // The same answer whether or not the account exists, so this can't be used to probe emails.
        setNotice(`If ${email} has an account, a reset link is on its way. It expires in 15 minutes.`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <Head>
        <title>HealthOS · Sign in</title>
      </Head>
      <View style={styles.themeCorner}>
        <ThemeToggle />
      </View>
      <View style={styles.panel}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icons.Flame size={18} color={Colors.onAccent} />
          </View>
          <T variant="title">HealthOS</T>
        </View>

        <View style={{ gap: 4 }}>
          <T variant="title" style={{ fontSize: 22 }}>
            {copy.title}
          </T>
          <T variant="body">{copy.body}</T>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            value={emailText}
            onChangeText={setEmailText}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            autoFocus
            style={styles.input}
            onSubmitEditing={submit}
          />
        </View>

        {mode !== 'forgot' && (
          <View style={styles.inputWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              style={styles.input}
              onSubmitEditing={submit}
            />
          </View>
        )}
        {mode === 'signUp' && (
          <View style={styles.inputWrap}>
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Confirm password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              style={styles.input}
              onSubmitEditing={submit}
            />
          </View>
        )}

        {emailText.trim().length > 3 && !email && (
          <T variant="caption" color={Colors.warn}>
            Enter a full email address.
          </T>
        )}
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
        {notice && (
          <T variant="caption" color={Colors.accent}>
            {notice}
          </T>
        )}

        <Button kind="primary" disabled={!canSubmit} onPress={submit}>
          {busy ? 'One moment…' : copy.submit}
        </Button>

        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <LinkText onPress={() => switchTo('signUp')}>Create an account</LinkText>
              <LinkText onPress={() => switchTo('forgot')}>Forgot password?</LinkText>
            </>
          ) : (
            <LinkText onPress={() => switchTo('signIn')}>Back to sign in</LinkText>
          )}
        </View>

        {mode === 'signIn' && users.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <T variant="caption" style={styles.sectionLabel}>
              ON THIS DEVICE
            </T>
            {users.map((u) => (
              <View key={u.email} style={styles.user}>
                <Pressable onPress={() => setEmailText(u.email)} style={styles.userMain}>
                  <Avatar name={u.email} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T variant="label" color={Colors.text} numberOfLines={1}>
                      {u.email}
                    </T>
                    <T variant="caption">{lastSeen(u.lastActiveAt)}</T>
                  </View>
                </Pressable>
                <Pressable onPress={() => forgetUser(u.email)} hitSlop={8} accessibilityLabel={`Remove ${u.email} from this device`}>
                  <T variant="caption" color={Colors.textMuted}>
                    Remove
                  </T>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
      <Pressable onPress={() => router.push('/privacy')} hitSlop={6} style={styles.footer}>
        <T variant="caption" style={{ textAlign: 'center' }}>
          Not medical advice. For healthy adults 18+. <T variant="caption" color={Colors.accent}>Privacy & disclaimer</T>
        </T>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function LinkText({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <T variant="caption" color={Colors.accent}>
        {children}
      </T>
    </Pressable>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <T variant="label" color={Colors.accent} style={{ fontSize: size * 0.42, fontWeight: '600' }}>
        {name.charAt(0).toUpperCase()}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  themeCorner: { position: 'absolute', top: Spacing.three, right: Spacing.three },
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
    gap: 6,
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
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { marginTop: Spacing.three, maxWidth: 380 },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5, marginTop: Spacing.two },
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  userMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minWidth: 0 },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
});
