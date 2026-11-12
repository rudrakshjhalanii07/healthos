import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { StoreProvider, useStore } from '@/lib/store';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <StoreProvider>
        <RootNavigator />
      </StoreProvider>
    </ThemeModeProvider>
  );
}

function RootNavigator() {
  const { ready, email, data } = useStore();
  const { resolved } = useThemeMode();
  if (ready) SplashScreen.hide();

  const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: Colors.bg, card: Colors.bg, primary: Colors.accent, text: Colors.text, border: Colors.border },
  };

  // Until storage has loaded, leave every route open so nothing redirects prematurely;
  // screens render blank while `ready` is false.
  const signedIn = !ready || !!email;
  const onboarded = !ready || (!!email && !!data.profile);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        {/* Order matters: when a guard flips, the first available screen wins. */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!ready || !email}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        {/* Reached from an emailed link, signed in or not. */}
        <Stack.Screen name="reset-password" />
      </Stack>
    </ThemeProvider>
  );
}
