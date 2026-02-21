export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          updateViaCache: 'none',
        });

        await registration.update();

        setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    });
  }
}
