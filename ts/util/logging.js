"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = void 0;
const electron_1 = require("electron");
const lodash_1 = __importDefault(require("lodash"));
const privacy_1 = require("./privacy");
const ipc = electron_1.ipcRenderer;
const BLANK_LEVEL = '     ';
const LEVELS = {
    60: 'fatal',
    50: 'error',
    40: 'warn ',
    30: 'info ',
    20: 'debug',
    10: 'trace',
};
function now() {
    const date = new Date();
    return date.toJSON();
}
function cleanArgsForIPC(args) {
    const str = args.map((item) => {
        if (typeof item !== 'string') {
            try {
                return JSON.stringify(item);
            }
            catch (error) {
                return item;
            }
        }
        return item;
    });
    return str.join(' ');
}
function log(...args) {
    logAtLevel('info', 'INFO ', ...args);
}
if (window.console) {
    console._log = console.log;
    console.log = log;
    console._trace = console.trace;
    console._debug = console.debug;
    console._info = console.info;
    console._warn = console.warn;
    console._error = console.error;
    console._fatal = console.error;
}
function getHeader() {
    let header = window.navigator.userAgent;
    header += ` node/${window?.getNodeVersion()}`;
    header += ` env/${window?.getEnvironment()}`;
    return header;
}
function getLevel(level) {
    const text = LEVELS[level];
    if (!text) {
        return BLANK_LEVEL;
    }
    return text.toUpperCase();
}
function formatLine(entry) {
    return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}
function format(entries) {
    return (0, privacy_1.redactAll)(entries.map(formatLine).join('\n'));
}
async function fetch() {
    return new Promise(resolve => {
        ipc.on('fetched-log', (_event, text) => {
            const result = `${getHeader()}\n${format(text)}`;
            resolve(result);
        });
        ipc.send('fetch-log');
    });
}
exports.fetch = fetch;
const development = window && window?.getEnvironment && window?.getEnvironment() !== 'production';
function logAtLevel(level, prefix, ...args) {
    if (development) {
        const fn = `_${level}`;
        console[fn](prefix, now(), ...args);
    }
    else {
        console._log(prefix, now(), ...args);
    }
    const str = cleanArgsForIPC(args);
    const logText = (0, privacy_1.redactAll)(str);
    ipc.send(`log-${level}`, logText);
}
window.log = {
    fatal: lodash_1.default.partial(logAtLevel, 'fatal', 'FATAL'),
    error: lodash_1.default.partial(logAtLevel, 'error', 'ERROR'),
    warn: lodash_1.default.partial(logAtLevel, 'warn', 'WARN '),
    info: lodash_1.default.partial(logAtLevel, 'info', 'INFO '),
    debug: lodash_1.default.partial(logAtLevel, 'debug', 'DEBUG'),
    trace: lodash_1.default.partial(logAtLevel, 'trace', 'TRACE'),
};
window.onerror = (_message, _script, _line, _col, error) => {
    const errorInfo = error && error.stack ? error.stack : JSON.stringify(error);
    window.log.error(`Top-level unhandled error: ${errorInfo}`);
};
window.addEventListener('unhandledrejection', rejectionEvent => {
    const error = rejectionEvent.reason;
    const errorInfo = error && error.stack ? error.stack : error;
    window.log.error('Top-level unhandled promise rejection:', errorInfo);
});
