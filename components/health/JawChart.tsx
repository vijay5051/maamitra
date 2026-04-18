import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { TEETH, ToothJaw, ToothRef } from '../../data/teeth';
import { KidTeethMap, ToothState } from '../../store/useTeethStore';
import { Fonts } from '../../constants/theme';

const ROSE = '#E8487A';
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#9CA3AF';

const VIEW_W = 320;
const VIEW_H = 240;
const SLOT_X0 = 32;
const SLOT_DX = 28;
const TOOTH_R = 12;
const HIT_R = 18;

function fillFor(state: ToothState | undefined): string {
  if (state === 'erupted') return SAGE;
  if (state === 'shed')    return GOLD;
  return MIST;
}

function strokeFor(state: ToothState | undefined): string {
  if (state === 'erupted') return '#16a34a';
  if (state === 'shed')    return '#d97706';
  return '#D9D2EA';
}

function textColorFor(state: ToothState | undefined): string {
  if (state === 'erupted' || state === 'shed') return '#ffffff';
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
}

export default function JawChart({ teeth, selectedToothId, onSelect }: Props) {
  const upperTeeth = TEETH.filter((t) => t.jaw === 'upper');
  const lowerTeeth = TEETH.filter((t) => t.jaw === 'lower');

  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
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
          fill="#C4B5FD"
          textAnchor="middle"
        >
          UPPER JAW
        </SvgText>
        <SvgText
          x={VIEW_W / 2}
          y={VIEW_H / 2 + 14}
          fontSize={9}
          fontWeight="700"
          fill="#C4B5FD"
          textAnchor="middle"
        >
          LOWER JAW
        </SvgText>

        {/* Side labels (R / L from baby's perspective). Baby's right is on screen-left. */}
        <SvgText x={6}  y={VIEW_H / 2 + 4} fontSize={11} fontWeight="700" fill={STONE}>R</SvgText>
        <SvgText x={VIEW_W - 12} y={VIEW_H / 2 + 4} fontSize={11} fontWeight="700" fill={STONE}>L</SvgText>

        {[...upperTeeth, ...lowerTeeth].map((t) => {
          const { x, y } = positionFor(t.jaw, t.position);
          const entry = teeth[t.id];
          const fill = fillFor(entry?.state);
          const stroke = strokeFor(entry?.state);
          const isSelected = selectedToothId === t.id;
          return (
            <G key={t.id} onPress={() => onSelect(t)}>
              {/* Invisible larger hit area for easier tapping */}
              <Circle cx={x} cy={y} r={HIT_R} fill="transparent" />
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
                fill={textColorFor(entry?.state)}
                textAnchor="middle"
              >
                {t.position}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MIST, borderColor: '#D9D2EA' }]} />
          <Text style={styles.legendText}>Not yet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SAGE, borderColor: '#16a34a' }]} />
          <Text style={styles.legendText}>Erupted</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GOLD, borderColor: '#d97706' }]} />
          <Text style={styles.legendText}>Shed</Text>
        </View>
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
