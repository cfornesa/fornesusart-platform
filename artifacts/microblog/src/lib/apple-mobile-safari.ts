export function isAppleMobileSafari(userAgent = navigator.userAgent): boolean {
  const ua = userAgent || "";
  const isAppleMobileDevice =
    /iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

  if (!isAppleMobileDevice) {
    return false;
  }

  const isWebKit = /WebKit/i.test(ua);
  const isSafariTokenPresent = /Safari/i.test(ua);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT|DuckDuckGo|YaBrowser|Puffin/i.test(ua);

  return isWebKit && isSafariTokenPresent && !isOtherIosBrowser;
}
