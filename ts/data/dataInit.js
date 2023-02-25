"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initData = exports.callChannel = exports.shutdown = exports.jobs = void 0;
const electron_1 = require("electron");
const channels_1 = require("./channels");
const channelsToMakeForOpengroupV2 = [
    'getAllV2OpenGroupRooms',
    'getV2OpenGroupRoom',
    'saveV2OpenGroupRoom',
    'removeV2OpenGroupRoom',
    'getAllOpenGroupV2Conversations',
];
const channelsToMake = new Set([
    'shutdown',
    'close',
    'removeDB',
    'getPasswordHash',
    'getGuardNodes',
    'updateGuardNodes',
    'createOrUpdateItem',
    'getItemById',
    'getAllItems',
    'removeItemById',
    'getSwarmNodesForPubkey',
    'updateSwarmNodesForPubkey',
    'saveConversation',
    'getConversationById',
    'removeConversation',
    'getAllConversations',
    'getPubkeysInPublicConversation',
    'searchConversations',
    'searchMessages',
    'searchMessagesInConversation',
    'saveMessage',
    'cleanSeenMessages',
    'cleanLastHashes',
    'updateLastHash',
    'saveSeenMessageHashes',
    'saveMessages',
    'removeMessage',
    'removeMessagesByIds',
    'getUnreadByConversation',
    'markAllAsReadByConversationNoExpiration',
    'getUnreadCountByConversation',
    'getMessageCountByType',
    'removeAllMessagesInConversation',
    'getMessageCount',
    'getMessageBySenderAndSentAt',
    'filterAlreadyFetchedOpengroupMessage',
    'getMessageBySenderAndTimestamp',
    'getMessageIdsFromServerIds',
    'getMessageById',
    'getMessagesBySentAt',
    'getMessageByServerId',
    'getExpiredMessages',
    'getOutgoingWithoutExpiresAt',
    'getNextExpiringMessage',
    'getMessagesByConversation',
    'getLastMessagesByConversation',
    'getOldestMessageInConversation',
    'getFirstUnreadMessageIdInConversation',
    'getFirstUnreadMessageWithMention',
    'hasConversationOutgoingMessage',
    'getSeenMessagesByHashList',
    'getLastHashBySnode',
    'getUnprocessedCount',
    'getAllUnprocessed',
    'getUnprocessedById',
    'saveUnprocessed',
    'updateUnprocessedAttempts',
    'updateUnprocessedWithData',
    'removeUnprocessed',
    'removeAllUnprocessed',
    'getNextAttachmentDownloadJobs',
    'saveAttachmentDownloadJob',
    'resetAttachmentDownloadPending',
    'setAttachmentDownloadJobPending',
    'removeAttachmentDownloadJob',
    'removeAllAttachmentDownloadJobs',
    'removeAll',
    'removeAllConversations',
    'removeOtherData',
    'cleanupOrphanedAttachments',
    'getMessagesWithVisualMediaAttachments',
    'getMessagesWithFileAttachments',
    'getAllEncryptionKeyPairsForGroup',
    'getLatestClosedGroupEncryptionKeyPair',
    'addClosedGroupEncryptionKeyPair',
    'removeAllClosedGroupEncryptionKeyPairs',
    'fillWithTestData',
    ...channelsToMakeForOpengroupV2,
]);
const SQL_CHANNEL_KEY = 'sql-channel';
let _shutdownPromise = null;
const DATABASE_UPDATE_TIMEOUT = 2 * 60 * 1000;
exports.jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback = null;
async function shutdown() {
    if (_shutdownPromise) {
        return _shutdownPromise;
    }
    _shuttingDown = true;
    const jobKeys = Object.keys(exports.jobs);
    window?.log?.info(`data.shutdown: starting process. ${jobKeys.length} jobs outstanding`);
    if (jobKeys.length === 0) {
        return null;
    }
    _shutdownPromise = new Promise((resolve, reject) => {
        _shutdownCallback = (error) => {
            window?.log?.info('data.shutdown: process complete');
            if (error) {
                return reject(error);
            }
            return resolve(undefined);
        };
    });
    return _shutdownPromise;
}
exports.shutdown = shutdown;
function getJob(id) {
    return exports.jobs[id];
}
function makeChannel(fnName) {
    channels_1.channels[fnName] = async (...args) => {
        const jobId = makeJob(fnName);
        return new Promise((resolve, reject) => {
            electron_1.ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);
            updateJob(jobId, {
                resolve,
                reject,
                args: _DEBUG ? args : null,
            });
            exports.jobs[jobId].timer = setTimeout(() => reject(new Error(`SQL channel job ${jobId} (${fnName}) timed out`)), DATABASE_UPDATE_TIMEOUT);
        });
    };
}
async function callChannel(name) {
    return new Promise((resolve, reject) => {
        electron_1.ipcRenderer.send(name);
        electron_1.ipcRenderer.once(`${name}-done`, (_event, error) => {
            if (error) {
                return reject(error);
            }
            return resolve(undefined);
        });
        setTimeout(() => reject(new Error(`callChannel call to ${name} timed out`)), DATABASE_UPDATE_TIMEOUT);
    });
}
exports.callChannel = callChannel;
function initData() {
    electron_1.ipcRenderer.setMaxListeners(0);
    channelsToMake.forEach(makeChannel);
    electron_1.ipcRenderer.on(`${SQL_CHANNEL_KEY}-done`, (_event, jobId, errorForDisplay, result) => {
        const job = getJob(jobId);
        if (!job) {
            throw new Error(`Received SQL channel reply to job ${jobId}, but did not have it in our registry!`);
        }
        const { resolve, reject, fnName } = job;
        if (errorForDisplay) {
            return reject(new Error(`Error received from SQL channel job ${jobId} (${fnName}): ${errorForDisplay}`));
        }
        return resolve(result);
    });
}
exports.initData = initData;
function updateJob(id, data) {
    const { resolve, reject } = data;
    const { fnName, start } = exports.jobs[id];
    exports.jobs[id] = {
        ...exports.jobs[id],
        ...data,
        resolve: (value) => {
            removeJob(id);
            if (_DEBUG) {
                const end = Date.now();
                const delta = end - start;
                if (delta > 10) {
                    window?.log?.debug(`SQL channel job ${id} (${fnName}) succeeded in ${end - start}ms`);
                }
            }
            return resolve(value);
        },
        reject: (error) => {
            removeJob(id);
            const end = Date.now();
            window?.log?.warn(`SQL channel job ${id} (${fnName}) failed in ${end - start}ms`);
            return reject(error);
        },
    };
}
function removeJob(id) {
    if (_DEBUG) {
        exports.jobs[id].complete = true;
        return;
    }
    if (exports.jobs[id].timer) {
        global.clearTimeout(exports.jobs[id].timer);
        exports.jobs[id].timer = null;
    }
    delete exports.jobs[id];
    if (_shutdownCallback) {
        const keys = Object.keys(exports.jobs);
        if (keys.length === 0) {
            _shutdownCallback();
        }
    }
}
function makeJob(fnName) {
    if (_shuttingDown && fnName !== 'close') {
        throw new Error(`Rejecting SQL channel job (${fnName}); application is shutting down`);
    }
    _jobCounter += 1;
    const id = _jobCounter;
    if (_DEBUG) {
        window?.log?.debug(`SQL channel job ${id} (${fnName}) started`);
    }
    exports.jobs[id] = {
        fnName,
        start: Date.now(),
    };
    return id;
}
