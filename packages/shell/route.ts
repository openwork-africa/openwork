export type Route =
  | { name: "home" }
  | { name: "room"; roomId: string }
  | { name: "profile"; roomId: string }
  | { name: "other"; path: string };

const ROOM = /^\/c\/([^/]+)$/;
const PROFILE = /^\/c\/([^/]+)\/profile$/;

export function parseRoute(path: string): Route {
  const pathname = path.split(/[?#]/)[0].replace(/(.)\/+$/, "$1") || "/";
  if (pathname === "/") return { name: "home" };
  const room = pathname.match(ROOM);
  if (room) return { name: "room", roomId: decodeURIComponent(room[1]) };
  const profile = pathname.match(PROFILE);
  if (profile) return { name: "profile", roomId: decodeURIComponent(profile[1]) };
  return { name: "other", path: pathname };
}

export const roomPath = (roomId: string): string => `/c/${encodeURIComponent(roomId)}`;

export const profilePath = (roomId: string): string => `${roomPath(roomId)}/profile`;

export function pathOf(route: Route): string {
  if (route.name === "home") return "/";
  if (route.name === "room") return roomPath(route.roomId);
  if (route.name === "profile") return profilePath(route.roomId);
  return route.path;
}

export const roomIdOf = (route: Route): string | undefined => (route.name === "room" || route.name === "profile" ? route.roomId : undefined);

/** The params of `pathname` if it fits `pattern` (`/c/:roomId`), else `null`. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const want = pattern.split("/").filter(Boolean);
  const have = pathname.split("/").filter(Boolean);
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of want.entries()) {
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(have[index]);
    else if (part !== have[index]) return null;
  }
  return params;
}
