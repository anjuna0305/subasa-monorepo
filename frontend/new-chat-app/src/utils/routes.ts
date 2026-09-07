/**
 * Where a user lands after logging in or finishing onboarding.
 *
 * This used to be "/p/chatbot", whose route was commented out in App.tsx — so
 * it fell through to the "/p/:url_path" custom-chatbot catch-all and rendered
 * a lookup for a chatbot named "chatbot". Keep it in one place so the three
 * call sites cannot drift again.
 */
export const POST_LOGIN_REDIRECT = "/p/gov-chatbot";
