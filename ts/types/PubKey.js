"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubKey = exports.KeyPrefixType = exports.getStoragePubKey = void 0;
const String_1 = require("../utils/String");
const getStoragePubKey = (key) => key;
exports.getStoragePubKey = getStoragePubKey;
var KeyPrefixType;
(function (KeyPrefixType) {
    KeyPrefixType["unblinded"] = "00";
    KeyPrefixType["standard"] = "05";
    KeyPrefixType["blinded"] = "15";
})(KeyPrefixType = exports.KeyPrefixType || (exports.KeyPrefixType = {}));
class PubKey {
    static PUBKEY_LEN = 66;
    static PUBKEY_LEN_NO_PREFIX = PubKey.PUBKEY_LEN - 2;
    static HEX = '[0-9a-fA-F]';
    static regexForPubkeys = `(([0-1]5)?${PubKey.HEX}{${this.PUBKEY_LEN_NO_PREFIX}})`;
    static PREFIX_GROUP_TEXTSECURE = '__textsecure_group__!';
    static regex = new RegExp(`^(${PubKey.PREFIX_GROUP_TEXTSECURE})?(${KeyPrefixType.standard}|${KeyPrefixType.blinded}|${KeyPrefixType.unblinded})?(${PubKey.HEX}{64}|${PubKey.HEX}{32})$`);
    key;
    constructor(pubkeyString) {
        if (!PubKey.validate(pubkeyString)) {
            throw new Error(`Invalid pubkey string passed: ${pubkeyString}`);
        }
        this.key = pubkeyString.toLowerCase();
    }
    static cast(value) {
        if (!value) {
            throw new Error(`Invalid pubkey string passed: ${value}`);
        }
        return typeof value === 'string' ? new PubKey(value) : value;
    }
    static shorten(value) {
        const valAny = value;
        const pk = value instanceof PubKey ? valAny.key : value;
        if (!pk || pk.length < 8) {
            throw new Error('PubkKey.shorten was given an invalid PubKey to shorten.');
        }
        return `(${pk.substring(0, 4)}...${pk.substring(pk.length - 4)})`;
    }
    static from(pubkeyString) {
        if (PubKey.validate(pubkeyString)) {
            return new PubKey(pubkeyString);
        }
        return undefined;
    }
    static normalize(pubkeyString) {
        if (PubKey.validate(pubkeyString)) {
            return pubkeyString;
        }
        return undefined;
    }
    static validate(pubkeyString) {
        return this.regex.test(pubkeyString);
    }
    static validateWithErrorNoBlinding(pubkey) {
        const isHex = pubkey.replace(/[\s]*/g, '').match(/^[0-9a-fA-F]+$/);
        if (!isHex) {
            return window.i18n('invalidSessionId');
        }
        const len = pubkey.length;
        const isProdOrDevValid = len === 33 * 2 && /^05/.test(pubkey);
        if (!isProdOrDevValid) {
            return window.i18n('invalidPubkeyFormat');
        }
        return undefined;
    }
    static isValidPrefixAndLength(keyWithOrWithoutPrefix) {
        return (keyWithOrWithoutPrefix.length === 66 &&
            (keyWithOrWithoutPrefix.startsWith(KeyPrefixType.blinded) ||
                keyWithOrWithoutPrefix.startsWith(KeyPrefixType.standard)));
    }
    static removePrefixIfNeeded(keyWithOrWithoutPrefix) {
        if (this.isValidPrefixAndLength(keyWithOrWithoutPrefix)) {
            const keyWithoutPrefix = keyWithOrWithoutPrefix.substring(2);
            return keyWithoutPrefix;
        }
        return keyWithOrWithoutPrefix;
    }
    static getPrefix(key) {
        if (this.isValidPrefixAndLength(key)) {
            return key.substring(0, 2);
        }
        else {
            return null;
        }
    }
    static addTextSecurePrefixIfNeeded(keyWithOrWithoutPrefix) {
        const key = keyWithOrWithoutPrefix instanceof PubKey
            ? keyWithOrWithoutPrefix.key
            : keyWithOrWithoutPrefix;
        if (!key.startsWith(PubKey.PREFIX_GROUP_TEXTSECURE)) {
            return PubKey.PREFIX_GROUP_TEXTSECURE + key;
        }
        return key;
    }
    static removeTextSecurePrefixIfNeeded(keyWithOrWithoutPrefix) {
        const key = keyWithOrWithoutPrefix instanceof PubKey
            ? keyWithOrWithoutPrefix.key
            : keyWithOrWithoutPrefix;
        return key.replace(PubKey.PREFIX_GROUP_TEXTSECURE, '');
    }
    static isEqual(comparator1, comparator2) {
        return PubKey.cast(comparator1).isEqual(comparator2);
    }
    isEqual(comparator) {
        return comparator instanceof PubKey
            ? this.key === comparator.key
            : this.key === comparator.toLowerCase();
    }
    withoutPrefix() {
        return PubKey.removePrefixIfNeeded(this.key);
    }
    toArray() {
        return (0, String_1.fromHexToArray)(this.key);
    }
    withoutPrefixToArray() {
        return (0, String_1.fromHexToArray)(PubKey.removePrefixIfNeeded(this.key));
    }
    static hasBlindedPrefix(key) {
        return key.startsWith(KeyPrefixType.blinded);
    }
}
exports.PubKey = PubKey;
