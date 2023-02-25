"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchThemeTo = void 0;
const theme_1 = require("../state/ducks/theme");
const _1 = require(".");
const colors_1 = require("./constants/colors");
const variableColors_1 = require("./variableColors");
const switchPrimaryColor_1 = require("./switchPrimaryColor");
async function switchThemeTo(props) {
    const { theme, mainWindow, usePrimaryColor, dispatch } = props;
    let newTheme = null;
    switch (theme) {
        case 'classic-dark':
            (0, variableColors_1.loadThemeColors)(_1.classicDark);
            newTheme = 'classic-dark';
            break;
        case 'classic-light':
            (0, variableColors_1.loadThemeColors)(_1.classicLight);
            newTheme = 'classic-light';
            break;
        case 'ocean-dark':
            (0, variableColors_1.loadThemeColors)(_1.oceanDark);
            newTheme = 'ocean-dark';
            break;
        case 'ocean-light':
            (0, variableColors_1.loadThemeColors)(_1.oceanLight);
            newTheme = 'ocean-light';
            break;
        default:
            window.log.warn('Unsupported theme: ', theme);
    }
    if (newTheme) {
        if (mainWindow) {
            await window.setTheme(theme);
        }
        if (dispatch) {
            dispatch((0, theme_1.applyTheme)(newTheme));
            if (usePrimaryColor) {
                const primaryColor = window.Events.getPrimaryColorSetting();
                await (0, switchPrimaryColor_1.switchPrimaryColorTo)(primaryColor, dispatch);
            }
            else {
                const defaultPrimaryColor = (0, switchPrimaryColor_1.findPrimaryColorId)(colors_1.THEMES[(0, colors_1.convertThemeStateToName)(newTheme)].PRIMARY);
                if (defaultPrimaryColor) {
                    await (0, switchPrimaryColor_1.switchPrimaryColorTo)(defaultPrimaryColor, dispatch);
                }
            }
        }
    }
}
exports.switchThemeTo = switchThemeTo;
