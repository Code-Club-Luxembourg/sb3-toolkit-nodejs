export interface CountdownOptions {
  countdownSeconds: number;
  checksumUrl: string;
  initialChecksum: string;
}

/**
 * Build an inline script that shows a countdown and reloads when checksum changes.
 */
export function buildCountdownScript(options: CountdownOptions): string {
  return `
(() => {
  const totalSeconds = ${options.countdownSeconds};
  const checksumUrl = ${JSON.stringify(options.checksumUrl)};
  const initialChecksum = ${JSON.stringify(options.initialChecksum)};
  let remaining = totalSeconds;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '10px';
  container.style.right = '10px';
  container.style.zIndex = '9999';
  container.style.padding = '6px 10px';
  container.style.borderRadius = '6px';
  container.style.background = 'rgba(0, 0, 0, 0.6)';
  container.style.color = '#ffffff';
  container.style.font = '14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif';
  container.style.pointerEvents = 'none';
  container.textContent = String(remaining);
  document.body.appendChild(container);

  const updateText = () => {
    container.textContent = String(remaining);
  };

  const fetchChecksum = async () => {
    const url = checksumUrl + (checksumUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.text()).trim();
  };

  const checkAndReload = async () => {
    try {
      const latest = await fetchChecksum();
      if (latest && latest !== initialChecksum) {
        location.reload();
      }
    } catch (error) {
      // ignore and continue countdown
    }
  };

  const tick = async () => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = totalSeconds;
      updateText();
      await checkAndReload();
      return;
    }
    updateText();
  };

  updateText();
  setInterval(tick, 1000);
})();
`.trim();
}
