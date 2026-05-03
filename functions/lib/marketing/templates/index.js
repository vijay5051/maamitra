"use strict";
// Template registry. Add new templates here so the renderer can dispatch
// them by name. The same name is used in marketing_drafts.assets[].template.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_NAMES = void 0;
exports.getTemplate = getTemplate;
const milestoneCard_1 = require("./milestoneCard");
const quoteCard_1 = require("./quoteCard");
const tipCard_1 = require("./tipCard");
const REGISTRY = {
    tipCard: tipCard_1.tipCard,
    quoteCard: quoteCard_1.quoteCard,
    milestoneCard: milestoneCard_1.milestoneCard,
};
function getTemplate(name) {
    return name in REGISTRY ? REGISTRY[name] : null;
}
exports.TEMPLATE_NAMES = ['tipCard', 'quoteCard', 'milestoneCard'];
