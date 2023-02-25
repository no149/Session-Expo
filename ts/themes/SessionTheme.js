"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionTheme = void 0;
const react_1 = __importDefault(require("react"));
const styled_components_1 = require("styled-components");
const _1 = require("./");
const globals_1 = require("./globals");
const SessionGlobalStyles = (0, styled_components_1.createGlobalStyle) `
  html {
    ${(0, globals_1.declareCSSVariables)(globals_1.THEME_GLOBALS)}
    ${(0, globals_1.declareCSSVariables)(_1.classicDark)}
  };
`;
const SessionTheme = ({ children }) => (react_1.default.createElement(react_1.default.Fragment, null,
    react_1.default.createElement(SessionGlobalStyles, null),
    children));
exports.SessionTheme = SessionTheme;
