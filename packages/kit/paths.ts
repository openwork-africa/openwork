export const homePath = (): string => "/";
export const roomPath = (roomId: string): string => `/c/${encodeURIComponent(roomId)}`;
export const profilePath = (roomId: string): string => `${roomPath(roomId)}/profile`;
