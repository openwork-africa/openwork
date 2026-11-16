export const FILE_REF_PREFIX = "file:";
export const fileIdOf = (ref: string | undefined): string | undefined =>
  ref?.startsWith(FILE_REF_PREFIX) && ref.length > FILE_REF_PREFIX.length ? ref.slice(FILE_REF_PREFIX.length) : undefined;
export const refOf = (id: string): string => `${FILE_REF_PREFIX}${id}`;
export const objectUrlOf = (blob: Blob): string => URL.createObjectURL(blob);
