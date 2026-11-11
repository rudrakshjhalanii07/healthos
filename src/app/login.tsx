import Head from 'expo-router/head';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button, Icons, T } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { normalizeUsername, useStore } from '@/lib/store';

const MIN_PASSWORD = 8;

function lastSeen(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'active today';
  if (days === 1) return 'active yesterday';
  return `active ${days} days ago`;
}

type Pending = { username: string; exists: boolean };

export default function Login() {
  const { ready, users, signIn, signUp, forgetUser } = useStore();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);

  if (!ready) return <View style={styles.screen} />;

  const name = normalizeUsername(text);
  const recent = pending ? users.find((u) => u.username === pending.username) : undefined;
  const mismatch = !!pending && !pending.exists && confirmPw.length > 0 && confirmPw !== password;
  const canSubmit =
    !!pending && !busy && (pending.exists ? password.length > 0 : password.length >= MIN_PASSWORD && confirmPw === password);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (username: string) =>
    run(async () => {
      const { exists } = await api<{ exists: boolean }>(`/api/auth/exists?username=${encodeURIComponent(username)}`);
      setPending({ username, exists });
      setPassword('');
      setConfirmPw('');
    });

  const submit = () => {
    if (!pending || !canSubmit) return;
    run(() => (pending.exists ? signIn(pending.username, password) : signUp(pending.username, password)));
  };

  const back = () => {
    setPending(null);
    setError(null);
    setConfirmForget(false);
  };

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

        {!pending ? (
          <>
            <View style={{ gap: 4 }}>
              <T variant="title" style={{ fontSize: 22 }}>
                Who’s planning?
              </T>
              <T variant="body">Sign in or pick a username for a new account. Your plan syncs across your devices.</T>
            </View>

            <View style={styles.inputWrap}>
              <T variant="mono" color={Colors.textMuted} style={{ fontSize: 15 }}>
                @
              </T>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                autoFocus
                style={styles.input}
                onSubmitEditing={() => name && choose(name)}
              />
            </View>
            {text.trim().length > 0 && !name && (
              <T variant="caption" color={Colors.warn}>
                2–24 characters: letters, numbers, dot, dash or underscore.
              </T>
            )}
            {error && (
              <T variant="caption" color={Colors.danger}>
                {error}
              </T>
            )}
            <Button kind="primary" disabled={!name || busy} onPress={() => name && choose(name)}>
              Continue
            </Button>

            {users.length > 0 && (
              <View style={{ gap: Spacing.two }}>
                <T variant="caption" style={styles.sectionLabel}>
                  ON THIS DEVICE
                </T>
                {users.map((u) => (
                  <Pressable
                    key={u.username}
                    onPress={() => choose(u.username)}
                    style={(s) => [styles.user, (s as { hovered?: boolean }).hovered && { backgroundColor: Colors.surfaceHover }]}>
                    <Avatar name={u.username} />
                    <View style={{ flex: 1 }}>
                      <T variant="label" color={Colors.text}>
                        @{u.username}
                      </T>
                      <T variant="caption">{lastSeen(u.lastActiveAt)}</T>
                    </View>
                    <Icons.ChevronRight size={16} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.confirm}>
              <Avatar name={pending.username} size={52} />
              <View style={{ alignItems: 'center', gap: 4 }}>
                <T variant="title" style={{ fontSize: 20 }}>
                  {pending.exists ? `Welcome back, @${pending.username}` : `Create @${pending.username}`}
                </T>
                <T variant="body" style={{ textAlign: 'center' }}>
                  {pending.exists
                    ? 'Enter your password to open your plan.'
                    : `Choose a password (at least ${MIN_PASSWORD} characters). You’ll use it to sign in on any device.`}
                </T>
              </View>
            </View>

            <View style={styles.inputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={pending.exists ? 'current-password' : 'new-password'}
                autoFocus
                style={styles.input}
                onSubmitEditing={submit}
              />
            </View>
            {!pending.exists && (
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
              {busy ? 'One moment…' : pending.exists ? 'Sign in' : 'Create account'}
            </Button>
            <Button kind="ghost" onPress={back}>
              {pending.exists ? 'Not you? Use another name' : 'Use a different name'}
            </Button>
            {recent && (
              <Pressable
                onPress={async () => {
                  if (!confirmForget) return setConfirmForget(true);
                  await forgetUser(pending.username);
                  back();
                }}
                style={{ alignSelf: 'center', padding: 6 }}>
                <T variant="caption" color={confirmForget ? Colors.danger : Colors.textMuted}>
                  {confirmForget ? 'Tap again to remove it from this device' : 'Remove from this device'}
                </T>
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
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
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  confirm: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
});
