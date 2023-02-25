"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomAndUpdateLastFetchTimestamp = exports.OpenGroupServerPoller = exports.invalidAuthRequiresBlinding = void 0;
const abort_controller_1 = require("abort-controller");
const OpenGroupUtils_1 = require("../utils/OpenGroupUtils");
const lodash_1 = require("lodash");
const opengroups_1 = require("../../../../data/opengroups");
const auto_bind_1 = __importDefault(require("auto-bind"));
const constants_1 = require("../../../constants");
const sogsV3BatchPoll_1 = require("../sogsv3/sogsV3BatchPoll");
const sogsApiV3_1 = require("../sogsv3/sogsApiV3");
const sogsV3Capabilities_1 = require("../sogsv3/sogsV3Capabilities");
const conversations_1 = require("../../../../state/ducks/conversations");
const pollForEverythingInterval = constants_1.DURATION.SECONDS * 10;
exports.invalidAuthRequiresBlinding = 'Invalid authentication: this server requires the use of blinded ids';
class OpenGroupServerPoller {
    serverUrl;
    roomIdsToPoll = new Set();
    pollForEverythingTimer;
    abortController;
    isPolling = false;
    wasStopped = false;
    constructor(roomInfos) {
        (0, auto_bind_1.default)(this);
        if (!roomInfos?.length) {
            throw new Error('Empty roomInfos list');
        }
        const firstUrl = roomInfos[0].serverUrl;
        const every = roomInfos.every(r => r.serverUrl === firstUrl);
        if (!every) {
            throw new Error('All rooms must be for the same serverUrl');
        }
        window?.log?.info(`Creating a new OpenGroupServerPoller for url ${firstUrl}`);
        this.serverUrl = firstUrl;
        roomInfos.forEach(r => {
            window?.log?.info(`Adding room on construct for url serverUrl: ${firstUrl}, roomId:'${r.roomId}' to poller:${this.serverUrl}`);
            this.roomIdsToPoll.add(r.roomId);
        });
        this.abortController = new abort_controller_1.AbortController();
        this.pollForEverythingTimer = global.setInterval(this.compactPoll, pollForEverythingInterval);
        if (this.roomIdsToPoll.size) {
            void this.triggerPollAfterAdd();
        }
    }
    addRoomToPoll(room) {
        if (room.serverUrl !== this.serverUrl) {
            throw new Error('All rooms must be for the same serverUrl');
        }
        if (this.roomIdsToPoll.has(room.roomId)) {
            window?.log?.info('skipping addRoomToPoll of already polled room:', room);
            return;
        }
        window?.log?.info(`Adding room on addRoomToPoll for url serverUrl: ${this.serverUrl}, roomId:'${room.roomId}' to poller:${this.serverUrl}`);
        this.roomIdsToPoll.add(room.roomId);
        void this.triggerPollAfterAdd(room);
    }
    removeRoomFromPoll(room) {
        if (room.serverUrl !== this.serverUrl) {
            window?.log?.info('this is not the correct ServerPoller');
            return;
        }
        if (this.roomIdsToPoll.has(room.roomId) || this.roomIdsToPoll.has(room.roomId.toLowerCase())) {
            window?.log?.info(`Removing ${room.roomId} from polling for ${this.serverUrl}`);
            this.roomIdsToPoll.delete(room.roomId);
            this.roomIdsToPoll.delete(room.roomId.toLowerCase());
        }
        else {
            window?.log?.info(`Cannot remove polling of ${room.roomId} as it is not polled on ${this.serverUrl}`);
        }
    }
    getPolledRoomsCount() {
        return this.roomIdsToPoll.size;
    }
    stop() {
        if (this.pollForEverythingTimer) {
            global.clearInterval(this.pollForEverythingTimer);
            this.abortController?.abort();
            this.pollForEverythingTimer = undefined;
            this.wasStopped = true;
        }
    }
    async triggerPollAfterAdd(_room) {
        await this.compactPoll();
    }
    shouldPoll() {
        if (this.wasStopped) {
            window?.log?.error('Serverpoller was stopped. CompactPoll should not happen');
            return false;
        }
        if (!this.roomIdsToPoll.size) {
            return false;
        }
        if (this.isPolling) {
            return false;
        }
        if (!window.getGlobalOnlineStatus()) {
            window?.log?.info('OpenGroupServerPoller: offline');
            return false;
        }
        return true;
    }
    async makeSubrequestInfo() {
        const subrequestOptions = [];
        subrequestOptions.push({
            type: 'capabilities',
        });
        this.roomIdsToPoll.forEach(roomId => {
            subrequestOptions.push({
                type: 'pollInfo',
                pollInfo: {
                    roomId,
                    infoUpdated: 0,
                },
            });
            const convoId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(this.serverUrl, roomId);
            const roomInfos = opengroups_1.OpenGroupData.getV2OpenGroupRoom(convoId);
            subrequestOptions.push({
                type: 'messages',
                messages: {
                    roomId,
                    sinceSeqNo: roomInfos?.maxMessageFetchedSeqNo,
                },
            });
        });
        if (this.serverUrl) {
            const rooms = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(this.serverUrl);
            if (rooms?.length) {
                if ((0, sogsV3Capabilities_1.roomHasBlindEnabled)(rooms[0])) {
                    const maxInboxId = Math.max(...rooms.map(r => r.lastInboxIdFetched || 0));
                    subrequestOptions.push({
                        type: 'inbox',
                        inboxSince: { id: (0, lodash_1.isNumber)(maxInboxId) && maxInboxId > 0 ? maxInboxId : undefined },
                    });
                    const maxOutboxId = Math.max(...rooms.map(r => r.lastOutboxIdFetched || 0));
                    subrequestOptions.push({
                        type: 'outbox',
                        outboxSince: { id: (0, lodash_1.isNumber)(maxOutboxId) && maxOutboxId > 0 ? maxOutboxId : undefined },
                    });
                }
            }
        }
        return subrequestOptions;
    }
    async compactPoll() {
        if (!this.shouldPoll()) {
            return;
        }
        try {
            this.isPolling = true;
            if (this.abortController.signal.aborted) {
                throw new Error('Poller aborted');
            }
            const subrequestOptions = await this.makeSubrequestInfo();
            if (!subrequestOptions || subrequestOptions.length === 0) {
                throw new Error('compactFetch: no subrequestOptions');
            }
            const batchPollResults = await (0, sogsV3BatchPoll_1.sogsBatchSend)(this.serverUrl, this.roomIdsToPoll, this.abortController.signal, subrequestOptions, 'batch');
            if (!batchPollResults) {
                throw new Error('compactFetch: no batchPollResults');
            }
            if (this.abortController.signal.aborted) {
                throw new Error('Abort controller was cancelled. dropping request');
            }
            if ((0, sogsV3BatchPoll_1.parseBatchGlobalStatusCode)(batchPollResults) === 400 &&
                batchPollResults.body &&
                (0, lodash_1.isObject)(batchPollResults.body)) {
                const bodyPlainText = batchPollResults.body.plainText;
                if (bodyPlainText === exports.invalidAuthRequiresBlinding) {
                    await (0, sogsV3Capabilities_1.fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl)(this.serverUrl);
                    throw new Error('batchPollResults just detected switch to blinded enforced.');
                }
            }
            if (!(0, sogsV3BatchPoll_1.batchGlobalIsSuccess)(batchPollResults)) {
                throw new Error('batchPollResults general status code is not 200');
            }
            await (0, sogsApiV3_1.handleBatchPollResults)(this.serverUrl, batchPollResults, subrequestOptions);
            for (const room of subrequestOptions) {
                if (room.type === 'messages' && !room.messages?.sinceSeqNo && room.messages?.roomId) {
                    const conversationKey = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(this.serverUrl, room.messages.roomId);
                    global.setTimeout(() => {
                        const stateConversations = window.inboxStore?.getState().conversations;
                        if (stateConversations.conversationLookup?.[conversationKey]?.isInitialFetchingInProgress) {
                            if (stateConversations.selectedConversation &&
                                conversationKey === stateConversations.selectedConversation) {
                                void (0, conversations_1.openConversationWithMessages)({ conversationKey, messageId: null }).then(() => {
                                    window.inboxStore?.dispatch((0, conversations_1.markConversationInitialLoadingInProgress)({
                                        conversationKey,
                                        isInitialFetchingInProgress: false,
                                    }));
                                });
                            }
                            else {
                                window.inboxStore?.dispatch((0, conversations_1.markConversationInitialLoadingInProgress)({
                                    conversationKey,
                                    isInitialFetchingInProgress: false,
                                }));
                            }
                        }
                    }, 5000);
                }
            }
        }
        catch (e) {
            window?.log?.warn('Got error while compact fetch:', e.message);
        }
        finally {
            this.isPolling = false;
        }
    }
}
exports.OpenGroupServerPoller = OpenGroupServerPoller;
const getRoomAndUpdateLastFetchTimestamp = async (conversationId, newMessages, subRequest) => {
    const roomInfos = opengroups_1.OpenGroupData.getV2OpenGroupRoom(conversationId);
    if (!roomInfos || !roomInfos.serverUrl || !roomInfos.roomId) {
        throw new Error(`No room for convo ${conversationId}`);
    }
    if (!newMessages.length) {
        roomInfos.lastFetchTimestamp = Date.now();
        window?.log?.info(`No new messages for ${subRequest?.roomId}:${subRequest?.sinceSeqNo}... just updating our last fetched timestamp`);
        await opengroups_1.OpenGroupData.saveV2OpenGroupRoom(roomInfos);
        return null;
    }
    return roomInfos;
};
exports.getRoomAndUpdateLastFetchTimestamp = getRoomAndUpdateLastFetchTimestamp;
