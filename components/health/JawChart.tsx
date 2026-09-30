import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { TEETH, ToothJaw, ToothRef } from '../../data/teeth';
import { KidTeethMap, ToothState } from '../../store/useTeethStore';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const ROSE = Colors.primary;
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const SKY  = '#60A5FA';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#9CA3AF';

const VIEW_W = 320;
const VIEW_H = 240;
const SLOT_X0 = 32;
const SLOT_DX = 28;
const TOOTH_R = 12;
const HIT_R = 18;

// In big-kid mode (5y+) an unlogged tooth is assumed to be a milk tooth
// that's still in — by 3 years all 20 are through — so it paints green.
function effectiveState(state: ToothState | undefined, bigKid: boolean): ToothState | undefined {
  if (bigKid && (!state || state === 'not-erupted')) return 'erupted';
  return state;
}

function fillFor(state: ToothState | undefined): string {
  if (state === 'erupted')   return SAGE;
  if (state === 'shed')      return GOLD;
  if (state === 'permanent') return SKY;
  return MIST;
}

function strokeFor(state: ToothState | undefined): string {
  if (state === 'erupted')   return '#16a34a';
  if (state === 'shed')      return '#d97706';
  if (state === 'permanent') return '#2563eb';
  return '#D9D2EA';
}

function textColorFor(state: ToothState | undefined): string {
  if (state === 'erupted' || state === 'shed' || state === 'permanent') return '#ffffff';
  return STONE;
}

/**
 * Returns the (x, y) for a tooth in the SVG. position is 1..10 left→right.
 * Upper jaw curves down at the edges (middle teeth higher); lower jaw curves up.
 */
function positionFor(jaw: ToothJaw, position: number): { x: number; y: number } {
  const i = position - 1; // 0..9
  const x = SLOT_X0 + i * SLOT_DX;
  // Normalised distance from centre: 0 at the middle, 1 at the edges.
  const t = (i - 4.5) / 4.5;
  const curve = t * t * 24;
  const y = jaw === 'upper' ? 70 + curve : 170 - curve;
  return { x, y };
}

interface Props {
  teeth: KidTeethMap;
  selectedToothId?: string | null;
  onSelect: (tooth: ToothRef) => void;
  /** 5y+ mode: milk tooth / fell out / adult tooth legend + defaults. */
  bigKid?: boolean;
}

export default function JawChart({ teeth, selectedToothId, onSelect, bigKid = false }: Props) {
  // SVG <G onPress> is unreliable on Android (Galaxy Note 20 reported the
  // tooth tiles as completely untappable). Overlay native TouchableOpacity
  // hit-targets positioned over each tooth instead — RN's gesture system
  // is platform-correct, the SVG is just a paint layer underneath.
  const [renderedWidth, setRenderedWidth] = useState<number>(0);
  const scale = renderedWidth > 0 ? renderedWidth / VIEW_W : 0;
  const renderedHeight = scale > 0 ? VIEW_H * scale : VIEW_H;

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => setRenderedWidth(e.nativeEvent.layout.width - 12)}
    >
      <View style={{ width: '100%', height: renderedHeight, position: 'relative' }}>
        <Svg width="100%" height={renderedHeight} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {/* Mid-mouth divider (UPPER / LOWER hint) */}
          <Line
            x1={0}
            y1={VIEW_H / 2}
            x2={VIEW_W}
            y2={VIEW_H / 2}
            stroke="#F0EBF8"
            strokeWidth={1}
            strokeDasharray="4 6"
          />
          <SvgText
            x={VIEW_W / 2}
            y={VIEW_H / 2 - 6}
            fontSize={9}
            fontWeight="700"
            fill="#c9b7f7"
            textAnchor="middle"
          >
            UPPER JAW
          </SvgText>
          <SvgText
            x={VIEW_W / 2}
            y={VIEW_H / 2 + 14}
            fontSize={9}
            fontWeight="700"
            fill="#c9b7f7"
            textAnchor="middle"
          >
            LOWER JAW
          </SvgText>

          {/* Side labels (R / L from the child's perspective). Their right is on screen-left. */}
          <SvgText x={6}  y={VIEW_H / 2 + 4} fontSize={11} fontWeight="700" fill={STONE}>R</SvgText>
          <SvgText x={VIEW_W - 12} y={VIEW_H / 2 + 4} fontSize={11} fontWeight="700" fill={STONE}>L</SvgText>

          {TEETH.map((t) => {
            const { x, y } = positionFor(t.jaw, t.position);
            const state = effectiveState(teeth[t.id]?.state, bigKid);
            const fill = fillFor(state);
            const stroke = strokeFor(state);
            const isSelected = selectedToothId === t.id;
            return (
              <React.Fragment key={t.id}>
                <Circle
                  cx={x}
                  cy={y}
                  r={TOOTH_R}
                  fill={fill}
                  stroke={isSelected ? ROSE : stroke}
                  strokeWidth={isSelected ? 2.5 : 1}
                />
                <SvgText
                  x={x}
                  y={y + 3.5}
                  fontSize={10}
                  fontWeight="700"
                  fill={textColorFor(state)}
                  textAnchor="middle"
                >
                  {t.position}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Native hit-targets — sit above the SVG so taps go through RN's
            gesture system, not SVG's. Sized HIT_R*2 around each tooth. */}
        {scale > 0 && TEETH.map((t) => {
          const { x, y } = positionFor(t.jaw, t.position);
          return (
            <TouchableOpacity
              key={`hit-${t.id}`}
              activeOpacity={0.6}
              onPress={() => onSelect(t)}
              accessibilityLabel={`Tap to log ${t.name}`}
              style={{
                position: 'absolute',
                left: x * scale - HIT_R,
                top: y * scale - HIT_R,
                width: HIT_R * 2,
                height: HIT_R * 2,
                borderRadius: HIT_R,
              }}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {(bigKid
          ? [
              { label: 'Milk tooth', bg: SAGE, border: '#16a34a' },
              { label: 'Fell out', bg: GOLD, border: '#d97706' },
              { label: 'Adult tooth', bg: SKY, border: '#2563eb' },
            ]
          : [
              { label: 'Not yet', bg: MIST, border: '#D9D2EA' },
              { label: 'Erupted', bg: SAGE, border: '#16a34a' },
              { label: 'Shed', bg: GOLD, border: '#d97706' },
            ]
        ).map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.bg, borderColor: l.border }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: MIST,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 4,
    paddingBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  legendText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    color: INK,
  },
});
