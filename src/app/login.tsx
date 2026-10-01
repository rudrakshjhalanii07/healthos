import Head from 'expo-router/head';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button, Icons, T } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { normalizeUsername, type UserMeta, useStore } from '@/lib/store';

function lastSeen(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'active today';
  if (days === 1) return 'active yesterday';
  return `active ${days} days ago`;
}

export default function Login() {
  const { ready, users, signIn, forgetUser } = useStore();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  if (!ready) return <View style={styles.screen} />;

  const name = normalizeUsername(text);
  const existing: UserMeta | undefined = pending ? users.find((u) => u.username === pending) : undefined;

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await signIn(pending);
    } finally {
      setBusy(false);
    }
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
              <T variant="body">Pick a username. Your plan stays on this device — nothing is uploaded.</T>
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
                autoFocus
                style={styles.input}
                onSubmitEditing={() => name && setPending(name)}
              />
            </View>
            {text.trim().length > 0 && !name && (
              <T variant="caption" color={Colors.warn}>
                2–24 characters: letters, numbers, dot, dash or underscore.
              </T>
            )}
            <Button kind="primary" disabled={!name} onPress={() => name && setPending(name)}>
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
                    onPress={() => setPending(u.username)}
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
              <Avatar name={pending} size={52} />
              <View style={{ alignItems: 'center', gap: 4 }}>
                <T variant="title" style={{ fontSize: 20 }}>
                  {existing ? `Welcome back, @${pending}` : `Create @${pending}?`}
                </T>
                <T variant="body" style={{ textAlign: 'center' }}>
                  {existing
                    ? `Continue with the plan saved on this device (${lastSeen(existing.lastActiveAt)}).`
                    : 'A new profile will be set up on this device. There’s no password — anyone using this device can open it.'}
                </T>
              </View>
            </View>
            <Button kind="primary" disabled={busy} onPress={confirm}>
              {existing ? `Continue as @${pending}` : 'Create profile'}
            </Button>
            <Button
              kind="ghost"
              onPress={() => {
                setPending(null);
                setConfirmForget(false);
              }}>
              {existing ? 'Not you? Use another name' : 'Use a different name'}
            </Button>
            {existing && (
              <Pressable
                onPress={async () => {
                  if (!confirmForget) return setConfirmForget(true);
                  await forgetUser(pending);
                  setPending(null);
                  setConfirmForget(false);
                }}
                style={{ alignSelf: 'center', padding: 6 }}>
                <T variant="caption" color={confirmForget ? Colors.danger : Colors.textMuted}>
                  {confirmForget ? 'Tap again to delete this profile and its data' : 'Remove this profile from the device'}
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
