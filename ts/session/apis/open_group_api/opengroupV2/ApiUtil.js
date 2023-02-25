"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDefaultRooms = exports.hasExistingOpenGroup = exports.isSessionRunOpenGroup = exports.defaultServer = void 0;
const lodash_1 = require("lodash");
const Promise_1 = require("../../../utils/Promise");
const defaultRooms_1 = require("../../../../state/ducks/defaultRooms");
const OpenGroupUtils_1 = require("../utils/OpenGroupUtils");
const JoinOpenGroupV2_1 = require("./JoinOpenGroupV2");
const sogsV3RoomInfos_1 = require("../sogsv3/sogsV3RoomInfos");
const opengroups_1 = require("../../../../data/opengroups");
const conversations_1 = require("../../../conversations");
const legacyDefaultServerIP = '116.203.70.33';
exports.defaultServer = 'https://open.getsession.org';
const defaultServerHost = new window.URL(exports.defaultServer).host;
function isSessionRunOpenGroup(server) {
    if (!server || !(0, lodash_1.isString)(server)) {
        return false;
    }
    const lowerCased = server.toLowerCase();
    let serverHost;
    try {
        const lowerCasedUrl = new window.URL(lowerCased);
        serverHost = lowerCasedUrl.hostname;
        if (!serverHost) {
            throw new Error('Could not parse URL from serverURL');
        }
    }
    catch (e) {
        serverHost = lowerCased;
    }
    const options = [legacyDefaultServerIP, defaultServerHost];
    return options.includes(serverHost);
}
exports.isSessionRunOpenGroup = isSessionRunOpenGroup;
function hasExistingOpenGroup(server, roomId) {
    if (!server || !(0, lodash_1.isString)(server)) {
        return false;
    }
    const serverNotLowerCased = (0, lodash_1.clone)(server);
    const serverLowerCase = serverNotLowerCased.toLowerCase();
    let serverUrl;
    try {
        serverUrl = new window.URL(serverLowerCase);
        if (!serverUrl) {
            throw new Error('failed to parse url in hasExistingOpenGroup');
        }
    }
    catch (e) {
        try {
            serverUrl = new window.URL(`http://${serverLowerCase}`);
        }
        catch (e) {
            window.log.error(`hasExistingOpenGroup with ${serverNotLowerCased} with ${e.message}`);
            return false;
        }
    }
    const serverOptions = new Set([
        serverLowerCase,
        `${serverUrl.host}`,
        `http://${serverUrl.host}`,
        `https://${serverUrl.host}`,
    ]);
    if (isSessionRunOpenGroup(serverLowerCase)) {
        serverOptions.add(defaultServerHost);
        serverOptions.add(`http://${defaultServerHost}`);
        serverOptions.add(`https://${defaultServerHost}`);
        serverOptions.add(legacyDefaultServerIP);
        serverOptions.add(`http://${legacyDefaultServerIP}`);
        serverOptions.add(`https://${legacyDefaultServerIP}`);
    }
    const rooms = (0, lodash_1.flatten)((0, lodash_1.compact)([...serverOptions].map(opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl)));
    if (rooms.length === 0) {
        return false;
    }
    const matchingRoom = rooms.find(r => r.roomId === roomId);
    return Boolean(matchingRoom &&
        matchingRoom.conversationId &&
        (0, conversations_1.getConversationController)().get(matchingRoom.conversationId));
}
exports.hasExistingOpenGroup = hasExistingOpenGroup;
const defaultServerPublicKey = 'a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238';
const defaultRoom = `${exports.defaultServer}/main?public_key=${defaultServerPublicKey}`;
const loadDefaultRoomsSingle = () => (0, Promise_1.allowOnlyOneAtATime)('loadDefaultRoomsSingle', async () => {
    const roomInfos = (0, JoinOpenGroupV2_1.parseOpenGroupV2)(defaultRoom);
    if (roomInfos) {
        try {
            const roomsGot = await (0, sogsV3RoomInfos_1.getAllRoomInfos)(roomInfos);
            if (!roomsGot) {
                return [];
            }
            return roomsGot.map(room => {
                return {
                    ...room,
                    completeUrl: (0, OpenGroupUtils_1.getCompleteUrlFromRoom)({
                        serverUrl: roomInfos.serverUrl,
                        serverPublicKey: roomInfos.serverPublicKey,
                        roomId: room.id,
                    }),
                };
            });
        }
        catch (e) {
            window?.log?.warn('loadDefaultRoomloadDefaultRoomssIfNeeded failed', e);
        }
        return [];
    }
    return [];
});
const loadDefaultRooms = async () => {
    window.inboxStore?.dispatch((0, defaultRooms_1.updateDefaultRoomsInProgress)(true));
    const allRooms = await loadDefaultRoomsSingle();
    window.inboxStore?.dispatch((0, defaultRooms_1.updateDefaultRoomsInProgress)(false));
    if (allRooms !== undefined) {
        window.inboxStore?.dispatch((0, defaultRooms_1.updateDefaultRooms)(allRooms));
    }
};
exports.loadDefaultRooms = loadDefaultRooms;
