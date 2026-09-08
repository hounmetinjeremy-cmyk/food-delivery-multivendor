"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

import { zegoApiFetch, getZegoApiToken } from "@/lib/zego-api/client";

interface Conversation {
  id: string;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  otherUser: { id: string; name: string; imageUrl: string | null; role: string };
}

const MY_CONVERSATIONS_QUERY = /* GraphQL */ `
  query MyConversations {
    myConversations {
      id
      lastMessageAt
      lastMessageBody
      otherUser {
        id
        name
        imageUrl
        role
      }
    }
  }
`;

export default function ConversationsList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (!getZegoApiToken()) {
      setSignedOut(true);
      setIsLoading(false);
      return;
    }
    zegoApiFetch<{ myConversations: Conversation[] }>(MY_CONVERSATIONS_QUERY)
      .then((data) => setConversations(data.myConversations))
      .finally(() => setIsLoading(false));
  }, []);

  if (signedOut) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connectez-vous pour voir vos messages.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-dispatch-ink dark:text-white">
        Messagerie
      </h1>

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chargement…</p>
      )}

      {!isLoading && conversations.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucune conversation pour le moment. Contactez un livreur depuis l&apos;onglet
          Livreur pour démarrer une discussion.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link
              href={`/messages/${conversation.id}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                {conversation.otherUser.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conversation.otherUser.imageUrl}
                    alt={conversation.otherUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-dispatch-ink dark:text-white">
                  {conversation.otherUser.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {conversation.lastMessageBody ?? "Démarrer la discussion"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
