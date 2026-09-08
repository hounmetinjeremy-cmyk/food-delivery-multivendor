import { setZegoApiToken } from "./client";

const CONTINUE_WITH_GOOGLE = /* GraphQL */ `
  mutation ContinueWithGoogle($idToken: String!) {
    continueWithGoogle(idToken: $idToken) {
      token
    }
  }
`;

const ZEGO_API_URL =
  process.env.NEXT_PUBLIC_ZEGO_API_URL ??
  "https://zego-api.hounmetinjeremy.workers.dev/graphql";

/**
 * Fire-and-forget: exchanges the Google ID token the existing login flow
 * already obtained for a zego-api session, so the Livreur/Messagerie tabs
 * (which talk to zego-api, not the original backend) know who's asking.
 * Never throws — a failure here must not break the existing login.
 */
export async function syncZegoApiSession(idToken: string): Promise<void> {
  try {
    const response = await fetch(ZEGO_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: CONTINUE_WITH_GOOGLE,
        variables: { idToken },
      }),
    });
    const json = (await response.json()) as {
      data?: { continueWithGoogle?: { token: string } };
    };
    const token = json.data?.continueWithGoogle?.token;
    if (token) setZegoApiToken(token);
  } catch {
    // Non-fatal: Livreur/Messagerie will just show a signed-out state.
  }
}
