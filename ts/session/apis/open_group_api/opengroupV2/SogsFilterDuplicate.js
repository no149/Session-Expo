"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterDuplicatesFromDbAndIncomingV4 = exports.filterDuplicatesFromDbAndIncoming = void 0;
const lodash_1 = __importDefault(require("lodash"));
const data_1 = require("../../../../data/data");
const filterDuplicatesFromDbAndIncoming = async (newMessages) => {
    const start = Date.now();
    const filtered = lodash_1.default.uniqWith(newMessages, (a, b) => {
        return (Boolean(a.sender) &&
            Boolean(a.sentTimestamp) &&
            a.sender === b.sender &&
            a.sentTimestamp === b.sentTimestamp);
    }).filter(m => Boolean(m.sender));
    const filteredInDb = await data_1.Data.filterAlreadyFetchedOpengroupMessage(filtered.map(m => {
        return { sender: m.sender, serverTimestamp: m.sentTimestamp };
    }));
    window.log.debug(`[perf] filterDuplicatesFromDbAndIncoming took ${Date.now() - start}ms for ${newMessages.length} messages`);
    const opengroupMessagesFiltered = filteredInDb?.map(f => {
        return newMessages.find(m => m.sender === f.sender && m.sentTimestamp === f.serverTimestamp);
    });
    return lodash_1.default.compact(opengroupMessagesFiltered) || [];
};
exports.filterDuplicatesFromDbAndIncoming = filterDuplicatesFromDbAndIncoming;
const filterDuplicatesFromDbAndIncomingV4 = async (newMessages) => {
    const start = Date.now();
    const filtered = lodash_1.default.uniqWith(newMessages, (a, b) => {
        return (Boolean(a.session_id) &&
            Boolean(a.posted) &&
            a.session_id === b.session_id &&
            a.posted === b.posted);
    }).filter(m => Boolean(m.session_id && m.posted));
    const filteredInDb = await data_1.Data.filterAlreadyFetchedOpengroupMessage(filtered.map(m => {
        return { sender: m.session_id, serverTimestamp: m.posted };
    }));
    window.log.debug(`[perf] filterDuplicatesFromDbAndIncomingV4 took ${Date.now() - start}ms for ${newMessages.length} messages;   after deduplication:${filteredInDb.length} `);
    const opengroupMessagesV4Filtered = filteredInDb?.map(f => {
        return newMessages.find(m => m.session_id === f.sender && m.posted === f.serverTimestamp);
    });
    return lodash_1.default.compact(opengroupMessagesV4Filtered) || [];
};
exports.filterDuplicatesFromDbAndIncomingV4 = filterDuplicatesFromDbAndIncomingV4;
