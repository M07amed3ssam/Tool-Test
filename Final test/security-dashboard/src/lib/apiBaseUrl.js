const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const getWindowBasedDefault = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

export const getApiBaseUrl = () => {
  const configuredApiUrl = (process.env.REACT_APP_API_URL || '').trim();

  if (!configuredApiUrl) {
    return getWindowBasedDefault();
  }

  if (typeof window === 'undefined') {
    return configuredApiUrl;
  }

  try {
    const configuredUrl = new URL(configuredApiUrl);
    const currentHost = window.location.hostname;
    const configuredIsLoopback = LOOPBACK_HOSTS.has(configuredUrl.hostname);
    const currentIsLoopback = LOOPBACK_HOSTS.has(currentHost);

    // If UI is opened from another machine, avoid calling local loopback addresses.
    if (configuredIsLoopback && !currentIsLoopback) {
      const protocol = configuredUrl.protocol || window.location.protocol;
      const port = configuredUrl.port || '8000';
      return `${protocol}//${currentHost}:${port}`;
    }
  } catch (_error) {
    return getWindowBasedDefault();
  }

  return configuredApiUrl;
};
