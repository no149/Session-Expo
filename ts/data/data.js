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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeItemById = exports.getAllItems = exports.getItemById = exports.createOrUpdateItem = exports.SNODE_POOL_ITEM_ID = exports.Data = exports.hasLinkPreviewPopupBeenDisplayed = exports.lastAvatarUploadTimestamp = exports.hasSyncedInitialConfigurationItem = void 0;
const lodash_1 = __importDefault(require("lodash"));
const conversation_1 = require("../models/conversation");
const conversationAttributes_1 = require("../models/conversationAttributes");
const message_1 = require("../models/message");
const conversations_1 = require("../session/conversations");
const crypto_1 = require("../session/crypto");
const expiringMessages_1 = require("../util/expiringMessages");
const storage_1 = require("../util/storage");
const channels_1 = require("./channels");
const dataInit = __importStar(require("./dataInit"));
const String_1 = require("../session/utils/String");
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';
exports.hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
exports.lastAvatarUploadTimestamp = 'lastAvatarUploadTimestamp';
exports.hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';
function _cleanData(data) {
    const keys = Object.keys(data);
    for (let index = 0, max = keys.length; index < max; index += 1) {
        const key = keys[index];
        const value = data[key];
        if (value === null || value === undefined) {
            continue;
        }
        if (lodash_1.default.isFunction(value.toNumber)) {
            data[key] = value.toNumber();
        }
        else if (lodash_1.default.isFunction(value)) {
            delete data[key];
        }
        else if (Array.isArray(value)) {
            data[key] = value.map(_cleanData);
        }
        else if (lodash_1.default.isObject(value) && value instanceof File) {
            data[key] = { name: value.name, path: value.path, size: value.size, type: value.type };
        }
        else if (lodash_1.default.isObject(value) && value instanceof ArrayBuffer) {
            window.log.error('Trying to save an ArrayBuffer to the db is most likely an error. This specific field should be removed before the cleanData call');
            continue;
        }
        else if (lodash_1.default.isObject(value)) {
            data[key] = _cleanData(value);
        }
        else if (lodash_1.default.isBoolean(value)) {
            data[key] = value ? 1 : 0;
        }
        else if (typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean') {
            window?.log?.info(`_cleanData: key ${key} had type ${typeof value}`);
        }
    }
    return data;
}
exports.Data = {
    shutdown,
    close,
    removeDB,
    getPasswordHash,
    createOrUpdateItem,
    getItemById,
    getAllItems,
    removeItemById,
    getGuardNodes,
    updateGuardNodes,
    generateAttachmentKeyIfEmpty,
    getSwarmNodesForPubkey,
    updateSwarmNodesForPubkey,
    getAllEncryptionKeyPairsForGroup,
    getLatestClosedGroupEncryptionKeyPair,
    addClosedGroupEncryptionKeyPair,
    removeAllClosedGroupEncryptionKeyPairs,
    saveConversation,
    getConversationById,
    removeConversation,
    getAllConversations,
    getPubkeysInPublicConversation,
    searchConversations,
    searchMessages,
    searchMessagesInConversation,
    cleanSeenMessages,
    cleanLastHashes,
    saveSeenMessageHashes,
    updateLastHash,
    saveMessage,
    saveMessages,
    removeMessage,
    removeMessagesByIds,
    getMessageIdsFromServerIds,
    getMessageById,
    getMessageBySenderAndSentAt,
    getMessageByServerId,
    filterAlreadyFetchedOpengroupMessage,
    getMessageBySenderAndTimestamp,
    getUnreadByConversation,
    getUnreadCountByConversation,
    markAllAsReadByConversationNoExpiration,
    getMessageCountByType,
    getMessagesByConversation,
    getLastMessagesByConversation,
    getLastMessageIdInConversation,
    getLastMessageInConversation,
    getOldestMessageInConversation,
    getMessageCount,
    getFirstUnreadMessageIdInConversation,
    getFirstUnreadMessageWithMention,
    hasConversationOutgoingMessage,
    getLastHashBySnode,
    getSeenMessagesByHashList,
    removeAllMessagesInConversation,
    getMessagesBySentAt,
    getExpiredMessages,
    getOutgoingWithoutExpiresAt,
    getNextExpiringMessage,
    getUnprocessedCount,
    getAllUnprocessed,
    getUnprocessedById,
    saveUnprocessed,
    updateUnprocessedAttempts,
    updateUnprocessedWithData,
    removeUnprocessed,
    removeAllUnprocessed,
    getNextAttachmentDownloadJobs,
    saveAttachmentDownloadJob,
    setAttachmentDownloadJobPending,
    resetAttachmentDownloadPending,
    removeAttachmentDownloadJob,
    removeAllAttachmentDownloadJobs,
    removeAll,
    removeAllConversations,
    cleanupOrphanedAttachments,
    removeOtherData,
    getMessagesWithVisualMediaAttachments,
    getMessagesWithFileAttachments,
    getSnodePoolFromDb,
    updateSnodePoolOnDb,
    fillWithTestData,
};
async function shutdown() {
    await dataInit.shutdown();
    await close();
}
async function close() {
    await channels_1.channels.close();
}
async function removeDB() {
    await channels_1.channels.removeDB();
}
async function getPasswordHash() {
    return channels_1.channels.getPasswordHash();
}
async function getGuardNodes() {
    return channels_1.channels.getGuardNodes();
}
async function updateGuardNodes(nodes) {
    return channels_1.channels.updateGuardNodes(nodes);
}
async function generateAttachmentKeyIfEmpty() {
    const existingKey = await getItemById('local_attachment_encrypted_key');
    if (!existingKey) {
        const sodium = await (0, crypto_1.getSodiumRenderer)();
        const encryptingKey = sodium.to_hex(sodium.randombytes_buf(32));
        await createOrUpdateItem({
            id: 'local_attachment_encrypted_key',
            value: encryptingKey,
        });
        await storage_1.Storage.put('local_attachment_encrypted_key', encryptingKey);
    }
}
async function getSwarmNodesForPubkey(pubkey) {
    return channels_1.channels.getSwarmNodesForPubkey(pubkey);
}
async function updateSwarmNodesForPubkey(pubkey, snodeEdKeys) {
    await channels_1.channels.updateSwarmNodesForPubkey(pubkey, snodeEdKeys);
}
async function getAllEncryptionKeyPairsForGroup(groupPublicKey) {
    const pubkey = groupPublicKey.key || groupPublicKey;
    return channels_1.channels.getAllEncryptionKeyPairsForGroup(pubkey);
}
async function getLatestClosedGroupEncryptionKeyPair(groupPublicKey) {
    return channels_1.channels.getLatestClosedGroupEncryptionKeyPair(groupPublicKey);
}
async function addClosedGroupEncryptionKeyPair(groupPublicKey, keypair) {
    await channels_1.channels.addClosedGroupEncryptionKeyPair(groupPublicKey, keypair);
}
async function removeAllClosedGroupEncryptionKeyPairs(groupPublicKey) {
    return channels_1.channels.removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
}
async function saveConversation(data) {
    const cleaned = _cleanData(data);
    if (cleaned.active_at === -Infinity) {
        cleaned.active_at = Date.now();
    }
    await channels_1.channels.saveConversation(cleaned);
}
async function getConversationById(id) {
    const data = await channels_1.channels.getConversationById(id);
    if (data) {
        return new conversation_1.ConversationModel(data);
    }
    return undefined;
}
async function removeConversation(id) {
    const existing = await getConversationById(id);
    if (existing) {
        await channels_1.channels.removeConversation(id);
        await existing.cleanup();
    }
}
async function getAllConversations() {
    const conversations = await channels_1.channels.getAllConversations();
    const collection = new conversation_1.ConversationCollection();
    collection.add(conversations);
    return collection;
}
async function getPubkeysInPublicConversation(id) {
    return channels_1.channels.getPubkeysInPublicConversation(id);
}
async function searchConversations(query) {
    const conversations = await channels_1.channels.searchConversations(query);
    return conversations;
}
async function searchMessages(query, limit) {
    const messages = (await channels_1.channels.searchMessages(query, limit));
    return lodash_1.default.uniqWith(messages, (left, right) => {
        return left.id === right.id;
    });
}
async function searchMessagesInConversation(query, conversationId, limit) {
    const messages = (await channels_1.channels.searchMessagesInConversation(query, conversationId, limit));
    return messages;
}
async function cleanSeenMessages() {
    await channels_1.channels.cleanSeenMessages();
}
async function cleanLastHashes() {
    await channels_1.channels.cleanLastHashes();
}
async function saveSeenMessageHashes(data) {
    await channels_1.channels.saveSeenMessageHashes(_cleanData(data));
}
async function updateLastHash(data) {
    await channels_1.channels.updateLastHash(_cleanData(data));
}
async function saveMessage(data) {
    const cleanedData = _cleanData(data);
    const id = await channels_1.channels.saveMessage(cleanedData);
    expiringMessages_1.ExpirationTimerOptions.updateExpiringMessagesCheck();
    return id;
}
async function saveMessages(arrayOfMessages) {
    await channels_1.channels.saveMessages(_cleanData(arrayOfMessages));
}
async function removeMessage(id) {
    const message = await getMessageById(id, true);
    if (message) {
        await channels_1.channels.removeMessage(id);
        await message.cleanup();
    }
}
async function removeMessagesByIds(ids) {
    await channels_1.channels.removeMessagesByIds(ids);
}
async function getMessageIdsFromServerIds(serverIds, conversationId) {
    return channels_1.channels.getMessageIdsFromServerIds(serverIds, conversationId);
}
async function getMessageById(id, skipTimerInit = false) {
    const message = await channels_1.channels.getMessageById(id);
    if (!message) {
        return null;
    }
    if (skipTimerInit) {
        message.skipTimerInit = skipTimerInit;
    }
    return new message_1.MessageModel(message);
}
async function getMessageBySenderAndSentAt({ source, sentAt, }) {
    const messages = await channels_1.channels.getMessageBySenderAndSentAt({
        source,
        sentAt,
    });
    if (!messages || !messages.length) {
        return null;
    }
    return new message_1.MessageModel(messages[0]);
}
async function getMessageByServerId(serverId, skipTimerInit = false) {
    const message = await channels_1.channels.getMessageByServerId(serverId);
    if (!message) {
        return null;
    }
    if (skipTimerInit) {
        message.skipTimerInit = skipTimerInit;
    }
    return new message_1.MessageModel(message);
}
async function filterAlreadyFetchedOpengroupMessage(msgDetails) {
    const msgDetailsNotAlreadyThere = await channels_1.channels.filterAlreadyFetchedOpengroupMessage(msgDetails);
    return msgDetailsNotAlreadyThere || [];
}
async function getMessageBySenderAndTimestamp({ source, timestamp, }) {
    const messages = await channels_1.channels.getMessageBySenderAndTimestamp({
        source,
        timestamp,
    });
    if (!messages || !messages.length) {
        return null;
    }
    return new message_1.MessageModel(messages[0]);
}
async function getUnreadByConversation(conversationId) {
    const messages = await channels_1.channels.getUnreadByConversation(conversationId);
    return new message_1.MessageCollection(messages);
}
async function markAllAsReadByConversationNoExpiration(conversationId, returnMessagesUpdated) {
    console.time('markAllAsReadByConversationNoExpiration');
    const messagesIds = await channels_1.channels.markAllAsReadByConversationNoExpiration(conversationId, returnMessagesUpdated);
    console.timeEnd('markAllAsReadByConversationNoExpiration');
    return messagesIds;
}
async function getUnreadCountByConversation(conversationId) {
    return channels_1.channels.getUnreadCountByConversation(conversationId);
}
async function getMessageCountByType(conversationId, type) {
    return channels_1.channels.getMessageCountByType(conversationId, type);
}
async function getMessagesByConversation(conversationId, { skipTimerInit = false, messageId = null }) {
    const messages = await channels_1.channels.getMessagesByConversation(conversationId, {
        messageId,
    });
    if (skipTimerInit) {
        for (const message of messages) {
            message.skipTimerInit = skipTimerInit;
        }
    }
    return new message_1.MessageCollection(messages);
}
async function getLastMessagesByConversation(conversationId, limit, skipTimerInit) {
    const messages = await channels_1.channels.getLastMessagesByConversation(conversationId, limit);
    if (skipTimerInit) {
        for (const message of messages) {
            message.skipTimerInit = skipTimerInit;
        }
    }
    return new message_1.MessageCollection(messages);
}
async function getLastMessageIdInConversation(conversationId) {
    const collection = await getLastMessagesByConversation(conversationId, 1, true);
    return collection.models.length ? collection.models[0].id : null;
}
async function getLastMessageInConversation(conversationId) {
    const messages = await channels_1.channels.getLastMessagesByConversation(conversationId, 1);
    for (const message of messages) {
        message.skipTimerInit = true;
    }
    const collection = new message_1.MessageCollection(messages);
    return collection.length ? collection.models[0] : null;
}
async function getOldestMessageInConversation(conversationId) {
    const messages = await channels_1.channels.getOldestMessageInConversation(conversationId);
    for (const message of messages) {
        message.skipTimerInit = true;
    }
    const collection = new message_1.MessageCollection(messages);
    return collection.length ? collection.models[0] : null;
}
async function getMessageCount() {
    return channels_1.channels.getMessageCount();
}
async function getFirstUnreadMessageIdInConversation(conversationId) {
    return channels_1.channels.getFirstUnreadMessageIdInConversation(conversationId);
}
async function getFirstUnreadMessageWithMention(conversationId, ourPubkey) {
    return channels_1.channels.getFirstUnreadMessageWithMention(conversationId, ourPubkey);
}
async function hasConversationOutgoingMessage(conversationId) {
    return channels_1.channels.hasConversationOutgoingMessage(conversationId);
}
async function getLastHashBySnode(convoId, snode, namespace) {
    return channels_1.channels.getLastHashBySnode(convoId, snode, namespace);
}
async function getSeenMessagesByHashList(hashes) {
    return channels_1.channels.getSeenMessagesByHashList(hashes);
}
async function removeAllMessagesInConversation(conversationId) {
    let messages;
    do {
        messages = await getLastMessagesByConversation(conversationId, 500, false);
        if (!messages.length) {
            return;
        }
        const ids = messages.map(message => message.id);
        await Promise.all(messages.map(message => message.cleanup()));
        await channels_1.channels.removeMessagesByIds(ids);
    } while (messages.length > 0);
}
async function getMessagesBySentAt(sentAt) {
    const messages = await channels_1.channels.getMessagesBySentAt(sentAt);
    return new message_1.MessageCollection(messages);
}
async function getExpiredMessages() {
    const messages = await channels_1.channels.getExpiredMessages();
    return new message_1.MessageCollection(messages);
}
async function getOutgoingWithoutExpiresAt() {
    const messages = await channels_1.channels.getOutgoingWithoutExpiresAt();
    return new message_1.MessageCollection(messages);
}
async function getNextExpiringMessage() {
    const messages = await channels_1.channels.getNextExpiringMessage();
    return new message_1.MessageCollection(messages);
}
async function getUnprocessedCount() {
    return channels_1.channels.getUnprocessedCount();
}
async function getAllUnprocessed() {
    return channels_1.channels.getAllUnprocessed();
}
async function getUnprocessedById(id) {
    return channels_1.channels.getUnprocessedById(id);
}
async function saveUnprocessed(data) {
    const id = await channels_1.channels.saveUnprocessed(_cleanData(data));
    return id;
}
async function updateUnprocessedAttempts(id, attempts) {
    await channels_1.channels.updateUnprocessedAttempts(id, attempts);
}
async function updateUnprocessedWithData(id, data) {
    await channels_1.channels.updateUnprocessedWithData(id, data);
}
async function removeUnprocessed(id) {
    await channels_1.channels.removeUnprocessed(id);
}
async function removeAllUnprocessed() {
    await channels_1.channels.removeAllUnprocessed();
}
async function getNextAttachmentDownloadJobs(limit) {
    return channels_1.channels.getNextAttachmentDownloadJobs(limit);
}
async function saveAttachmentDownloadJob(job) {
    await channels_1.channels.saveAttachmentDownloadJob(job);
}
async function setAttachmentDownloadJobPending(id, pending) {
    await channels_1.channels.setAttachmentDownloadJobPending(id, pending ? 1 : 0);
}
async function resetAttachmentDownloadPending() {
    await channels_1.channels.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id) {
    await channels_1.channels.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs() {
    await channels_1.channels.removeAllAttachmentDownloadJobs();
}
async function removeAll() {
    await channels_1.channels.removeAll();
}
async function removeAllConversations() {
    await channels_1.channels.removeAllConversations();
}
async function cleanupOrphanedAttachments() {
    await dataInit.callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}
async function removeOtherData() {
    await Promise.all([
        dataInit.callChannel(ERASE_SQL_KEY),
        dataInit.callChannel(ERASE_ATTACHMENTS_KEY),
    ]);
}
async function getMessagesWithVisualMediaAttachments(conversationId, limit) {
    return channels_1.channels.getMessagesWithVisualMediaAttachments(conversationId, limit);
}
async function getMessagesWithFileAttachments(conversationId, limit) {
    return channels_1.channels.getMessagesWithFileAttachments(conversationId, limit);
}
exports.SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';
async function getSnodePoolFromDb() {
    const snodesJson = await exports.Data.getItemById(exports.SNODE_POOL_ITEM_ID);
    if (!snodesJson || !snodesJson.value) {
        return null;
    }
    return JSON.parse(snodesJson.value);
}
async function updateSnodePoolOnDb(snodesAsJsonString) {
    await exports.Data.createOrUpdateItem({ id: exports.SNODE_POOL_ITEM_ID, value: snodesAsJsonString });
}
async function fillWithTestData(convs, msgs) {
    const newConvos = [];
    for (let convsAddedCount = 0; convsAddedCount < convs; convsAddedCount++) {
        const convoId = `${Date.now()} + ${convsAddedCount}`;
        const newConvo = await (0, conversations_1.getConversationController)().getOrCreateAndWait(convoId, conversationAttributes_1.ConversationTypeEnum.PRIVATE);
        newConvos.push(newConvo);
    }
    for (let msgsAddedCount = 0; msgsAddedCount < msgs; msgsAddedCount++) {
        const convoToChoose = newConvos[Math.floor(Math.random() * newConvos.length)];
        const direction = Math.random() > 0.5 ? 'outgoing' : 'incoming';
        const body = `spongebob ${new Date().toString()}`;
        if (direction === 'outgoing') {
            await convoToChoose.addSingleOutgoingMessage({
                body,
            });
        }
        else {
            await convoToChoose.addSingleIncomingMessage({
                source: convoToChoose.id,
                body,
            });
        }
    }
}
function keysToArrayBuffer(keys, data) {
    const updated = lodash_1.default.cloneDeep(data);
    for (let i = 0, max = keys.length; i < max; i += 1) {
        const key = keys[i];
        const value = lodash_1.default.get(data, key);
        if (value) {
            lodash_1.default.set(updated, key, (0, String_1.fromBase64ToArrayBuffer)(value));
        }
    }
    return updated;
}
function keysFromArrayBuffer(keys, data) {
    const updated = lodash_1.default.cloneDeep(data);
    for (let i = 0, max = keys.length; i < max; i += 1) {
        const key = keys[i];
        const value = lodash_1.default.get(data, key);
        if (value) {
            lodash_1.default.set(updated, key, (0, String_1.fromArrayBufferToBase64)(value));
        }
    }
    return updated;
}
const ITEM_KEYS = {
    identityKey: ['value.pubKey', 'value.privKey'],
    profileKey: ['value'],
};
async function createOrUpdateItem(data) {
    const { id } = data;
    if (!id) {
        throw new Error('createOrUpdateItem: Provided data did not have a truthy id');
    }
    const keys = ITEM_KEYS[id];
    const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;
    await channels_1.channels.createOrUpdateItem(updated);
}
exports.createOrUpdateItem = createOrUpdateItem;
async function getItemById(id) {
    const keys = ITEM_KEYS[id];
    const data = await channels_1.channels.getItemById(id);
    return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}
exports.getItemById = getItemById;
async function getAllItems() {
    const items = await channels_1.channels.getAllItems();
    return lodash_1.default.map(items, item => {
        const { id } = item;
        const keys = ITEM_KEYS[id];
        return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
    });
}
exports.getAllItems = getAllItems;
async function removeItemById(id) {
    await channels_1.channels.removeItemById(id);
}
exports.removeItemById = removeItemById;
