"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenGroupData = void 0;
const lodash_1 = require("lodash");
const conversation_1 = require("../models/conversation");
const OpenGroupUtils_1 = require("../session/apis/open_group_api/utils/OpenGroupUtils");
const channels_1 = require("./channels");
exports.OpenGroupData = {
    getAllV2OpenGroupRoomsMap,
    opengroupRoomsLoad,
    getV2OpenGroupRoom,
    getV2OpenGroupRoomsByServerUrl,
    saveV2OpenGroupRoom,
    saveV2OpenGroupRooms,
    getV2OpenGroupRoomByRoomId,
    removeV2OpenGroupRoom,
    getAllOpenGroupV2Conversations,
    getAllOpengroupsServerPubkeys,
    getAllV2OpenGroupRooms,
};
function getAllV2OpenGroupRoomsMap() {
    const results = new Map();
    throwIfNotLoaded().forEach(o => {
        if (o.conversationId) {
            results.set(o.conversationId, (0, lodash_1.cloneDeep)(o));
        }
    });
    return results;
}
async function getAllV2OpenGroupRooms() {
    return channels_1.channels.getAllV2OpenGroupRooms();
}
let cachedRooms = null;
async function opengroupRoomsLoad() {
    if (cachedRooms !== null) {
        return;
    }
    const loadedFromDB = (await exports.OpenGroupData.getAllV2OpenGroupRooms());
    if (loadedFromDB) {
        cachedRooms = new Array();
        loadedFromDB.forEach(r => {
            try {
                cachedRooms?.push(r);
            }
            catch (e) {
                window.log.warn(e.message);
            }
        });
        return;
    }
    cachedRooms = [];
}
function throwIfNotLoaded() {
    if (cachedRooms === null) {
        throw new Error('opengroupRoomsLoad must be called first');
    }
    return cachedRooms;
}
function getV2OpenGroupRoom(conversationId) {
    if (!(0, OpenGroupUtils_1.isOpenGroupV2)(conversationId)) {
        throw new Error(`getV2OpenGroupRoom: this is not a valid v2 id: ${conversationId}`);
    }
    const found = throwIfNotLoaded().find(m => m.conversationId === conversationId);
    return (found && (0, lodash_1.cloneDeep)(found)) || undefined;
}
function getV2OpenGroupRoomsByServerUrl(serverUrl) {
    const found = throwIfNotLoaded().filter(m => m.serverUrl === serverUrl);
    return (found && (0, lodash_1.cloneDeep)(found)) || undefined;
}
function getV2OpenGroupRoomByRoomId(roomInfos) {
    const found = throwIfNotLoaded().find(m => m.roomId === roomInfos.roomId && m.serverUrl === roomInfos.serverUrl);
    return (found && (0, lodash_1.cloneDeep)(found)) || undefined;
}
async function saveV2OpenGroupRooms(rooms) {
    await Promise.all(rooms.map(saveV2OpenGroupRoom));
}
async function saveV2OpenGroupRoom(room) {
    if (!room.conversationId || !room.roomId || !room.serverUrl || !room.serverPublicKey) {
        throw new Error('Cannot save v2 room, invalid data');
    }
    const found = (room.conversationId &&
        throwIfNotLoaded().find(m => m.conversationId === room.conversationId)) ||
        undefined;
    if (!found) {
        await channels_1.channels.saveV2OpenGroupRoom(room);
        throwIfNotLoaded().push((0, lodash_1.cloneDeep)(room));
        return;
    }
    if (JSON.stringify(room) !== JSON.stringify(found)) {
        await channels_1.channels.saveV2OpenGroupRoom(room);
        const foundIndex = room.conversationId &&
            throwIfNotLoaded().findIndex(m => m.conversationId === room.conversationId);
        if ((0, lodash_1.isNumber)(foundIndex) && foundIndex > -1) {
            throwIfNotLoaded()[foundIndex] = (0, lodash_1.cloneDeep)(room);
        }
        return;
    }
}
async function removeV2OpenGroupRoom(conversationId) {
    await channels_1.channels.removeV2OpenGroupRoom(conversationId);
    const foundIndex = conversationId && throwIfNotLoaded().findIndex(m => m.conversationId === conversationId);
    if ((0, lodash_1.isNumber)(foundIndex) && foundIndex > -1) {
        throwIfNotLoaded().splice(foundIndex, 1);
    }
}
async function getAllOpenGroupV2Conversations() {
    const conversations = await channels_1.channels.getAllOpenGroupV2Conversations();
    const collection = new conversation_1.ConversationCollection();
    collection.add(conversations);
    return collection;
}
function getAllOpengroupsServerPubkeys() {
    return (0, lodash_1.uniq)(throwIfNotLoaded().map(room => room.serverPublicKey)) || [];
}
