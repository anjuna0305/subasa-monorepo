import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getChatbotByUrlPath, heroImageUrl, type Chatbot } from '@/lib/api';
import { useConversation } from '@/state/conversation';

export default function TranscriptScreen() {
  const { urlPath } = useLocalSearchParams<{ urlPath: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { messages, clear } = useConversation(urlPath);

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setChatbot(await getChatbotByUrlPath(urlPath));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this chatbot.');
    }
  }, [urlPath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: chatbot?.chatbot_name ?? '' });
  }, [chatbot?.chatbot_name, navigation]);

  const heroUrl = chatbot ? heroImageUrl(chatbot) : null;

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="subtitle">Can&apos;t reach the chatbot</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {error}
        </ThemedText>
        <Pressable onPress={load} style={[styles.secondaryButton, { borderColor: theme.text }]}>
          <ThemedText type="smallBold">Try again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (!chatbot) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.six * 2 }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        <View style={styles.header}>
          {heroUrl ? (
            <Image source={{ uri: heroUrl }} style={styles.hero} contentFit="cover" />
          ) : null}
          <ThemedText type="subtitle">{chatbot.chatbot_name}</ThemedText>
          <ThemedText themeColor="textSecondary">{chatbot.description}</ThemedText>
        </View>

        {messages.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.empty}>
            <ThemedText type="smallBold">No conversation yet</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Start a call and just talk. What you both say shows up here to read afterwards.
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.messages}>
            {messages.map((message) => (
              <ThemedView
                key={message.id}
                type={message.role === 'user' ? 'backgroundSelected' : 'backgroundElement'}
                style={[
                  styles.bubble,
                  message.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
                ]}>
                <ThemedText type="small">{message.text}</ThemedText>
              </ThemedView>
            ))}
            <Pressable onPress={clear} style={styles.clear}>
              <ThemedText type="small" themeColor="textSecondary">
                Clear conversation
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/chat/[urlPath]/call', params: { urlPath } })
          }
          style={[styles.callButton, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {messages.length ? 'Call again' : 'Start call'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  hero: {
    width: '100%',
    height: 160,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  messages: {
    gap: Spacing.two,
  },
  bubble: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '85%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: Spacing.one,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Spacing.one,
  },
  clear: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  callButton: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
