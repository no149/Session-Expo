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
exports.OpenGroupManagerV2 = exports.getOpenGroupManager = void 0;
const opengroups_1 = require("../../../../data/opengroups");
const conversations_1 = require("../../../conversations");
const Promise_1 = require("../../../utils/Promise");
const OpenGroupUtils_1 = require("../utils/OpenGroupUtils");
const OpenGroupServerPoller_1 = require("./OpenGroupServerPoller");
const lodash_1 = __importStar(require("lodash"));
const auto_bind_1 = __importDefault(require("auto-bind"));
const conversationAttributes_1 = require("../../../../models/conversationAttributes");
const sogsV3RoomInfos_1 = require("../sogsv3/sogsV3RoomInfos");
let instance;
const getOpenGroupManager = () => {
    if (!instance) {
        instance = new OpenGroupManagerV2();
    }
    return instance;
};
exports.getOpenGroupManager = getOpenGroupManager;
class OpenGroupManagerV2 {
    static useV2OpenGroups = false;
    pollers = new Map();
    isPolling = false;
    constructor() {
        (0, auto_bind_1.default)(this);
    }
    async attemptConnectionV2OneAtATime(serverUrl, roomId, publicKey) {
        const oneAtaTimeStr = `oneAtaTimeOpenGroupV2Join:${serverUrl}${roomId}`;
        return (0, Promise_1.allowOnlyOneAtATime)(oneAtaTimeStr, async () => {
            return this.attemptConnectionV2(serverUrl, roomId, publicKey);
        });
    }
    async startPolling() {
        await (0, Promise_1.allowOnlyOneAtATime)('V2ManagerStartPolling', this.startPollingBouncy);
    }
    stopPolling() {
        if (!this.isPolling) {
            return;
        }
        this.pollers.forEach(poller => {
            poller.stop();
        });
        this.pollers.clear();
        this.isPolling = false;
    }
    addRoomToPolledRooms(roomInfos) {
        const grouped = lodash_1.default.groupBy(roomInfos, r => r.serverUrl);
        const groupedArray = Object.values(grouped);
        for (const groupedRooms of groupedArray) {
            const groupedRoomsServerUrl = groupedRooms[0].serverUrl;
            const poller = this.pollers.get(groupedRoomsServerUrl);
            if (!poller) {
                const uniqGroupedRooms = lodash_1.default.uniqBy(groupedRooms, r => r.roomId);
                this.pollers.set(groupedRoomsServerUrl, new OpenGroupServerPoller_1.OpenGroupServerPoller(uniqGroupedRooms));
            }
            else {
                roomInfos.forEach(poller.addRoomToPoll);
            }
        }
    }
    removeRoomFromPolledRooms(roomInfos) {
        const poller = this.pollers.get(roomInfos.serverUrl);
        if (!poller) {
            return;
        }
        poller.removeRoomFromPoll(roomInfos);
        if (poller.getPolledRoomsCount() === 0) {
            this.pollers.delete(roomInfos.serverUrl);
            poller.stop();
        }
    }
    async startPollingBouncy() {
        if (this.isPolling) {
            return;
        }
        const allConvos = await opengroups_1.OpenGroupData.getAllOpenGroupV2Conversations();
        let allRoomInfos = opengroups_1.OpenGroupData.getAllV2OpenGroupRoomsMap();
        if (allRoomInfos) {
            await Promise.all([...allRoomInfos.values()].map(async (infos) => {
                try {
                    const roomConvoId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(infos.serverUrl, infos.roomId);
                    if (!allConvos.get(roomConvoId)) {
                        await opengroups_1.OpenGroupData.removeV2OpenGroupRoom(roomConvoId);
                        (0, exports.getOpenGroupManager)().removeRoomFromPolledRooms(infos);
                    }
                }
                catch (e) {
                    window?.log?.warn('cleanup roomInfos error', e);
                }
            }));
        }
        allRoomInfos = opengroups_1.OpenGroupData.getAllV2OpenGroupRoomsMap();
        if (allRoomInfos) {
            this.addRoomToPolledRooms([...allRoomInfos.values()]);
        }
        this.isPolling = true;
    }
    async attemptConnectionV2(serverUrl, roomId, serverPublicKey) {
        let conversationId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomId);
        if ((0, conversations_1.getConversationController)().get(conversationId)) {
            throw new Error(window.i18n('publicChatExists'));
        }
        await opengroups_1.OpenGroupData.removeV2OpenGroupRoom(conversationId);
        try {
            const room = {
                serverUrl,
                roomId,
                conversationId,
                serverPublicKey,
            };
            const updatedRoom = (0, lodash_1.clone)(room);
            await opengroups_1.OpenGroupData.saveV2OpenGroupRoom(room);
            const roomInfos = await (0, sogsV3RoomInfos_1.openGroupV2GetRoomInfoViaOnionV4)({
                serverPubkey: serverPublicKey,
                serverUrl,
                roomId,
            });
            if (!roomInfos || !roomInfos.id) {
                throw new Error('Invalid open group roomInfo result');
            }
            updatedRoom.roomId = roomInfos.id;
            conversationId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomInfos.id);
            updatedRoom.conversationId = conversationId;
            if (!(0, lodash_1.isEqual)(room, updatedRoom)) {
                await opengroups_1.OpenGroupData.removeV2OpenGroupRoom(conversationId);
                await opengroups_1.OpenGroupData.saveV2OpenGroupRoom(updatedRoom);
            }
            const conversation = await (0, conversations_1.getConversationController)().getOrCreateAndWait(conversationId, conversationAttributes_1.ConversationTypeEnum.GROUP);
            updatedRoom.imageID = roomInfos.imageId || undefined;
            updatedRoom.roomName = roomInfos.name || undefined;
            updatedRoom.capabilities = roomInfos.capabilities;
            await opengroups_1.OpenGroupData.saveV2OpenGroupRoom(updatedRoom);
            conversation.set({
                active_at: Date.now(),
                displayNameInProfile: updatedRoom.roomName,
                isApproved: true,
                didApproveMe: true,
                isTrustedForAttachmentDownload: true,
            });
            await conversation.commit();
            this.addRoomToPolledRooms([updatedRoom]);
            return conversation;
        }
        catch (e) {
            window?.log?.warn('Failed to join open group v2', e.message);
            await opengroups_1.OpenGroupData.removeV2OpenGroupRoom(conversationId);
            return undefined;
        }
    }
}
exports.OpenGroupManagerV2 = OpenGroupManagerV2;
