/**
 * Sunrise / sunset in IST (UTC+5:30) using the NOAA solar-position approximation, for a reference
 * point in India (New Delhi by default). Accurate to a couple of minutes, which is plenty for
 * switching themes.
 *
 * Kept free of imports and outer references on purpose: `+html.tsx` inlines this function's source
 * into a pre-paint script so the page never flashes the wrong theme.
 */
export function istSun(nowMs: number, lat = 28.6139, lon = 77.209) {
  const IST_OFFSET_MIN = 330;
  const rad = Math.PI / 180;
  const ist = new Date(nowMs + IST_OFFSET_MIN * 60000);
  const dayOfYear = Math.floor((ist.getTime() - Date.UTC(ist.getUTCFullYear(), 0, 0)) / 86400000);
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / rad;
  // Minutes after IST midnight.
  const sunrise = 720 - 4 * (lon + ha) - eqTime + IST_OFFSET_MIN;
  const sunset = 720 - 4 * (lon - ha) - eqTime + IST_OFFSET_MIN;
  const now = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
  const isDay = now >= sunrise && now < sunset;
  // Milliseconds until the next switch (sunrise tomorrow if it's already after sunset).
  const nextSwitchMin = isDay ? sunset - now : now < sunrise ? sunrise - now : 1440 - now + sunrise;
  return { isDay, sunrise, sunset, msUntilSwitch: Math.max(60000, nextSwitchMin * 60000) };
}

export const formatIstMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${suffix}`;
};
