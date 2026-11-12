import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chips, Choice, Field, NumberField, SingleChips } from '@/components/form';
import { Button, IconButton, Icons, ProgressBar, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CALIBRATION_DAYS } from '@/lib/learn';
import {
  type Allergy,
  cmToFtIn,
  DEFAULT_PREFS,
  bmiOf,
  DEFAULT_PROFILE,
  energyPlan,
  formulaMaintenance,
  ftInToCm,
  type GlutenAlt,
  kgToLb,
  lbToKg,
  MIN_AGE,
  MIN_BMI,
  minHealthyKg,
  type MilkAlt,
  type Prefs,
  type Profile,
} from '@/lib/profile';
import { useStore } from '@/lib/store';

const STEPS = ['You', 'Goal', 'Food', 'How it works'] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function milkAltAllowed(a: MilkAlt, p: Prefs) {
  if (a === 'lactose-free') return p.diet !== 'vegan' && p.dairy;
  if (a === 'soy') return !p.allergies.includes('soy');
  if (a === 'almond') return !p.allergies.includes('nuts');
  if (a === 'oat') return !p.allergies.includes('gluten');
  return true;
}

/** Drops answers that no longer apply after allergies or diet changed. */
function sanitize(prefs: Prefs): Prefs {
  const noDairy = prefs.diet === 'vegan' || !prefs.dairy;
  const lactose = prefs.allergies.includes('lactose');
  let supplement = prefs.supplement;
  if (supplement === 'whey' && (noDairy || lactose)) supplement = 'none';
  if (supplement === 'isolate' && noDairy) supplement = 'none';
  return {
    ...prefs,
    dairy: prefs.diet === 'vegan' ? false : prefs.dairy,
    avoidMeats: prefs.diet === 'omnivore' ? prefs.avoidMeats : [],
    milkAlts: noDairy || lactose ? prefs.milkAlts.filter((a) => milkAltAllowed(a, prefs)) : [],
    glutenAlts: prefs.allergies.includes('gluten') ? prefs.glutenAlts : [],
    supplement,
  };
}

export default function Onboarding() {
  const { ready, data, email, saveProfile } = useStore();
  const editing = !!data.profile;
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(data.profile ?? DEFAULT_PROFILE);
  const [prefs, setPrefs] = useState<Prefs>(data.prefs ?? DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  // Navigate only after the store reflects the new profile, so the index guard is open.
  useEffect(() => {
    if (saved && data.profile) router.replace('/');
  }, [saved, data.profile]);

  if (!ready) return <View style={styles.screen} />;

  const setP = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const setF = (patch: Partial<Prefs>) => setPrefs((p) => sanitize({ ...p, ...patch }));
  const bodyValid =
    profile.age >= MIN_AGE &&
    profile.age <= 90 &&
    profile.heightCm >= 120 &&
    profile.heightCm <= 230 &&
    profile.weightKg >= 35 &&
    profile.weightKg <= 250 &&
    (profile.knownMaintenance == null || (profile.knownMaintenance >= 1000 && profile.knownMaintenance <= 6000));
  const goalValid = profile.goal === 'maintain' || (profile.ratePerWeekKg > 0 && !goalProblem(profile));
  const valid = [bodyValid, goalValid, true, true][step];
  // Editing skips the explainer — they've seen it.
  const last = editing ? 2 : STEPS.length - 1;

  const finish = () => {
    saveProfile(profile, sanitize(prefs));
    setSaved(true);
  };

  return (
    <View style={styles.screen}>
      <Head>
        <title>HealthOS · {editing ? 'Edit profile' : 'Set up'}</title>
      </Head>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <T variant="caption">
                {email} · {STEPS[step]}
              </T>
              {editing && (
                <IconButton label="Cancel editing" onPress={() => router.replace('/')}>
                  <Icons.X size={16} />
                </IconButton>
              )}
            </View>
            <ProgressBar value={(step + 1) / (last + 1)} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              {step === 0 && <YouStep profile={profile} set={setP} />}
              {step === 1 && <GoalStep profile={profile} set={setP} />}
              {step === 2 && <FoodStep prefs={prefs} set={setF} />}
              {step === 3 && <HowStep profile={profile} />}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerInner}>
              <Button kind="ghost" disabled={step === 0} onPress={() => setStep((s) => s - 1)}>
                Back
              </Button>
              {step < last ? (
                <Button kind="primary" disabled={!valid} onPress={() => setStep((s) => s + 1)}>
                  Continue
                </Button>
              ) : (
                <Button kind="primary" onPress={finish} icon={<Icons.Check size={15} color={Colors.onAccent} />}>
                  {editing ? 'Save' : 'Start logging'}
                </Button>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: 6, marginBottom: Spacing.two }}>
      <T variant="title" style={{ fontSize: 24, letterSpacing: -0.6 }}>
        {title}
      </T>
      <T variant="body">{subtitle}</T>
    </View>
  );
}

