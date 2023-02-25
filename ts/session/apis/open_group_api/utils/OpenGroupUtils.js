"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenGroupV2 = exports.getOpenGroupV2FromConversationId = exports.getOpenGroupV2ConversationId = exports.prefixify = exports.getCompleteUrlFromRoom = exports.openGroupV2ConversationIdRegex = exports.openGroupPrefixRegex = exports.openGroupPrefix = exports.openGroupV2CompleteURLRegex = exports.openGroupV2ServerUrlRegex = exports.publicKeyParam = exports.publicKeyRegex = exports.roomIdV2Regex = void 0;
const lodash_1 = __importDefault(require("lodash"));
const protocolRegex = new RegExp('https?://');
const dot = '\\.';
const qMark = '\\?';
const hostSegment = '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?';
const hostnameRegex = new RegExp(`(?:${hostSegment}${dot})+${hostSegment}`);
const portRegex = ':[1-9][0-9]{0,4}';
exports.roomIdV2Regex = '[0-9a-zA-Z_-]{1,64}';
exports.publicKeyRegex = '[0-9a-fA-F]{64}';
exports.publicKeyParam = 'public_key=';
exports.openGroupV2ServerUrlRegex = new RegExp(`(?:${protocolRegex.source})?${hostnameRegex.source}(?:${portRegex})?`);
exports.openGroupV2CompleteURLRegex = new RegExp(`^${exports.openGroupV2ServerUrlRegex.source}\/${exports.roomIdV2Regex}${qMark}${exports.publicKeyParam}${exports.publicKeyRegex}$`);
exports.openGroupPrefix = 'publicChat:';
exports.openGroupPrefixRegex = new RegExp(`^${exports.openGroupPrefix}`);
exports.openGroupV2ConversationIdRegex = new RegExp(`${exports.openGroupPrefix}${exports.roomIdV2Regex}@${exports.openGroupV2ServerUrlRegex.source}`);
function getCompleteUrlFromRoom(roomInfos) {
    if (lodash_1.default.isEmpty(roomInfos.serverUrl) ||
        lodash_1.default.isEmpty(roomInfos.roomId) ||
        lodash_1.default.isEmpty(roomInfos.serverPublicKey)) {
        throw new Error('getCompleteUrlFromRoom needs serverPublicKey, roomid and serverUrl to be set');
    }
    return `${roomInfos.serverUrl}/${roomInfos.roomId}?${exports.publicKeyParam}${roomInfos.serverPublicKey}`;
}
exports.getCompleteUrlFromRoom = getCompleteUrlFromRoom;
function prefixify(server, hasSSL = true) {
    const hasPrefix = server.match('^https?://');
    if (hasPrefix) {
        return server;
    }
    return `http${hasSSL ? 's' : ''}://${server}`;
}
exports.prefixify = prefixify;
function getOpenGroupV2ConversationId(serverUrl, roomId) {
    if (!roomId.match(`^${exports.roomIdV2Regex}$`)) {
        throw new Error('getOpenGroupV2ConversationId: Invalid roomId');
    }
    if (!serverUrl.match(exports.openGroupV2ServerUrlRegex)) {
        throw new Error('getOpenGroupV2ConversationId: Invalid serverUrl');
    }
    return `${exports.openGroupPrefix}${roomId}@${serverUrl}`;
}
exports.getOpenGroupV2ConversationId = getOpenGroupV2ConversationId;
function getOpenGroupV2FromConversationId(conversationId) {
    if (isOpenGroupV2(conversationId)) {
        const atIndex = conversationId.indexOf('@');
        const roomId = conversationId.slice(exports.openGroupPrefix.length, atIndex);
        const serverUrl = conversationId.slice(atIndex + 1);
        return {
            serverUrl,
            roomId,
        };
    }
    throw new Error('Not a v2 open group convo id');
}
exports.getOpenGroupV2FromConversationId = getOpenGroupV2FromConversationId;
function isOpenGroupV2(conversationId) {
    return exports.openGroupV2ConversationIdRegex.test(conversationId);
}
exports.isOpenGroupV2 = isOpenGroupV2;
