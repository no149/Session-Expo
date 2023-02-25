"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadThemeColors = void 0;
function loadThemeColors(variables) {
    for (const [key, value] of Object.entries(variables)) {
        document.documentElement.style.setProperty(key, value);
    }
}
exports.loadThemeColors = loadThemeColors;
