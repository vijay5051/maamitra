// Tiny `h` helper that produces Satori-compatible nodes without pulling in
// React. Satori only cares about the shape `{ type, props: { children, ...style } }`,
// so a 3-line factory is enough.
//
// Templates use this instead of JSX so we don't need a JSX pragma config in
// the Cloud Functions tsconfig (the rest of the project doesn't use React in
// functions/).

export type SatoriNode = string | number | SatoriElement | null | undefined | false;

export interface SatoriElement {
  type: string;
  props: {
    children?: any;
    style?: Record<string, any>;
    tw?: string;
    [key: string]: any;
  };
}

export function h(
  type: string,
  props: Record<string, any> | null | undefined,
  ...children: any[]
): SatoriElement {
  const flat: any[] = [];
  const push = (n: any) => {
    if (n === null || n === undefined || n === false) return;
    if (Array.isArray(n)) { n.forEach(push); return; }
    flat.push(n);
  };
  children.forEach(push);
  return {
    type,
    props: {
      ...(props ?? {}),
      children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat,
    },
  };
}
