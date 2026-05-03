"use strict";
// Shared types for the Satori template registry.
//
// Each template module exports a `render(props, brand)` function that returns
// a Satori-compatible JSX tree. The renderer dispatches to the right template
// by name. Brand kit comes in once per call so templates can pull palette,
// fonts, and the logo URL.
Object.defineProperty(exports, "__esModule", { value: true });
