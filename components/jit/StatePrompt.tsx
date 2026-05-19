import { StyleSheet, View } from 'react-native';
import JustInTimePrompt from './JustInTimePrompt';
import StateSelector from '../onboarding/StateSelector';
import { useProfileStore } from '../../store/useProfileStore';

export default function StatePrompt() {
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  const visible = !!profile && !profile.state;

  const handleSelect = (v: string) => {
    if (!profile) return;
    setProfile({ ...profile, state: v });
    dismiss('state');
  };

  return (
    <JustInTimePrompt
      promptKey="state"
      question="Which state are you in?"
      reason="So we can show you moms nearby and state-specific schemes."
      visible={visible}
    >
      <View style={styles.selectorWrap}>
        <StateSelector
          selected={profile?.state ?? ''}
          onSelect={handleSelect}
        />
      </View>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  selectorWrap: { marginTop: 2 },
});
