"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.declareCSSVariables = exports.THEME_GLOBALS = void 0;
const hexColorToRGB_1 = require("../util/hexColorToRGB");
const colors_1 = require("./constants/colors");
exports.THEME_GLOBALS = {
    '--font-default': 'Roboto',
    '--font-font-accent': 'Loor',
    '--font-font-mono': 'SpaceMono',
    '--font-size-xs': '11px',
    '--font-size-sm': '13px',
    '--font-size-md': '15px',
    '--font-size-lg': '17px',
    '--font-size-h1': '30px',
    '--font-size-h2': '24px',
    '--font-size-h3': '20px',
    '--font-size-h4': '16px',
    '--margins-xs': '5px',
    '--margins-sm': '10px',
    '--margins-md': '15px',
    '--margins-lg': '20px',
    '--padding-message-content': '7px 13px',
    '--padding-link-preview': '-7px -13px 7px -13px',
    '--border-radius': '5px',
    '--border-radius-message-box': '16px',
    '--main-view-header-height': '63px',
    '--composition-container-height': '60px',
    '--search-input-height': '34px',
    '--default-duration': '0.25s',
    '--green-color': colors_1.COLORS.PRIMARY.GREEN,
    '--blue-color': colors_1.COLORS.PRIMARY.BLUE,
    '--yellow-color': colors_1.COLORS.PRIMARY.YELLOW,
    '--pink-color': colors_1.COLORS.PRIMARY.PINK,
    '--purple-color': colors_1.COLORS.PRIMARY.PURPLE,
    '--orange-color': colors_1.COLORS.PRIMARY.ORANGE,
    '--red-color': colors_1.COLORS.PRIMARY.RED,
    '--transparent-color': colors_1.COLORS.TRANSPARENT,
    '--white-color': colors_1.COLORS.WHITE,
    '--black-color': colors_1.COLORS.BLACK,
    '--grey-color': colors_1.COLORS.GREY,
    '--shadow-color': 'var(--black-color)',
    '--drop-shadow': '0 0 4px 0 var(--shadow-color)',
    '--context-menu-shadow-color': `rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.22)`,
    '--scroll-button-shadow': `0 0 7px 0 rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.5)`,
    '--button-path-default-color': colors_1.COLORS.PATH.DEFAULT,
    '--button-path-connecting-color': colors_1.COLORS.PATH.CONNECTING,
    '--button-path-error-color': colors_1.COLORS.PATH.ERROR,
    '--modal-background-color': `rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.3)`,
    '--modal-drop-shadow': `0px 0px 10px rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.22)`,
    '--lightbox-background-color': `rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.8)`,
    '--lightbox-caption-background-color': 'rgba(192, 192, 192, .40)',
    '--lightbox-icon-stroke-color': 'var(--white-color)',
    '--avatar-border-color': 'var(--transparent-color)',
    '--message-link-preview-background-color': `rgba(${(0, hexColorToRGB_1.hexColorToRGB)(colors_1.COLORS.BLACK)}, 0.06)`,
};
function declareCSSVariables(variables) {
    let output = '';
    for (const [key, value] of Object.entries(variables)) {
        output += `${key}: ${value};\n`;
    }
    return output;
}
exports.declareCSSVariables = declareCSSVariables;
