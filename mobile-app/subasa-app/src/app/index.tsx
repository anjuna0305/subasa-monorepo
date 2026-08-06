import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CHATBOT_URL_PATH } from '@/lib/config';

export default function IndexScreen() {
  if (CHATBOT_URL_PATH) {
    return (
      <Redirect href={{ pathname: '/chat/[urlPath]', params: { urlPath: CHATBOT_URL_PATH } }} />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">No chatbot configured</ThemedText>
        <ThemedText themeColor="textSecondary">
          Set the chatbot this build should open, then restart the dev server.
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.block}>
          <ThemedText type="code">EXPO_PUBLIC_CHATBOT_PATH=your-chatbot-url-path</ThemedText>
          <ThemedText type="code">
            EXPO_PUBLIC_API_BASE_URL=https://subasa.lk/voc-si/api/api-gateway
          </ThemedText>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          Copy .env.example to .env to get started.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  block: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
