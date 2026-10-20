// The browser Notification API (option B).
//
// Only exists in a secure context: https:// or http://localhost / 127.0.0.1. Opened by
// a LAN or VPN IP over plain http it is absent, and the UI says so instead of offering
// a switch that cannot work. iOS additionally only allows it for an installed web app.

export type SystemSupport = "granted" | "default" | "denied" | "insecure" | "unsupported";

export function systemSupport(): SystemSupport {
  if (!window.isSecureContext) return "insecure";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Ask for permission. Must be called from a click: browsers ignore prompts without one.
 *
 * Returns `dismissed` when the browser answered without the reader deciding: Chrome
 * resolves `"default"` with NO prompt once a site's prompt was dismissed a few times,
 * or when "quieter messaging" is on (a bell icon in the address bar instead). The
 * caller must say so; doing nothing looks like a dead button.
 */
export async function requestSystem(): Promise<SystemSupport | "dismissed"> {
  if (systemSupport() !== "default") return systemSupport();
  const answer = await Notification.requestPermission();
  return answer === "default" ? "dismissed" : systemSupport();
}

export function showSystem(title: string, body: string, tag: string, onClick: () => void): void {
  if (systemSupport() !== "granted") return;
  try {
    // `tag` collapses repeats of the same fact across tabs into one OS notification.
    const n = new Notification(title, { body, tag, icon: "/logo.png" });
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  } catch {
    // Some platforms (Android Chrome) only allow notifications from a service worker;
    // the in-app toast and bell still carry the notice.
  }
}