type ProfileStepProps = { profile: Profile; set: (patch: Partial<Profile>) => void };

function YouStep({ profile, set }: ProfileStepProps) {
  const imperial = profile.units === 'imperial';
  const ftIn = cmToFtIn(profile.heightCm);
  const weight = (kg: number | null) => (kg == null ? null : Math.round((imperial ? kgToLb(kg) : kg) * 10) / 10);
  const toKg = (v: number | null) => (v == null ? null : imperial ? lbToKg(v) : v);

  return (
    <>
      <StepHeader title="About you" subtitle="Just enough for a starting estimate. Your own logs refine it from here." />
      <View style={styles.row}>
        <Field label="Sex" style={styles.fill}>
          <SingleChips
            value={profile.sex}
            onChange={(sex) => set({ sex })}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
          />
        </Field>
        <Field label="Units" style={styles.fill}>
          <SingleChips
            value={profile.units}
            onChange={(units) => set({ units })}
            options={[
              { value: 'metric', label: 'cm · kg' },
              { value: 'imperial', label: 'ft · lb' },
            ]}
          />
        </Field>
      </View>
      <View style={styles.row} key={profile.units}>
        <Field label="Age" style={styles.fill}>
          <NumberField value={profile.age} onChange={(v) => set({ age: v ?? 0 })} suffix="yrs" />
          {profile.age > 0 && profile.age < MIN_AGE && (
            <T variant="caption" color={Colors.warn}>
              HealthOS is for adults ({MIN_AGE}+). Calorie targets for teens should come from a doctor.
            </T>
          )}
        </Field>
        <Field label="Height" style={[styles.fill, { flexGrow: 1.4 }]}>
          {imperial ? (
            <View style={styles.row}>
              <NumberField style={styles.fill} value={ftIn.ft} onChange={(v) => set({ heightCm: ftInToCm(v ?? 0, ftIn.in) })} suffix="ft" />
              <NumberField style={styles.fill} value={ftIn.in} onChange={(v) => set({ heightCm: ftInToCm(ftIn.ft, v ?? 0) })} suffix="in" />
            </View>
          ) : (
            <NumberField value={Math.round(profile.heightCm)} onChange={(v) => set({ heightCm: v ?? 0 })} suffix="cm" />
          )}
        </Field>
        <Field label="Weight" style={styles.fill}>
          <NumberField decimals value={weight(profile.weightKg)} onChange={(v) => set({ weightKg: toKg(v) ?? 0 })} suffix={imperial ? 'lb' : 'kg'} />
        </Field>
      </View>
      <Field label="Activity, all in">
        <Choice
          value={profile.activity}
          onChange={(activity) => set({ activity })}
          options={[
            { value: 'sedentary', label: 'Sedentary', hint: 'Desk job, little training' },
            { value: 'light', label: 'Light', hint: 'Training 1–3×/week' },
            { value: 'moderate', label: 'Moderate', hint: 'Training 3–5×/week' },
            { value: 'very', label: 'Very active', hint: 'Hard training 6–7×/week' },
            { value: 'athlete', label: 'Athlete', hint: 'Twice-a-day or physical job + training' },
          ]}
        />
      </Field>
      <Field
        label="Know your maintenance?"
        hint={`Optional. If you’ve tracked before and know what keeps your weight stable, it beats the formula (≈ ${fmt(formulaMaintenance(profile))} kcal).`}>
        <NumberField value={profile.knownMaintenance} onChange={(v) => set({ knownMaintenance: v || null })} suffix="kcal / day" placeholder="—" />
      </Field>
    </>
  );
}

/** Why a weight-loss goal can't be planned, or null if it can. */
function goalProblem(p: Profile): string | null {
  if (p.goal !== 'lose') return null;
  if (bmiOf(p.weightKg, p.heightCm) < MIN_BMI) {
    return 'Your current weight is already below a healthy BMI, so HealthOS won’t plan weight loss. Choose Maintain or Bulk, and consider talking to a doctor.';
  }
  if (p.targetWeightKg != null && p.targetWeightKg < minHealthyKg(p.heightCm)) {
    const min = p.units === 'imperial' ? `${Math.ceil(kgToLb(minHealthyKg(p.heightCm)))} lb` : `${minHealthyKg(p.heightCm)} kg`;
    return `That goal weight is below a healthy BMI for your height. The lowest goal HealthOS will plan for is ${min}.`;
  }
  return null;
}

