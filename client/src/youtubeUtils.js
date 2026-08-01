export function extractYoutubeId(rawUrl) {
  if (!rawUrl) return null;
  const url = rawUrl.trim();

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").replace("m.", "");

    // youtu.be/VIDEOID
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return isValidId(id) ? id : null;
    }

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      // Standard watch URL: works no matter where "v" appears in the query string
      const vParam = parsed.searchParams.get("v");
      if (isValidId(vParam)) return vParam;

      // /embed/VIDEOID, /shorts/VIDEOID, /live/VIDEOID
      const pathMatch = parsed.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[2];
    }
  } catch {
    // Not a valid URL at all — fall through to null below
  }

  return null;
}

function isValidId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}
