import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  at: number;
};

type Transcripts = Record<string, Message[]>;

type ConversationContextValue = {
  transcripts: Transcripts;
  append: (urlPath: string, message: Omit<Message, 'id' | 'at'>) => void;
  clear: (urlPath: string) => void;
};

const ConversationContext = createContext<ConversationContextValue | null>(null);

let messageCounter = 0;

/**
 * Holds every conversation in memory, keyed by the chatbot's `url_path`. Transcripts
 * survive navigating between the call and transcript screens and are dropped when the app
 * restarts — the backend does not persist chat history yet. When it does, this provider is
 * the only thing that has to change.
 */
export function ConversationProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<Transcripts>({});

  const append = useCallback((urlPath: string, message: Omit<Message, 'id' | 'at'>) => {
    messageCounter += 1;
    const entry: Message = { ...message, id: `${Date.now()}-${messageCounter}`, at: Date.now() };
    setTranscripts((current) => ({
      ...current,
      [urlPath]: [...(current[urlPath] ?? []), entry],
    }));
  }, []);

  const clear = useCallback((urlPath: string) => {
    setTranscripts((current) => ({ ...current, [urlPath]: [] }));
  }, []);

  const value = useMemo(
    () => ({ transcripts, append, clear }),
    [transcripts, append, clear]
  );

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation(urlPath: string) {
  const context = useContext(ConversationContext);
  if (!context) throw new Error('useConversation must be used inside a ConversationProvider');

  const { transcripts, append, clear } = context;
  const messages = transcripts[urlPath] ?? [];

  return useMemo(
    () => ({
      messages,
      append: (message: Omit<Message, 'id' | 'at'>) => append(urlPath, message),
      clear: () => clear(urlPath),
    }),
    [messages, append, clear, urlPath]
  );
}
