"use strict";
// Tiny `h` helper that produces Satori-compatible nodes without pulling in
// React. Satori only cares about the shape `{ type, props: { children, ...style } }`,
// so a 3-line factory is enough.
//
// Templates use this instead of JSX so we don't need a JSX pragma config in
// the Cloud Functions tsconfig (the rest of the project doesn't use React in
// functions/).
Object.defineProperty(exports, "__esModule", { value: true });
exports.h = h;
function h(type, props, ...children) {
    const flat = [];
    const push = (n) => {
        if (n === null || n === undefined || n === false)
            return;
        if (Array.isArray(n)) {
            n.forEach(push);
            return;
        }
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
