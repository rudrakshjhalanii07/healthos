import Head from 'expo-router/head';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

const UPDATED = '12 November 2026';

export default function Privacy() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Head>
        <title>HealthOS · Privacy & health disclaimer</title>
      </Head>
      <View style={styles.panel}>
        <View style={{ gap: 4 }}>
          <T variant="title" style={{ fontSize: 24 }}>
            Privacy & health disclaimer
          </T>
          <T variant="caption">Last updated {UPDATED}</T>
        </View>

        <View style={styles.callout}>
          <T variant="label" color={Colors.text}>
            HealthOS is not medical advice
          </T>
          <T variant="body">
            HealthOS estimates calorie and macro targets from standard formulas and your own logs. The numbers are
            approximations for healthy adults, not a diagnosis, treatment or a substitute for a doctor or registered
            dietitian. Talk to a professional before changing your diet if you are pregnant or breastfeeding, under 18,
            have diabetes, a heart, kidney or thyroid condition, take medication affected by diet, or have or have had an
            eating disorder. Stop and seek help if dieting makes you feel unwell.
          </T>
          <T variant="body">
            To stay on the safe side, HealthOS won’t plan below 1,200 kcal a day for women or 1,500 for men, won’t plan
            weight loss for anyone already below a healthy BMI (18.5), and caps deficits at 25% of maintenance.
          </T>
        </View>

        <Section title="What we store">
          <Item>Your email address and a securely hashed password. We never see or store your actual password.</Item>
          <Item>
            Your profile and plan: sex, age, height, weight, goal weight, activity level, goal and pace, diet
            preferences and allergies, and plan settings.
          </Item>
          <Item>What you log: food entries, weigh-ins, and the plan HealthOS learns from them.</Item>
          <Item>
            Sign-in sessions, including the IP address and browser they were created from, so you stay signed in and
            sessions can be checked.
          </Item>
        </Section>

        <Section title="How we use it">
          <Item>Only to run HealthOS for you: calculate your plan, sync it across your devices, sign you in, and send password-reset emails you ask for.</Item>
          <Item>We don’t sell your data, show ads, or use analytics or tracking tools.</Item>
        </Section>

        <Section title="Who handles it">
          <Item>Vercel hosts the app and its servers.</Item>
          <Item>Neon stores your account and data in a Postgres database in the US (AWS us-east-1), handles sign-in, and sends password-reset emails.</Item>
          <Item>Google Fonts serves the app’s typefaces, so Google sees your IP address when the fonts load.</Item>
          <Item>Your browser keeps a copy of your data so the app opens instantly and works offline. Signing out removes it.</Item>
        </Section>

        <Section title="Your choices">
          <Item>Correct your details any time under Settings → Edit profile.</Item>
          <Item>Download everything we store about you under Settings → Your data → Download.</Item>
          <Item>
            Delete your account under Settings → Your data → Delete account. Your account and data are erased from our
            database immediately; database recovery history may keep a copy for a short time before it expires.
          </Item>
        </Section>

        <Section title="Security">
          <Item>All traffic uses HTTPS. Sessions live in cookies that page scripts can’t read, and repeated sign-in attempts are rate limited.</Item>
        </Section>

        <Section title="Age">
          <Item>HealthOS is for adults aged 18 and over.</Item>
        </Section>

        <Section title="Changes">
          <Item>If this policy changes, we’ll update the date above.</Item>
        </Section>

        <Button kind="primary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          Back
        </Button>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <T variant="label" color={Colors.text}>
        {title}
      </T>
      {children}
    </View>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <T variant="body">•</T>
      <T variant="body" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { alignItems: 'center', padding: Spacing.three, paddingVertical: Spacing.five },
  panel: {
    width: '100%',
    maxWidth: 640,
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  callout: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentSoft,
  },
});
