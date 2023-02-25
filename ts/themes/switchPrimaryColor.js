"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchPrimaryColorTo = exports.findPrimaryColorId = void 0;
const lodash_1 = require("lodash");
const primaryColor_1 = require("../state/ducks/primaryColor");
const colors_1 = require("./constants/colors");
function findPrimaryColorId(hexCode) {
    const primaryColors = (0, colors_1.getPrimaryColors)();
    return (0, lodash_1.find)(primaryColors, { color: hexCode })?.id;
}
exports.findPrimaryColorId = findPrimaryColorId;
async function switchPrimaryColorTo(color, dispatch) {
    if (window.Events) {
        await window.Events.setPrimaryColorSetting(color);
    }
    document.documentElement.style.setProperty('--primary-color', colors_1.COLORS.PRIMARY[`${color.toUpperCase()}`]);
    dispatch?.((0, primaryColor_1.applyPrimaryColor)(color));
}
exports.switchPrimaryColorTo = switchPrimaryColorTo;
