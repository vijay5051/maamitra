import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LegalPage, P, H2, B, A, OPERATOR_NAME, OPERATOR_PLACE, SUPPORT_EMAIL, legalStyles } from '../components/legal/LegalPage';
import { Colors, Fonts } from '../constants/theme';

export default function ContactScreen() {
  return (
    <LegalPage title="Contact us">
      <P>We're a small team in India and we read every message. We usually reply within 2 working days.</P>

      <TouchableOpacity
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={[legalStyles.card, s.row]}
        activeOpacity={0.8}
        accessibilityRole="link"
        accessibilityLabel={`Email MaaMitra at ${SUPPORT_EMAIL}`}
      >
        <View style={s.icon}><Ionicons name="mail-outline" size={20} color={Colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Email</Text>
          <Text style={s.value} selectable>{SUPPORT_EMAIL}</Text>
          <Text style={s.hint}>Support, billing, refunds, privacy requests and feedback</Text>
        </View>
      </TouchableOpacity>

      <View style={[legalStyles.card, s.row]}>
        <View style={s.icon}><Ionicons name="chatbubbles-outline" size={20} color={Colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>In the app</Text>
          <Text style={s.value}>Home → your profile picture → Help & feedback</Text>
          <Text style={s.hint}>Send a support request without leaving MaaMitra</Text>
        </View>
      </View>

      <View style={[legalStyles.card, s.row]}>
        <View style={s.icon}><Ionicons name="location-outline" size={20} color={Colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Operated by (sole proprietor)</Text>
          <Text style={s.value}>{OPERATOR_NAME}</Text>
          <Text style={s.hint}>{OPERATOR_PLACE}</Text>
        </View>
      </View>

      <H2>When you write to us</H2>
      <P>Please include the email or phone number on your MaaMitra account. For a payment question, add the date, amount and order or transaction ID.</P>

      <H2>Grievance Officer (DPDP Act 2023)</H2>
      <P><B>Name:</B> {OPERATOR_NAME} (sole proprietor)</P>
      <P><B>Email:</B> <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A></P>
      <P><B>Location:</B> {OPERATOR_PLACE}</P>
      <P>We respond to grievances within 30 days.</P>

      <H2>Medical emergencies</H2>
      <P>MaaMitra is not a medical service. In an emergency call <B>108 / 102</B> or go to the nearest hospital.</P>
    </LegalPage>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textMuted },
  value: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.textDark, marginTop: 2 },
  hint: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#4B5563', marginTop: 2, lineHeight: 19 },
});
