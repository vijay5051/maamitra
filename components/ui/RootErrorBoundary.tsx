import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Illustration } from './Illustration';
import { Colors, Fonts } from '../../constants/theme';

/**
 * Top-level error boundary. Wraps the entire app so a thrown error during
 * boot or render shows a useful fallback UI (with a reload button) instead
 * of a blank white screen — particularly important on Safari iPhone where
 * the user previously reported "refresh -> white screen" with no way to
 * recover except a full new tab + relogin.
 *
 * Production users should never see raw stack traces. We keep the branded
 * retry state calm and human; detailed diagnostics are only shown in dev.
 */
type State = { error: Error | null };

export default class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info);
  }

  reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      // On native there's no clean way to reload from JS; clear the error
      // and let the user tap into screens again. If the underlying state is
      // corrupt, force-stop + reopen is the answer.
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error.message || String(this.state.error);
    const stack = this.state.error.stack ?? '';
    const showDebug = typeof __DEV__ !== 'undefined' && __DEV__;

    return (
      <View style={styles.root}>
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['#FFF8F1', '#F8F2FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroGlowOne} pointerEvents="none" />
            <View style={styles.heroGlowTwo} pointerEvents="none" />
            <Illustration
              name="chatMascot"
              style={styles.illus}
              contentFit="contain"
              transitionMs={0}
            />
          </LinearGradient>
        </View>
        <Text style={styles.heading}>Uh Oh, Please Retry</Text>
        <Text style={styles.subheading}>
          MaaMitra ran into a temporary problem. Please try again and we&apos;ll bring you back gently.
        </Text>
        {showDebug ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorMsg} selectable>{msg}</Text>
            {stack ? (
              <Text style={styles.errorStack} numberOfLines={8} selectable>
                {stack}
              </Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity onPress={this.reload} style={styles.btn} activeOpacity={0.82}>
          <Text style={styles.btnText}>Please Retry</Text>
        </TouchableOpacity>
        {!showDebug ? (
          <Text style={styles.footnote}>
            If this keeps happening, close and reopen the app once.
          </Text>
        ) : null}
        {showDebug ? (
          <Text style={styles.devHint}>Debug details are only shown in development builds.</Text>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFCF7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  heroWrap: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 22,
  },
  heroCard: {
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.08)',
  },
  heroGlowOne: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(201,182,242,0.22)',
    top: -30,
    right: -24,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(253,217,210,0.28)',
    bottom: -16,
    left: -18,
  },
  illus: {
    width: 168,
    height: 168,
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheading: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 360,
    lineHeight: 21,
  },
  errorBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FBCFE8',
    marginBottom: 18,
  },
  errorMsg: {
    fontSize: 13,
    color: '#9D174D',
    fontFamily: Fonts.sansBold,
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 11,
    color: '#831843',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 16,
    minWidth: 170,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  btnText: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: 15,
  },
  footnote: {
    marginTop: 12,
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#8B6F95',
    textAlign: 'center',
  },
  devHint: {
    marginTop: 10,
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
