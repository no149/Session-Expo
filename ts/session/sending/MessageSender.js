"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToOpenGroupV2BlindedRequest = exports.sendToOpenGroupV2 = exports.sendMessageToSnode = exports.send = exports.getMinRetryTimeout = void 0;
const protobuf_1 = require("../../protobuf");
const crypto_1 = require("../crypto");
const p_retry_1 = __importDefault(require("p-retry"));
const types_1 = require("../types");
const OpenGroupMessageV2_1 = require("../apis/open_group_api/opengroupV2/OpenGroupMessageV2");
const String_1 = require("../utils/String");
const BufferPadding_1 = require("../crypto/BufferPadding");
const lodash_1 = __importDefault(require("lodash"));
const SNodeAPI_1 = require("../apis/snode_api/SNodeAPI");
const snodePool_1 = require("../apis/snode_api/snodePool");
const Promise_1 = require("../utils/Promise");
const _1 = require(".");
const data_1 = require("../../../ts/data/data");
const conversations_1 = require("../conversations");
const onionPath_1 = require("../onions/onionPath");
const errors_1 = require("../utils/errors");
const bytebuffer_1 = __importDefault(require("bytebuffer"));
const sogsV3SendMessage_1 = require("../apis/open_group_api/sogsv3/sogsV3SendMessage");
const abort_controller_1 = require("abort-controller");
const DEFAULT_CONNECTIONS = 1;
function overwriteOutgoingTimestampWithNetworkTimestamp(message) {
    const networkTimestamp = (0, SNodeAPI_1.getNowWithNetworkOffset)();
    const { plainTextBuffer } = message;
    const contentDecoded = protobuf_1.SignalService.Content.decode(plainTextBuffer);
    const { dataMessage, dataExtractionNotification, typingMessage } = contentDecoded;
    if (dataMessage && dataMessage.timestamp && dataMessage.timestamp > 0) {
        if (dataMessage.syncTarget) {
            return {
                overRiddenTimestampBuffer: plainTextBuffer,
                networkTimestamp: lodash_1.default.toNumber(dataMessage.timestamp),
            };
        }
        dataMessage.timestamp = networkTimestamp;
    }
    if (dataExtractionNotification &&
        dataExtractionNotification.timestamp &&
        dataExtractionNotification.timestamp > 0) {
        dataExtractionNotification.timestamp = networkTimestamp;
    }
    if (typingMessage && typingMessage.timestamp && typingMessage.timestamp > 0) {
        typingMessage.timestamp = networkTimestamp;
    }
    const overRiddenTimestampBuffer = protobuf_1.SignalService.Content.encode(contentDecoded).finish();
    return { overRiddenTimestampBuffer, networkTimestamp };
}
function getMinRetryTimeout() {
    return 1000;
}
exports.getMinRetryTimeout = getMinRetryTimeout;
async function send(message, attempts = 3, retryMinTimeout, isSyncMessage) {
    return (0, p_retry_1.default)(async () => {
        const recipient = types_1.PubKey.cast(message.device);
        const { encryption, ttl } = message;
        const { overRiddenTimestampBuffer, networkTimestamp, } = overwriteOutgoingTimestampWithNetworkTimestamp(message);
        const { envelopeType, cipherText } = await crypto_1.MessageEncrypter.encrypt(recipient, overRiddenTimestampBuffer, encryption);
        const envelope = await buildEnvelope(envelopeType, recipient.key, networkTimestamp, cipherText);
        const data = wrapEnvelope(envelope);
        const found = await data_1.Data.getMessageById(message.identifier);
        if (found && !found.get('sentSync')) {
            found.set({ sent_at: networkTimestamp });
            await found.commit();
        }
        await _1.MessageSender.sendMessageToSnode(recipient.key, data, ttl, networkTimestamp, isSyncMessage, message.identifier);
        return { wrappedEnvelope: data, effectiveTimestamp: networkTimestamp };
    }, {
        retries: Math.max(attempts - 1, 0),
        factor: 1,
        minTimeout: retryMinTimeout || _1.MessageSender.getMinRetryTimeout(),
    });
}
exports.send = send;
async function sendMessageToSnode(pubKey, data, ttl, timestamp, isSyncMessage, messageId) {
    const data64 = bytebuffer_1.default.wrap(data).toString('base64');
    const swarm = await (0, snodePool_1.getSwarmFor)(pubKey);
    const conversation = (0, conversations_1.getConversationController)().get(pubKey);
    const isClosedGroup = conversation?.isClosedGroup();
    const namespace = isClosedGroup ? -10 : 0;
    const isBetweenBothHF = false;
    const params = {
        pubKey,
        ttl: `${ttl}`,
        timestamp: `${timestamp}`,
        data: data64,
        isSyncMessage,
        messageId,
        namespace,
    };
    const usedNodes = lodash_1.default.slice(swarm, 0, DEFAULT_CONNECTIONS);
    if (!usedNodes || usedNodes.length === 0) {
        throw new errors_1.EmptySwarmError(pubKey, 'Ran out of swarm nodes to query');
    }
    let successfulSendHash;
    const promises = usedNodes.map(async (usedNode) => {
        const successfulSend = await (0, SNodeAPI_1.storeOnNode)(usedNode, params);
        if (isBetweenBothHF && isClosedGroup) {
            window.log.warn('closedGroup and betweenHF case. Forcing duplicating to 0 and -10 inboxes...');
            await (0, SNodeAPI_1.storeOnNode)(usedNode, { ...params, namespace: 0 });
            window.log.warn('closedGroup and betweenHF case. Forcing duplicating to 0 and -10 inboxes done');
        }
        if (successfulSend) {
            if (lodash_1.default.isString(successfulSend)) {
                successfulSendHash = successfulSend;
            }
            return usedNode;
        }
        return undefined;
    });
    let snode;
    try {
        const firstSuccessSnode = await (0, Promise_1.firstTrue)(promises);
        snode = firstSuccessSnode;
    }
    catch (e) {
        const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
        window?.log?.warn(`loki_message:::sendMessage - ${e.code} ${e.message} to ${pubKey} via snode:${snodeStr}`);
        throw e;
    }
    if (messageId && (isSyncMessage || isClosedGroup) && successfulSendHash) {
        const message = await data_1.Data.getMessageById(messageId);
        if (message) {
            await message.updateMessageHash(successfulSendHash);
            await message.commit();
            window?.log?.info(`updated message ${message.get('id')} with hash: ${message.get('messageHash')}`);
        }
    }
    window?.log?.info(`loki_message:::sendMessage - Successfully stored message to ${(0, onionPath_1.ed25519Str)(pubKey)} via ${snode.ip}:${snode.port}`);
}
exports.sendMessageToSnode = sendMessageToSnode;
async function buildEnvelope(type, sskSource, timestamp, content) {
    let source;
    if (type === protobuf_1.SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE) {
        source = sskSource;
    }
    return protobuf_1.SignalService.Envelope.create({
        type,
        source,
        timestamp,
        content,
    });
}
function wrapEnvelope(envelope) {
    const request = protobuf_1.SignalService.WebSocketRequestMessage.create({
        id: 0,
        body: protobuf_1.SignalService.Envelope.encode(envelope).finish(),
        verb: 'PUT',
        path: '/api/v1/message',
    });
    const websocket = protobuf_1.SignalService.WebSocketMessage.create({
        type: protobuf_1.SignalService.WebSocketMessage.Type.REQUEST,
        request,
    });
    return protobuf_1.SignalService.WebSocketMessage.encode(websocket).finish();
}
async function sendToOpenGroupV2(rawMessage, roomInfos, blinded, filesToLink) {
    const paddedBody = (0, BufferPadding_1.addMessagePadding)(rawMessage.plainTextBuffer());
    const v2Message = new OpenGroupMessageV2_1.OpenGroupMessageV2({
        sentTimestamp: (0, SNodeAPI_1.getNowWithNetworkOffset)(),
        base64EncodedData: (0, String_1.fromUInt8ArrayToBase64)(paddedBody),
        filesToLink,
    });
    const msg = await (0, sogsV3SendMessage_1.sendSogsMessageOnionV4)(roomInfos.serverUrl, roomInfos.roomId, new abort_controller_1.AbortController().signal, v2Message, blinded);
    return msg;
}
exports.sendToOpenGroupV2 = sendToOpenGroupV2;
async function sendToOpenGroupV2BlindedRequest(encryptedContent, roomInfos, recipientBlindedId) {
    const v2Message = new OpenGroupMessageV2_1.OpenGroupMessageV2({
        sentTimestamp: (0, SNodeAPI_1.getNowWithNetworkOffset)(),
        base64EncodedData: (0, String_1.fromUInt8ArrayToBase64)(encryptedContent),
    });
    const msg = await (0, sogsV3SendMessage_1.sendMessageOnionV4BlindedRequest)(roomInfos.serverUrl, roomInfos.roomId, new abort_controller_1.AbortController().signal, v2Message, recipientBlindedId);
    return msg;
}
exports.sendToOpenGroupV2BlindedRequest = sendToOpenGroupV2BlindedRequest;
