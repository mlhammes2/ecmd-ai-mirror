import { SUPABASE_URL } from "../integrations/supabase/client";

export const DEFAULT_LOGO_PATH = "/logo.svg";

/**
 * Resolves a media path or URL.
 * Returns the Supabase Storage URL if a bucket key is passed, or the local public path / external URL.
 */
export function getMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) {
    return DEFAULT_LOGO_PATH;
  }

  // Already a full external URL or data URI
  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("data:") ||
    pathOrUrl.startsWith("blob:")
  ) {
    return pathOrUrl;
  }

  // Local public asset path (e.g., '/logo.svg')
  if (pathOrUrl.startsWith("/")) {
    return pathOrUrl;
  }

  // Supabase storage object path
  const cleanKey = pathOrUrl.startsWith("storage/v1/object/public/")
    ? pathOrUrl.replace("storage/v1/object/public/", "")
    : pathOrUrl;

  return `${SUPABASE_URL}/storage/v1/object/public/${cleanKey}`;
}
