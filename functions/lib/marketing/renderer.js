"use strict";
// Satori → SVG → PNG pipeline.
//
// Renders a named template with caller-supplied props + brand kit, returns
// the PNG buffer. The HTTPS callable in marketing/index.ts is what wires
// this to the admin panel and (in Phase 3) the daily generator cron.
//
// Image sources for backgrounds/photos are the caller's responsibility —
// pass a public URL in the template props (e.g. props.backgroundUrl from
// pexelsSearch). Satori fetches the URL and embeds it. We don't re-host
// because the embed is one-shot.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
const resvg_js_1 = require("@resvg/resvg-js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const satori_1 = __importDefault(require("satori"));
const templates_1 = require("./templates");
let _fonts = null;
function loadFonts() {
    if (_fonts)
        return _fonts;
    const dir = path.join(__dirname, 'fonts');
    const fontPaths = [
        { file: 'inter-400.ttf', name: 'Inter', weight: 400 },
        { file: 'inter-700.ttf', name: 'Inter', weight: 700 },
        { file: 'noto-devanagari-400.ttf', name: 'Noto Sans Devanagari', weight: 400 },
        { file: 'noto-devanagari-700.ttf', name: 'Noto Sans Devanagari', weight: 700 },
    ];
    _fonts = fontPaths.map((f) => {
        const buf = fs.readFileSync(path.join(dir, f.file));
        // Convert Buffer → ArrayBuffer slice (Satori is strict about the type).
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        return { name: f.name, data: ab, weight: f.weight, style: 'normal' };
    });
    return _fonts;
}
async function renderTemplate(templateName, props, brand, opts) {
    const template = (0, templates_1.getTemplate)(templateName);
    if (!template)
        throw new Error(`Unknown template: ${templateName}`);
    const width = opts?.width ?? 1080;
    const height = opts?.height ?? 1080;
    const tree = template(props, brand);
    const svg = await (0, satori_1.default)(tree, {
        width,
        height,
        fonts: loadFonts(),
        // Cache fetched <img> URLs across the render so the same logo isn't
        // re-fetched per slide of a carousel.
        loadAdditionalAsset: async (code, segment) => {
            // We don't need emoji or non-Latin sub-fonts beyond what we bundled.
            // Returning the segment unchanged tells Satori to render it as text
            // with the existing fonts (Devanagari falls through to Noto).
            void code;
            return segment;
        },
    });
    const resvg = new resvg_js_1.Resvg(svg, {
        fitTo: { mode: 'width', value: width },
        background: 'transparent',
        font: { loadSystemFonts: false },
    });
    const png = resvg.render().asPng();
    return { png: Buffer.from(png), width, height, template: templateName };
}
