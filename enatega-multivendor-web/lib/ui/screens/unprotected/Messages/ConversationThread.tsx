"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

import { zegoApiFetch, getZegoApiToken, getZegoApiUserId } from "@/lib/zego-api/client";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

const MESSAGES_QUERY = /* GraphQL */ `
  query Messages($conversationId: ID!) {
    messages(conversationId: $conversationId) {
      id
      senderId
      body
      createdAt
    }
  }
`;

const SEND_MESSAGE_MUTATION = /* GraphQL */ `
  mutation SendMessage($conversationId: ID!, $body: String!) {
    sendMessage(conversationId: $conversationId, body: $body) {
      id
      senderId
      body
      createdAt
    }
  }
`;

// Simple polling every few seconds — no WebSocket/subscription infra yet,
// but good enough for a lightweight direct-message experience.
const POLL_INTERVAL_MS = 4000;

export default function ConversationThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const myUserId = getZegoApiUserId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(() => {
    zegoApiFetch<{ messages: Message[] }>(MESSAGES_QUERY, { conversationId }).then((data) =>
      setMessages(data.messages),
    );
  }, [conversationId]);

  useEffect(() => {
    if (!getZegoApiToken()) {
      setSignedOut(true);
      return;
    }
    loadMessages();
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setDraft("");
    try {
      await zegoApiFetch(SEND_MESSAGE_MUTATION, { conversationId, body });
      loadMessages();
    } finally {
      setIsSending(false);
    }
  };

  if (signedOut) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connectez-vous pour voir cette conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-2xl flex-col px-4 py-4 md:h-screen">
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          aria-label="Retour"
          className="text-dispatch-ink dark:text-white"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h1 className="text-lg font-semibold text-dispatch-ink dark:text-white">Conversation</h1>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {messages.map((message) => {
          const isMine = message.senderId === myUserId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? "bg-primary-color text-white"
                    : "bg-gray-100 text-dispatch-ink dark:bg-gray-800 dark:text-white"
                }`}
              >
                {message.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSend();
          }}
          placeholder="Écrivez un message…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !draft.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-color text-white disabled:opacity-50"
          aria-label="Envoyer"
        >
          <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
