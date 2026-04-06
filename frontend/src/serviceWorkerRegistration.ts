export function registerServiceWorker() {
  // Intentionally disabled: we keep runtime SW turned off until Safari/iPad stability work is fully validated.
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.error('Service worker cleanup failed', error);
    }
  });
}
