import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Top-level error boundary. Wraps the entire app so a thrown error during
 * boot or render shows a useful fallback UI (with a reload button) instead
 * of a blank white screen — particularly important on Safari iPhone where
 * the user previously reported "refresh -> white screen" with no way to
 * recover except a full new tab + relogin.
 *
 * Renders the error message and stack so users (and we) can paste it back
 * to diagnose. Production-grade apps would log this to Sentry/Crashlytics
 * — for now we just surface it.
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

    return (
      <View style={styles.root}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.subheading}>
          The app hit an unexpected error while loading. Tap reload to try again.
        </Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorMsg} selectable>{msg}</Text>
          {stack ? (
            <Text style={styles.errorStack} numberOfLines={8} selectable>
              {stack}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={this.reload} style={styles.btn} activeOpacity={0.8}>
          <Text style={styles.btnText}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1C1033', marginBottom: 6 },
  subheading: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 22,
    maxWidth: 360,
    lineHeight: 20,
  },
  errorBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 22,
  },
  errorMsg: { fontSize: 13, color: '#991b1b', fontWeight: '600', marginBottom: 8 },
  errorStack: { fontSize: 11, color: '#7f1d1d', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  btn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
