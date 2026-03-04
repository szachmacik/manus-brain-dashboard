import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const { data: vapidData } = trpc.push.getVapidKey.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const sendTestMutation = trpc.push.sendTest.useMutation();

  // Check support & current permission
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  // Register Service Worker
  useEffect(() => {
    if (permission === "unsupported") return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setSwRegistration(reg);
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, [permission]);

  // Subscribe to push
  const subscribe = useCallback(async (label?: string) => {
    if (!swRegistration || !vapidData?.publicKey) {
      setError("Brak klucza VAPID lub Service Worker");
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") {
        setError("Brak zgody na powiadomienia");
        return false;
      }

      // Subscribe to push
      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as unknown as BufferSource,
      });

      const subJson = sub.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh ?? "",
        auth: subJson.keys?.auth ?? "",
        label: label ?? `Urządzenie ${new Date().toLocaleDateString("pl-PL")}`,
        userAgent: navigator.userAgent.substring(0, 200),
      });

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      setError(err.message ?? "Błąd subskrypcji");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration, vapidData, subscribeMutation]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!swRegistration) return false;
    setIsLoading(true);
    try {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (err: any) {
      setError(err.message ?? "Błąd wypisania");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration, unsubscribeMutation]);

  // Send test
  const sendTest = useCallback(async () => {
    try {
      return await sendTestMutation.mutateAsync();
    } catch (err: any) {
      setError(err.message ?? "Błąd testu");
      return null;
    }
  }, [sendTestMutation]);

  return {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
    isSupported: permission !== "unsupported",
  };
}

// Helper: convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
