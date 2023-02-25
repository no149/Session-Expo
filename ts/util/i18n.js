"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEmojiPanelI18n = exports.langNotSupportedMessageShown = exports.setupi18n = void 0;
const setupi18n = (locale, messages) => {
    if (!locale) {
        throw new Error('i18n: locale parameter is required');
    }
    if (!messages) {
        throw new Error('i18n: messages parameter is required');
    }
    function getMessage(key, substitutions) {
        const message = messages[key];
        if (!message) {
            (window.log.error || console.log)(`i18n: Attempted to get translation for nonexistent key '${key}'`);
            return '';
        }
        if (Array.isArray(substitutions)) {
            const replacedNameDollarSign = message.replaceAll('$', 'ￗ');
            const substituted = substitutions.reduce((result, substitution) => result.replace(/ￗ.+?ￗ/, substitution), replacedNameDollarSign);
            return substituted.replaceAll('ￗ', '$');
        }
        else if (substitutions) {
            return message.replace(/\$.+?\$/, substitutions);
        }
        return message;
    }
    getMessage.getLocale = () => locale;
    return getMessage;
};
exports.setupi18n = setupi18n;
exports.langNotSupportedMessageShown = false;
const loadEmojiPanelI18n = async () => {
    if (!window) {
        return undefined;
    }
    const lang = window.i18n.getLocale();
    if (lang !== 'en') {
        try {
            const langData = await Promise.resolve().then(() => __importStar(require(`@emoji-mart/data/i18n/${lang}.json`)));
            return langData;
        }
        catch (err) {
            if (!exports.langNotSupportedMessageShown) {
                window?.log?.warn('Language is not supported by emoji-mart package. See https://github.com/missive/emoji-mart/tree/main/packages/emoji-mart-data/i18n');
                exports.langNotSupportedMessageShown = true;
            }
        }
    }
};
exports.loadEmojiPanelI18n = loadEmojiPanelI18n;
