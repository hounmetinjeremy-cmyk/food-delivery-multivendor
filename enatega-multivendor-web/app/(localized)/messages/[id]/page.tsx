"use client";

import { useParams } from "next/navigation";
import ConversationThread from "@/lib/ui/screens/unprotected/Messages/ConversationThread";

export default function ConversationPage() {
  const { id } = useParams();
  return <ConversationThread conversationId={id as string} />;
}