const RATES = {
  lose: [
    { value: '0.25', label: '0.25 kg / wk', hint: 'Gentle' },
    { value: '0.5', label: '0.5 kg / wk', hint: 'Steady' },
    { value: '0.75', label: '0.75 kg / wk', hint: 'Aggressive' },
    { value: '1', label: '1 kg / wk', hint: 'Maximum' },
  ],
  gain: [
    { value: '0.1', label: '0.1 kg / wk', hint: 'Lean' },
    { value: '0.25', label: '0.25 kg / wk', hint: 'Steady' },
    { value: '0.5', label: '0.5 kg / wk', hint: 'Fast' },
  ],
};

function GoalStep({ profile, set }: ProfileStepProps) {
  const e = energyPlan(profile);
  const imperial = profile.units === 'imperial';
  return (
    <>
      <StepHeader title="Goal" subtitle="Sets the direction. The exact numbers get tuned to your real data." />
      <Choice
        value={profile.goal}
        columns={3}
        onChange={(goal) => set({ goal, ratePerWeekKg: goal === 'lose' ? 0.5 : goal === 'gain' ? 0.25 : 0 })}
        options={[
          { value: 'lose', label: 'Cut', hint: 'Lose fat' },
          { value: 'maintain', label: 'Maintain', hint: 'Hold steady' },
          { value: 'gain', label: 'Bulk', hint: 'Build muscle' },
        ]}
      />
      {profile.goal !== 'maintain' && (
        <>
          <Field label="Pace">
            <SingleChips
              value={String(profile.ratePerWeekKg)}
              onChange={(v) => set({ ratePerWeekKg: Number(v) })}
              options={RATES[profile.goal].map((r) => ({ value: r.value, label: `${r.label} · ${r.hint}` }))}
            />
          </Field>
          <Field label="Goal weight" hint="Optional — used for an ETA.">
            <NumberField
              key={profile.units}
              decimals
              value={profile.targetWeightKg == null ? null : Math.round((imperial ? kgToLb(profile.targetWeightKg) : profile.targetWeightKg) * 10) / 10}
              onChange={(v) => set({ targetWeightKg: v == null ? null : imperial ? lbToKg(v) : v })}
              suffix={imperial ? 'lb' : 'kg'}
              placeholder="—"
            />
          </Field>
        </>
      )}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <T variant="caption">Maintenance ({e.source === 'stated' ? 'yours' : 'estimated'})</T>
          <T variant="mono" color={Colors.textDim}>
            {fmt(e.maintenance)} kcal
          </T>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <T variant="label" color={Colors.text}>
            Starting target
          </T>
          <T variant="mono" color={Colors.accent}>
            {fmt(e.target)} kcal/day · {fmt(e.weekly)}/week
          </T>
        </View>
        {e.weeksToTarget && <T variant="caption">≈ {e.weeksToTarget} weeks to goal weight at this pace.</T>}
        {e.limitedBy === 'cap' && (
          <T variant="caption" color={Colors.warn}>
            Capped at a {profile.goal === 'lose' ? '25% deficit' : '20% surplus'} ({e.effectiveRate.toFixed(2)} kg/week).
          </T>
        )}
        {e.limitedBy === 'floor' && (
          <T variant="caption" color={Colors.warn}>
            Held at {fmt(e.target)} kcal/day — lower isn’t recommended.
          </T>
        )}
      </View>
      {goalProblem(profile) && (
        <T variant="caption" color={Colors.warn}>
          {goalProblem(profile)}
        </T>
      )}
    </>
  );
}

