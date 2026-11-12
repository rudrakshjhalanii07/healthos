import Head from 'expo-router/head';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachCard } from '@/components/coach-card';
import { DayLog } from '@/components/day-log';
import { FoodLogger } from '@/components/food-logger';
import { MacroCard } from '@/components/macro-card';
import { CalibrationCard, ProposalCard, WeightCard } from '@/components/plan-cards';
import { Ring } from '@/components/ring';
import { SettingsModal } from '@/components/settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge, Button, Card, CardHeader, IconButton, Icons, ProgressBar, T } from '@/components/ui';
import { WeekStrip } from '@/components/week-strip';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { addDays, type DateKey, formatDay, startOfWeek, todayKey, weekDates, weekday, weekRangeLabel } from '@/lib/dates';
import { coachHints } from '@/lib/coach';
import { analyzeHabits, buildProposal, calibrationStatus, weightTrend } from '@/lib/learn';
import { buildModel } from '@/lib/model';
import { classifyWeight, type DayPlan, type WeekPlan } from '@/lib/planner';
import { useStore } from '@/lib/store';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Dashboard() {
  const {
    ready,
    data,
    email,
    addEntry,
    removeEntry,
    setDayClosed,
    setDayType,
    addWeighIn,
    removeWeighIn,
    applyProposal,
    snoozeProposal,
  } = useStore();
  const [earlyRead, setEarlyRead] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const compact = width < 720;

  const today = todayKey();
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState<DateKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const weekStart = startOfWeek(addDays(today, weekOffset * 7), data.settings.weekStartsOn);
  const dates = weekDates(weekStart);
  const selected = picked && dates.includes(picked) ? picked : dates.includes(today) ? today : dates[0];

  const model = buildModel(data, dates, today);
  const { plan, macroPlan, prefs } = model;
  const day = plan.days.find((d) => d.date === selected)!;
  const dayIndex = plan.days.indexOf(day);
  const nextDay = plan.days[dayIndex + 1];
  const dm = macroPlan[selected];
  const budget = model.dayBudgetFor(selected);
  const editable = day.status === 'future' || (day.status === 'today' && !day.locked);
  const hints = coachHints({
    day,
    dm,
    budget,
    nextDay,
    nextDm: nextDay ? macroPlan[nextDay.date] : undefined,
  });

  const calibration = calibrationStatus(data, today);
  const earlyProposal = earlyRead && calibration.phase === 'learning' ? buildProposal(data, today) : null;
  const proposal =
    calibration.phase === 'ready' ? calibration.proposal : calibration.phase === 'active' ? calibration.update : earlyProposal;
  const habitsSoFar =
    calibration.phase === 'learning' && data.profile
      ? analyzeHabits(data.entries, data.weighIns, data.calibrationStart ?? today, addDays(today, -1), data.profile)
      : null;
  const treatNames = model.treats[selected].items.map(
    ({ allowance: a, qty }) => `${Number.isInteger(qty) ? qty : qty.toFixed(1)}× ${a.label.toLowerCase()}`,
  );
  const dayEntries = data.entries.filter((e) => e.date === selected).sort((a, b) => a.createdAt - b.createdAt);
  const dayName = day.status === 'today' ? 'Today' : formatDay(selected, { weekday: 'short', month: 'short', day: 'numeric' });

  if (!ready) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <Head>
        <title>HealthOS · Weekly calorie planner</title>
      </Head>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.scroll, compact && { padding: Spacing.three }]}>
          <View style={styles.container}>
            {/* Top bar */}
            <View style={styles.topbar}>
              <View style={styles.brand}>
                <View style={styles.logo}>
                  <Icons.Flame size={16} color={Colors.onAccent} />
                </View>
                <T variant="title" style={{ fontSize: 16 }}>
                  HealthOS
                </T>
                {!compact && (
                  <Badge color={Colors.textDim} bg={Colors.surfaceRaised}>
                    Weekly planner
                  </Badge>
                )}
              </View>
              <View style={styles.nav}>
                <View style={styles.weekNav}>
                  <IconButton label="Previous week" onPress={() => setWeekOffset((w) => w - 1)} style={styles.navBtn}>
                    <Icons.ChevronLeft size={16} />
                  </IconButton>
                  <T variant="label" color={Colors.text} style={{ minWidth: 110, textAlign: 'center' }}>
                    {weekRangeLabel(weekStart)}
                  </T>
                  <IconButton label="Next week" onPress={() => setWeekOffset((w) => w + 1)} style={styles.navBtn}>
                    <Icons.ChevronRight size={16} />
                  </IconButton>
                </View>
                {weekOffset !== 0 && !compact && (
                  <Button size="sm" kind="ghost" onPress={() => setWeekOffset(0)}>
                    This week
                  </Button>
                )}
                <ThemeToggle />
                <Button
                  size="sm"
                  onPress={() => setSettingsOpen(true)}
                  icon={<Icons.Settings size={14} color={Colors.textDim} />}>
                  {compact ? '' : email}
                </Button>
              </View>
            </View>

            {data.profile && proposal && (
              <ProposalCard
                key={proposal.kind + proposal.habits.to}
                proposal={proposal}
                profile={data.profile}
                proteinTarget={model.cfg.proteinG}
                early={!!earlyProposal}
                onApply={(treats) => {
                  applyProposal(proposal, treats);
                  setEarlyRead(false);
                }}
                onDismiss={() => (earlyProposal ? setEarlyRead(false) : snoozeProposal(proposal.kind === 'update' ? 7 : 3))}
              />
            )}
            {data.profile && calibration.phase === 'learning' && !earlyProposal && (
              <CalibrationCard
                day={calibration.day}
                completeDays={calibration.completeDays}
                canReadEarly={calibration.canReadEarly}
                onReadEarly={() => setEarlyRead(true)}
                habits={habitsSoFar}
                profile={data.profile}
                proteinTarget={model.cfg.proteinG}
                hasTrend={!!weightTrend(data.weighIns, today)}
              />
            )}

            {/* Hero */}
            <View style={[styles.grid, wide && styles.row]}>
              <BudgetCard plan={plan} wide={wide} compact={compact} />
              <DayCard
                wide={wide}
                day={day}
                name={dayName}
                closed={data.closedDays.includes(day.date)}
                onToggleClosed={(c) => setDayClosed(day.date, c)}
              />
              <InsightsCard wide={wide} plan={plan} settingsMin={data.settings.minDaily} />
            </View>

            {/* Macros + coach */}
            <View style={[styles.grid, wide && styles.row]}>
              <MacroCard style={wide && styles.fill} dm={dm} title={`${dayName} · macros`} treats={treatNames} />
              {data.profile && (
                <WeightCard
                  style={wide && styles.fill}
                  weighIns={data.weighIns}
                  profile={data.profile}
                  onAdd={(kg) => addWeighIn(today, kg)}
                  onRemove={removeWeighIn}
                />
              )}
              <CoachCard
                key={selected}
                style={wide && { flex: 1.6 }}
                hints={hints}
                budget={budget}
                target={dm.target}
                prefs={prefs}
                isToday={day.status === 'today' && !day.locked}
              />
            </View>

            {/* Week */}
            <Card>
              <CardHeader
                title="Week plan"
                right={
                  <View style={styles.legend}>
                    <Legend swatch={<View style={[styles.swatch, { backgroundColor: Colors.accent }]} />} label="Eaten" />
                    <Legend swatch={<View style={[styles.swatch, styles.swatchLine]} />} label="Target" />
                    <Legend swatch={<View style={[styles.swatch, styles.swatchDashed]} />} label="Planned" />
                  </View>
                }
              />
              <WeekStrip
                plan={plan}
                selected={selected}
                onSelect={setPicked}
                onCycleType={(date, next) =>
                  setDayType(date, next === classifyWeight(data.settings.dayWeights[weekday(date)] ?? 1) ? null : next)
                }
                compact={compact}
              />
            </Card>

            {/* Log */}
            <View style={[styles.grid, wide && styles.row]}>
              <FoodLogger
                style={wide && styles.fill}
                dayLabel={dayName}
                onAdd={(entry) => addEntry({ ...entry, date: selected })}
                budget={editable ? budget : null}
                prefs={prefs}
              />
              <DayLog
                style={wide && styles.fill}
                title={`${dayName} · entries`}
                entries={dayEntries}
                onRemove={removeEntry}
                isTreat={model.isTreat}
              />
            </View>

            <T variant="caption" style={{ textAlign: 'center', paddingVertical: Spacing.three }}>
              Your plan syncs to {email} and works offline. Estimates use typical portion sizes and are approximate.
            </T>
          </View>
        </ScrollView>
      </SafeAreaView>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function BudgetCard({ plan, wide, compact }: { plan: WeekPlan; wide: boolean; compact: boolean }) {
  const over = plan.remaining < 0;
  const projectedOver = plan.projected - plan.goal;
  const stats = [
    { label: 'Weekly goal', value: fmt(plan.goal) },
    { label: 'Logged', value: fmt(plan.logged) },
    { label: 'Open days', value: String(plan.openDays) },
    {
      label: 'Projected',
      value: fmt(plan.projected),
      color: projectedOver > 20 ? Colors.warn : Colors.accent,
    },
  ];

  return (
    <Card style={wide && { flex: 1.35 }}>
      <CardHeader title="Weekly budget" />
      <View style={[styles.budget, compact && { flexDirection: 'column' }]}>
        <Ring value={plan.accounted / plan.goal} size={compact ? 180 : 164}>
          <T variant="display" style={{ fontSize: 30 }} color={over ? Colors.warn : Colors.text}>
            {fmt(Math.abs(plan.remaining))}
          </T>
          <T variant="caption">{over ? 'kcal over' : 'kcal left'}</T>
        </Ring>
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <T variant="caption">{s.label}</T>
              <T variant="mono" color={s.color ?? Colors.text} style={{ fontSize: 15 }}>
                {s.value}
              </T>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function DayCard({
  wide,
  day,
  name,
  closed,
  onToggleClosed,
}: {
  wide: boolean;
  day: DayPlan;
  name: string;
  closed: boolean;
  onToggleClosed: (closed: boolean) => void;
}) {
  const remaining = day.target - day.consumed;
  const delta = day.target - day.baseline;
  const heading =
    day.status === 'today' ? "Today's target" : day.status === 'future' ? 'Planned target' : 'Target that day';

  return (
    <Card style={wide && styles.fill}>
      <CardHeader
        title={heading}
        right={
          Math.abs(delta) >= 10 ? (
            <Badge color={delta > 0 ? Colors.accent : Colors.info} bg={delta > 0 ? Colors.accentSoft : Colors.infoSoft}>
              {delta > 0 ? '+' : '−'}
              {fmt(Math.abs(delta))} vs even split
            </Badge>
          ) : (
            <Badge color={Colors.textDim} bg={Colors.surfaceHover}>
              Even split
            </Badge>
          )
        }
      />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T variant="display">{fmt(day.target)}</T>
          <T variant="label">kcal</T>
        </View>
        <T variant="caption">{name}</T>
      </View>

      <View style={{ gap: Spacing.two }}>
        <ProgressBar value={day.consumed / day.target} color={remaining < 0 ? Colors.warn : Colors.accent} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="caption">
            <T variant="mono" color={Colors.text} style={{ fontSize: 12 }}>
              {fmt(day.consumed)}
            </T>{' '}
            eaten
          </T>
          <T variant="caption">
            <T variant="mono" color={remaining < 0 ? Colors.warn : Colors.text} style={{ fontSize: 12 }}>
              {fmt(Math.abs(remaining))}
            </T>{' '}
            {remaining < 0 ? 'over' : 'left'}
          </T>
        </View>
      </View>

      {day.status === 'today' && (
        <View style={styles.closeRow}>
          <T variant="caption" style={{ flexShrink: 1 }}>
            {closed
              ? 'Day closed. Leftover budget is spread across the rest of the week.'
              : 'Done eating? Close the day to lock it in and re-plan the rest of the week.'}
          </T>
          <Button
            size="sm"
            kind={closed ? 'ghost' : 'secondary'}
            onPress={() => onToggleClosed(!closed)}
            icon={closed ? <Icons.Lock size={13} color={Colors.textDim} /> : <Icons.Check size={13} color={Colors.text} />}>
            {closed ? 'Reopen' : 'Close day'}
          </Button>
        </View>
      )}
      {day.status === 'past' && day.assumed && (
        <T variant="caption" color={Colors.warn}>
          Not logged — counted at its target so the rest of the week isn’t skewed.
        </T>
      )}
    </Card>
  );
}

function InsightsCard({ wide, plan, settingsMin }: { wide: boolean; plan: WeekPlan; settingsMin: number }) {
  const insights: { tone: 'good' | 'warn' | 'info'; text: string }[] = [];
  const finished = plan.days.filter((d) => d.locked).length;
  const perDay = plan.openDays > 0 ? Math.round(plan.paceDelta / plan.openDays / 10) * 10 : 0;
  const projectedOver = plan.projected - plan.goal;

  if (finished === 0 && plan.days[0].status === 'future') {
    insights.push({ tone: 'info', text: 'This week hasn’t started. Targets follow your default day types.' });
  } else if (finished === 0) {
    insights.push({ tone: 'info', text: 'First day of the week — targets will adapt as each day is logged.' });
  } else if (plan.paceDelta > 50) {
    insights.push({
      tone: 'good',
      text: `${fmt(plan.paceDelta)} kcal under pace.${plan.openDays ? ` Remaining days get ~${fmt(perDay)} extra each.` : ''}`,
    });
  } else if (plan.paceDelta < -50) {
    insights.push({
      tone: 'warn',
      text: `${fmt(-plan.paceDelta)} kcal over pace.${plan.openDays ? ` Trimmed ~${fmt(-perDay)} from each remaining day.` : ''}`,
    });
  } else {
    insights.push({ tone: 'good', text: 'Right on pace. Keep the targets as they are.' });
  }

  if (projectedOver > 20) {
    insights.push({
      tone: 'warn',
      text: plan.floorHit
        ? `Remaining days are held at your ${fmt(settingsMin)} kcal floor — you’ll likely finish ~${fmt(projectedOver)} over the goal.`
        : `On course to finish ~${fmt(projectedOver)} over the goal.`,
    });
  } else if (projectedOver < -20) {
    insights.push({
      tone: 'info',
      text: plan.ceilingHit
        ? `Remaining days are capped at your daily ceiling — you’ll finish ~${fmt(-projectedOver)} under the goal.`
        : `On course to finish ~${fmt(-projectedOver)} under the goal.`,
    });
  }

  const unlogged = plan.days.filter((d) => d.assumed).length;
  if (unlogged) {
    insights.push({
      tone: 'info',
      text: `${unlogged} past day${unlogged > 1 ? 's' : ''} not logged — counted at target.`,
    });
  }

  const burst = plan.days.filter((d) => !d.locked && d.type === 'flex');
  if (burst.length) {
    insights.push({
      tone: 'info',
      text: `${burst.map((d) => formatDay(d.date, { weekday: 'short' })).join(' & ')} ${burst.length > 1 ? 'are burst days' : 'is a burst day'} with a larger share.`,
    });
  }

  const reserved = plan.days.reduce((s, d) => s + d.reserved, 0);
  if (reserved > 0) {
    insights.push({
      tone: 'info',
      text: `${fmt(reserved)} kcal reserved for planned treats — other days carry ~${fmt(reserved / 7)} kcal less to make room.`,
    });
  }

  const toneColor = { good: Colors.accent, warn: Colors.warn, info: Colors.info };
  const upcoming = plan.days.filter((d) => !d.locked);

  return (
    <Card style={wide && styles.fill}>
      <CardHeader
        title="Optimizer"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icons.Sparkle size={13} color={Colors.accent} />
            <T variant="caption" color={Colors.accent}>
              Auto-balancing
            </T>
          </View>
        }
      />
      <View style={{ gap: Spacing.three }}>
        {insights.slice(0, 4).map((i) => (
          <View key={i.text} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.dot, { backgroundColor: toneColor[i.tone] }]} />
            <T variant="body" style={{ flex: 1, color: Colors.text, fontSize: 13.5 }}>
              {i.text}
            </T>
          </View>
        ))}
      </View>
      {upcoming.length > 0 && (
        <View style={styles.upcoming}>
          <T variant="caption" style={styles.sectionLabel}>
            REMAINING DAYS
          </T>
          <View style={styles.upcomingRow}>
            {upcoming.map((d) => (
              <View key={d.date} style={styles.upcomingDay}>
                <T variant="caption">{d.status === 'today' ? 'Today' : formatDay(d.date, { weekday: 'short' })}</T>
                <T variant="mono" color={Colors.text} style={{ fontSize: 12.5 }}>
                  {fmt(d.target)}
                </T>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <T variant="caption">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.four, alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: 2,
  },
  navBtn: { width: 28, height: 28 },
  grid: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  fill: { flex: 1 },
  budget: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  stats: { flex: 1, alignSelf: 'stretch', gap: 2, justifyContent: 'center' },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: 'auto',
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  upcoming: {
    marginTop: 'auto',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  upcomingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  upcomingDay: {
    flexGrow: 1,
    minWidth: 56,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
  },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  legend: { flexDirection: 'row', gap: Spacing.three },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchLine: { height: 2, backgroundColor: Colors.text, opacity: 0.7 },
  swatchDashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.textMuted },
});
