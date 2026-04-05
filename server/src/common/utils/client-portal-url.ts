export function buildClientPortalLoginUrl(
  siteUrl?: string | null,
  nextPath?: string,
) {
  const normalizedSiteUrl = siteUrl?.trim();

  if (!normalizedSiteUrl) {
    return '';
  }

  try {
    const url = new URL('/login', normalizedSiteUrl);
    url.searchParams.set('role', 'client');

    if (nextPath) {
      url.searchParams.set('next', nextPath);
    }

    return url.toString();
  } catch {
    return '';
  }
}
