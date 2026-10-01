import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Colors, Fonts } from '../../../constants/theme';
import { WHO_MAX_MONTHS, WhoIndicator, WhoSex } from '../../../data/whoGrowthStandards';
import { ageMonthsAt, isoFromDateKey, PERCENTILE_LINES, Visit, whoCurve } from '../../../lib/growth';

const H = 250;
const PAD = { l: 38, r: 30, t: 12, b: 30 };
const KEY: Record<WhoIndicator, 'weightKg' | 'lengthCm' | 'headCm'> = { weight: 'weightKg', height: 'lengthCm', head: 'headCm' };

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * One measure over age: the child's own readings (dots joined by a line)
 * over the WHO percentile lines for their sex. Reference lines are only
 * drawn where WHO publishes them (0–60 months) and only when `sex` is known.
 */
export default function GrowthChart({
  indicator,
  sex,
  visits,
  dob,
  ageNow,
}: {
  indicator: WhoIndicator;
  sex: WhoSex | null;
  visits: Visit[];
  dob: string;
  ageNow: number;
}) {
  const [w, setW] = useState(0);
  const pts = visits
    .filter((v) => typeof v[KEY[indicator]] === 'number')
    .map((v) => ({ x: Math.max(0, ageMonthsAt(dob, isoFromDateKey(v.date))), y: v[KEY[indicator]] as number }))
    .sort((a, b) => a.x - b.x);

  const lastX = Math.max(ageNow, pts.length ? pts[pts.length - 1].x : 0);
  // Show a little beyond the child's age, in 6-month steps, never less than a year.
  const xMax = Math.max(12, Math.ceil((lastX + 1) / 6) * 6);
  const curves = sex ? PERCENTILE_LINES.map((l) => ({ ...l, pts: whoCurve(indicator, sex, l.z, Math.min(xMax, WHO_MAX_MONTHS)) })) : [];

  const ys = [...pts.map((p) => p.y), ...curves.flatMap((c) => c.pts.map((p) => p.y))];
  const unit = indicator === 'weight' ? 'kg' : 'cm';
  if (ys.length === 0) {
    return (
      <View style={[styles.empty, { height: H }]}>
        <Text style={styles.emptyText}>No {indicator === 'weight' ? 'weight' : indicator === 'height' ? 'length / height' : 'head'} readings yet.</Text>
      </View>
    );
  }
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const padY = Math.max((yMax - yMin) * 0.06, 0.5);
  yMin = Math.max(0, yMin - padY);
  yMax = yMax + padY;
  const yStep = niceStep(yMax - yMin, 5);
  const xStep = xMax <= 12 ? 2 : xMax <= 24 ? 3 : xMax <= 60 ? 6 : 12;

  const iw = Math.max(1, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const sx = (x: number) => PAD.l + (x / xMax) * iw;
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * ih;
  const path = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ');

  const yTicks: number[] = [];
  for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) yTicks.push(Number(y.toFixed(4)));
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax; x += xStep) xTicks.push(x);
  const xLabel = (m: number) => (xMax > 24 ? (m % 12 === 0 ? `${m / 12}y` : '') : `${m}`);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="image"
      accessibilityLabel={`${indicator} chart with ${pts.length} recorded ${pts.length === 1 ? 'reading' : 'readings'}`}>
      {w > 0 && (
        <Svg width={w} height={H}>
          {yTicks.map((y) => (
            <Line key={`gy${y}`} x1={PAD.l} x2={w - PAD.r} y1={sy(y)} y2={sy(y)} stroke="#EFEAF6" strokeWidth={1} />
          ))}
          {yTicks.map((y) => (
            <SvgText key={`ty${y}`} x={PAD.l - 6} y={sy(y) + 3.5} fontSize={10} fill="#8A8499" textAnchor="end">{y}</SvgText>
          ))}
          {xTicks.map((x) => (
            <SvgText key={`tx${x}`} x={sx(x)} y={H - 12} fontSize={10} fill="#8A8499" textAnchor="middle">{xLabel(x)}</SvgText>
          ))}
          <Line x1={PAD.l} x2={w - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#D9D2EA" strokeWidth={1} />

          {/* WHO percentile lines — reference only */}
          {curves.map((c) => (
            <Path key={c.p} d={path(c.pts)} fill="none" stroke={c.p === 50 ? '#B7A4D6' : '#DCD3EC'}
              strokeWidth={c.p === 50 ? 1.6 : 1.1} strokeDasharray={c.p === 50 ? undefined : '4 3'} />
          ))}
          {curves.map((c) => {
            const last = c.pts[c.pts.length - 1];
            return <SvgText key={`l${c.p}`} x={sx(last.x) + 3} y={sy(last.y) + 3} fontSize={9} fill="#9A8FB3">{c.p}</SvgText>;
          })}

          {/* The child's own readings */}
          {pts.length > 1 && <Path d={path(pts)} fill="none" stroke={Colors.primary} strokeWidth={2.4} strokeLinejoin="round" />}
          {pts.map((p, i) => (
            <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="#fff" stroke={Colors.primary} strokeWidth={2.4} />
          ))}
        </Svg>
      )}
      <View style={styles.axisRow}>
        <Text style={styles.axis}>{unit}</Text>
        <Text style={styles.axis}>Age in {xMax > 24 ? 'years' : 'months'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: Colors.textLight },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: -4 },
  axis: { fontFamily: Fonts.sansMedium, fontSize: 10.5, color: Colors.textLight },
});
