/** Only return to local admin pages; authentication links cannot redirect off-site. */
export function adminReturnPath(value?: string | null) {
  if (!value || value.length > 2000 || /[\\\u0000-\u001f]/.test(value))
    return "/admin";
  try {
    const base = "https://local.invalid";
    const url = new URL(value, base);
    if (
      !value.startsWith("/") ||
      url.origin !== base ||
      (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/"))
    )
      return "/admin";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/admin";
  }
}

export function adminSignInPath(value?: string | null) {
  return "/auth/login?next=" + encodeURIComponent(adminReturnPath(value));
}