const ALLERGIES: { value: Allergy; label: string }[] = [
  { value: 'lactose', label: 'Lactose' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Tree nuts' },
  { value: 'peanut', label: 'Peanuts' },
  { value: 'soy', label: 'Soy' },
  { value: 'egg', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
];

const MILK_ALTS: { value: MilkAlt; label: string }[] = [
  { value: 'lactose-free', label: 'Lactose-free milk & curd' },
  { value: 'soy', label: 'Soy milk / yogurt' },
  { value: 'oat', label: 'Oat milk' },
  { value: 'almond', label: 'Almond milk' },
  { value: 'coconut', label: 'Coconut yogurt' },
];

const GLUTEN_ALTS: { value: GlutenAlt; label: string }[] = [
  { value: 'millet', label: 'Jowar / bajra / ragi rotis' },
  { value: 'rice', label: 'Rice, dosa & rice noodles' },
  { value: 'gf-products', label: 'Gluten-free bread & pasta' },
];

function FoodStep({ prefs, set }: { prefs: Prefs; set: (patch: Partial<Prefs>) => void }) {
  const noDairy = prefs.diet === 'vegan' || !prefs.dairy;
  const lactose = prefs.allergies.includes('lactose');
  const supplements = [
    ...(!noDairy && !lactose ? [{ value: 'whey' as const, label: 'Whey' }] : []),
    ...(!noDairy ? [{ value: 'isolate' as const, label: lactose ? 'Whey isolate (near lactose-free)' : 'Whey isolate' }] : []),
    { value: 'plant' as const, label: 'Plant protein' },
    { value: 'none' as const, label: 'None' },
  ];

  return (
    <>
      <StepHeader title="Food" subtitle="Only used to flag clashes and suggest swaps you’re fine with. Skip anything that doesn’t apply." />
      <Field label="Diet">
        <SingleChips
          value={prefs.diet}
          onChange={(diet) => set({ diet })}
          options={[
            { value: 'omnivore', label: 'Non-veg' },
            { value: 'pescatarian', label: 'Pescatarian' },
            { value: 'eggetarian', label: 'Veg + eggs' },
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
          ]}
        />
      </Field>
      {prefs.diet === 'omnivore' && (
        <Field label="Meats you don’t eat">
          <Chips
            value={prefs.avoidMeats}
            onChange={(avoidMeats) => set({ avoidMeats })}
            options={[
              { value: 'beef', label: 'Beef' },
              { value: 'pork', label: 'Pork' },
            ]}
          />
        </Field>
      )}
      {prefs.diet !== 'vegan' && (
        <Field label="Dairy">
          <SingleChips
            value={prefs.dairy ? 'yes' : 'no'}
            onChange={(v) => set({ dairy: v === 'yes' })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No dairy' },
            ]}
          />
        </Field>
      )}
      <Field label="Allergies & intolerances">
        <Chips value={prefs.allergies} onChange={(allergies) => set({ allergies })} options={ALLERGIES} />
      </Field>
      {(noDairy || lactose) && (
        <Field label={lactose && !noDairy ? 'Lactose — alternatives you’re good with' : 'Milk alternatives you’re good with'}>
          <Chips value={prefs.milkAlts} onChange={(milkAlts) => set({ milkAlts })} options={MILK_ALTS.filter((o) => milkAltAllowed(o.value, prefs))} />
        </Field>
      )}
      {prefs.allergies.includes('gluten') && (
        <Field label="Gluten — what works instead of wheat">
          <Chips value={prefs.glutenAlts} onChange={(glutenAlts) => set({ glutenAlts })} options={GLUTEN_ALTS} />
        </Field>
      )}
      <Field label="Protein powder">
        <SingleChips value={prefs.supplement} onChange={(supplement) => set({ supplement })} options={supplements} />
      </Field>
    </>
  );
}

function HowStep({ profile }: { profile: Profile }) {
  const e = energyPlan(profile);
  const learns = [
    ['Which days you eat more', 'Your heavier days get a bigger share of the week — no fixed “weekend”.'],
    ['Your carb / fat balance', 'Protein is set from your weight; the rest follows how you like to eat.'],
    ['Treats you repeat', 'Beer on Fridays, dessert on Sundays — offered as planned treats, not failures.'],
    ['Your real maintenance', 'Weigh in 3+ times a week and intake vs. trend replaces the formula.'],
  ];
  return (
    <>
      <StepHeader
        title={`For ${CALIBRATION_DAYS} days, just log`}
        subtitle="Eat the way you normally do — don’t diet for the app. We learn your pattern, then propose a plan you can accept in one tap."
      />
      <View style={{ gap: Spacing.three }}>
        {learns.map(([title, text]) => (
          <View key={title} style={{ flexDirection: 'row', gap: Spacing.three }}>
            <View style={styles.bullet}>
              <Icons.Check size={12} color={Colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="label" color={Colors.text}>
                {title}
              </T>
              <T variant="caption">{text}</T>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.summary}>
        <T variant="body" style={{ color: Colors.text }}>
          Meanwhile you’ll see a provisional {fmt(e.target)} kcal/day ({fmt(e.weekly)}/week) so you have a reference point. Overages
          are spread gently while we learn; firmer course-correction starts once the plan is set.
        </T>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: 640 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 },
  scroll: { padding: Spacing.three, paddingBottom: Spacing.five, alignItems: 'center' },
  content: { width: '100%', maxWidth: 640, gap: Spacing.four },
  footer: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  footerInner: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.three, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 110 },
  summary: { gap: 6, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 2 },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
    marginTop: 1,
  },
});
