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
exports.SwarmPolling = exports.getSwarmPollingInstance = exports.processMessage = void 0;
const types_1 = require("../../types");
const snodePool = __importStar(require("./snodePool"));
const SNodeAPI_1 = require("./SNodeAPI");
const protobuf_1 = require("../../../protobuf");
const Receiver = __importStar(require("../../../receiver/receiver"));
const lodash_1 = __importStar(require("lodash"));
const data_1 = require("../../../data/data");
const utils_1 = require("../../utils");
const constants_1 = require("../../constants");
const conversations_1 = require("../../conversations");
const Performance_1 = require("../../utils/Performance");
const onionPath_1 = require("../../onions/onionPath");
const onion_1 = require("../../../state/ducks/onion");
const p_retry_1 = __importDefault(require("p-retry"));
const hfHandling_1 = require("./hfHandling");
function processMessage(message, options = {}, messageHash) {
    try {
        const dataPlaintext = new Uint8Array(utils_1.StringUtils.encode(message, 'base64'));
        const messageBuf = protobuf_1.SignalService.WebSocketMessage.decode(dataPlaintext);
        if (messageBuf.type === protobuf_1.SignalService.WebSocketMessage.Type.REQUEST) {
            Receiver.handleRequest(messageBuf.request?.body, options, messageHash);
        }
    }
    catch (error) {
        const info = {
            message,
            error: error.message,
        };
        window?.log?.warn('HTTP-Resources Failed to handle message:', info);
    }
}
exports.processMessage = processMessage;
let instance;
const getSwarmPollingInstance = () => {
    if (!instance) {
        instance = new SwarmPolling();
    }
    return instance;
};
exports.getSwarmPollingInstance = getSwarmPollingInstance;
class SwarmPolling {
    groupPolling;
    lastHashes;
    constructor() {
        this.groupPolling = [];
        this.lastHashes = {};
    }
    async start(waitForFirstPoll = false) {
        this.loadGroupIds();
        if (waitForFirstPoll) {
            await this.pollForAllKeys();
        }
        else {
            setTimeout(() => {
                void this.pollForAllKeys();
            }, 4000);
        }
    }
    resetSwarmPolling() {
        this.groupPolling = [];
    }
    forcePolledTimestamp(pubkey, lastPoll) {
        this.groupPolling = this.groupPolling.map(group => {
            if (types_1.PubKey.isEqual(pubkey, group.pubkey)) {
                return {
                    ...group,
                    lastPolledTimestamp: lastPoll,
                };
            }
            return group;
        });
    }
    addGroupId(pubkey) {
        if (this.groupPolling.findIndex(m => m.pubkey.key === pubkey.key) === -1) {
            window?.log?.info('Swarm addGroupId: adding pubkey to polling', pubkey.key);
            this.groupPolling.push({ pubkey, lastPolledTimestamp: 0 });
        }
    }
    removePubkey(pk) {
        const pubkey = types_1.PubKey.cast(pk);
        window?.log?.info('Swarm removePubkey: removing pubkey from polling', pubkey.key);
        this.groupPolling = this.groupPolling.filter(group => !pubkey.isEqual(group.pubkey));
    }
    getPollingTimeout(convoId) {
        const convo = (0, conversations_1.getConversationController)().get(convoId.key);
        if (!convo) {
            return constants_1.SWARM_POLLING_TIMEOUT.INACTIVE;
        }
        const activeAt = convo.get('active_at');
        if (!activeAt) {
            return constants_1.SWARM_POLLING_TIMEOUT.INACTIVE;
        }
        const currentTimestamp = Date.now();
        if (currentTimestamp - activeAt <= constants_1.DURATION.DAYS * 2) {
            return constants_1.SWARM_POLLING_TIMEOUT.ACTIVE;
        }
        if (currentTimestamp - activeAt <= constants_1.DURATION.DAYS * 7) {
            return constants_1.SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE;
        }
        return constants_1.SWARM_POLLING_TIMEOUT.INACTIVE;
    }
    async pollForAllKeys() {
        if (!window.getGlobalOnlineStatus()) {
            window?.log?.error('pollForAllKeys: offline');
            setTimeout(this.pollForAllKeys.bind(this), constants_1.SWARM_POLLING_TIMEOUT.ACTIVE);
            return;
        }
        const ourPubkey = utils_1.UserUtils.getOurPubKeyFromCache();
        const directPromises = Promise.all([
            this.pollOnceForKey(ourPubkey, false, 0),
        ]).then(() => undefined);
        const now = Date.now();
        const groupPromises = this.groupPolling.map(async (group) => {
            const convoPollingTimeout = this.getPollingTimeout(group.pubkey);
            const diff = now - group.lastPolledTimestamp;
            const loggingId = (0, conversations_1.getConversationController)()
                .get(group.pubkey.key)
                ?.idForLogging() || group.pubkey.key;
            if (diff >= convoPollingTimeout) {
                const hardfork190Happened = await (0, hfHandling_1.getHasSeenHF190)();
                const hardfork191Happened = await (0, hfHandling_1.getHasSeenHF191)();
                window?.log?.info(`Polling for ${loggingId}; timeout: ${convoPollingTimeout}; diff: ${diff} ; hardfork190Happened: ${hardfork190Happened}; hardfork191Happened: ${hardfork191Happened} `);
                if (hardfork190Happened && !hardfork191Happened) {
                    return Promise.all([
                        this.pollOnceForKey(group.pubkey, true, undefined),
                        this.pollOnceForKey(group.pubkey, true, -10),
                    ]).then(() => undefined);
                }
                if (hardfork190Happened && hardfork191Happened) {
                    return this.pollOnceForKey(group.pubkey, true, -10);
                }
                return this.pollOnceForKey(group.pubkey, true, 0);
            }
            window?.log?.info(`Not polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`);
            return Promise.resolve();
        });
        try {
            await Promise.all((0, lodash_1.concat)([directPromises], groupPromises));
        }
        catch (e) {
            window?.log?.info('pollForAllKeys exception: ', e);
            throw e;
        }
        finally {
            setTimeout(this.pollForAllKeys.bind(this), constants_1.SWARM_POLLING_TIMEOUT.ACTIVE);
        }
    }
    async pollOnceForKey(pubkey, isGroup, namespace) {
        const pkStr = pubkey.key;
        const swarmSnodes = await snodePool.getSwarmFor(pkStr);
        const alreadyPolled = swarmSnodes.filter((n) => this.lastHashes[n.pubkey_ed25519]);
        let nodesToPoll = lodash_1.default.sampleSize(alreadyPolled, 1);
        if (nodesToPoll.length < 1) {
            const notPolled = lodash_1.default.difference(swarmSnodes, alreadyPolled);
            const newNodes = lodash_1.default.sampleSize(notPolled, 1);
            nodesToPoll = lodash_1.default.concat(nodesToPoll, newNodes);
        }
        const promisesSettled = await Promise.allSettled(nodesToPoll.map(async (n) => {
            return this.pollNodeForKey(n, pubkey, namespace);
        }));
        const arrayOfResultsWithNull = promisesSettled.map(entry => entry.status === 'fulfilled' ? entry.value : null);
        const arrayOfResults = lodash_1.default.compact(arrayOfResultsWithNull);
        const messages = lodash_1.default.uniqBy(lodash_1.default.flatten(arrayOfResults), (x) => x.hash);
        if (isGroup && arrayOfResults?.length) {
            window?.log?.info(`Polled for group(${(0, onionPath_1.ed25519Str)(pubkey.key)}):, got ${messages.length} messages back.`);
            let lastPolledTimestamp = Date.now();
            if (messages.length >= 95) {
                lastPolledTimestamp = Date.now() - constants_1.SWARM_POLLING_TIMEOUT.INACTIVE - 5 * 1000;
            }
            this.groupPolling = this.groupPolling.map(group => {
                if (types_1.PubKey.isEqual(pubkey, group.pubkey)) {
                    return {
                        ...group,
                        lastPolledTimestamp,
                    };
                }
                return group;
            });
        }
        else if (isGroup) {
            window?.log?.info(`Polled for group(${(0, onionPath_1.ed25519Str)(pubkey.key)}):, but no snode returned something else than null.`);
        }
        (0, Performance_1.perfStart)(`handleSeenMessages-${pkStr}`);
        const newMessages = await this.handleSeenMessages(messages);
        (0, Performance_1.perfEnd)(`handleSeenMessages-${pkStr}`, 'handleSeenMessages');
        newMessages.forEach((m) => {
            const options = isGroup ? { conversationId: pkStr } : {};
            processMessage(m.data, options, m.hash);
        });
    }
    async pollNodeForKey(node, pubkey, namespace) {
        const edkey = node.pubkey_ed25519;
        const pkStr = pubkey.key;
        try {
            return await (0, p_retry_1.default)(async () => {
                const prevHash = await this.getLastHash(edkey, pkStr, namespace || 0);
                const messages = await (0, SNodeAPI_1.retrieveNextMessages)(node, prevHash, pkStr, namespace);
                if (!messages.length) {
                    return [];
                }
                const lastMessage = lodash_1.default.last(messages);
                await this.updateLastHash({
                    edkey: edkey,
                    pubkey,
                    namespace: namespace || 0,
                    hash: lastMessage.hash,
                    expiration: lastMessage.expiration,
                });
                return messages;
            }, {
                minTimeout: 100,
                retries: 1,
                onFailedAttempt: e => {
                    window?.log?.warn(`retrieveNextMessages attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.name}`);
                },
            });
        }
        catch (e) {
            if (e.message === SNodeAPI_1.ERROR_CODE_NO_CONNECT) {
                if (window.inboxStore?.getState().onionPaths.isOnline) {
                    window.inboxStore?.dispatch((0, onion_1.updateIsOnline)(false));
                }
            }
            else {
                if (!window.inboxStore?.getState().onionPaths.isOnline) {
                    window.inboxStore?.dispatch((0, onion_1.updateIsOnline)(true));
                }
            }
            window?.log?.info('pollNodeForKey failed with', e.message);
            return null;
        }
    }
    loadGroupIds() {
        const convos = (0, conversations_1.getConversationController)().getConversations();
        const mediumGroupsOnly = convos.filter((c) => c.isMediumGroup() && !c.isBlocked() && !c.get('isKickedFromGroup') && !c.get('left'));
        mediumGroupsOnly.forEach((c) => {
            this.addGroupId(new types_1.PubKey(c.id));
        });
    }
    async handleSeenMessages(messages) {
        if (!messages.length) {
            return [];
        }
        const incomingHashes = messages.map((m) => m.hash);
        const dupHashes = await data_1.Data.getSeenMessagesByHashList(incomingHashes);
        const newMessages = messages.filter((m) => !dupHashes.includes(m.hash));
        if (newMessages.length) {
            const newHashes = newMessages.map((m) => ({
                expiresAt: m.expiration,
                hash: m.hash,
            }));
            await data_1.Data.saveSeenMessageHashes(newHashes);
        }
        return newMessages;
    }
    async updateLastHash({ edkey, expiration, hash, namespace, pubkey, }) {
        const pkStr = pubkey.key;
        await data_1.Data.updateLastHash({
            convoId: pkStr,
            snode: edkey,
            hash,
            expiresAt: expiration,
            namespace,
        });
        if (!this.lastHashes[edkey]) {
            this.lastHashes[edkey] = {};
        }
        if (!this.lastHashes[edkey][pkStr]) {
            this.lastHashes[edkey][pkStr] = {};
        }
        this.lastHashes[edkey][pkStr][namespace] = hash;
    }
    async getLastHash(nodeEdKey, pubkey, namespace) {
        if (!this.lastHashes[nodeEdKey]?.[pubkey]?.[namespace]) {
            const lastHash = await data_1.Data.getLastHashBySnode(pubkey, nodeEdKey, namespace);
            if (!this.lastHashes[nodeEdKey]) {
                this.lastHashes[nodeEdKey] = {};
            }
            if (!this.lastHashes[nodeEdKey][pubkey]) {
                this.lastHashes[nodeEdKey][pubkey] = {};
            }
            this.lastHashes[nodeEdKey][pubkey][namespace] = lastHash || '';
            return this.lastHashes[nodeEdKey][pubkey][namespace];
        }
        return this.lastHashes[nodeEdKey][pubkey][namespace];
    }
}
exports.SwarmPolling = SwarmPolling;
