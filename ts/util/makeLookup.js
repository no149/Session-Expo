"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLookup = void 0;
const lodash_1 = require("lodash");
function makeLookup(items, key) {
    const pairs = (0, lodash_1.map)(items, item => [item[key], item]);
    return (0, lodash_1.fromPairs)(pairs);
}
exports.makeLookup = makeLookup;
