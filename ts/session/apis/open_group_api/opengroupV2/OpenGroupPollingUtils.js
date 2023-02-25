"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenGroupPollingUtils = void 0;
const opengroups_1 = require("../../../../data/opengroups");
const lodash_1 = require("lodash");
const utils_1 = require("../../../utils");
const String_1 = require("../../../utils/String");
const crypto_1 = require("../../../crypto");
const sogsBlinding_1 = require("../sogsv3/sogsBlinding");
const SNodeAPI_1 = require("../../snode_api/SNodeAPI");
const getOurOpenGroupHeaders = async (serverPublicKey, endpoint, method, blinded, body) => {
    const signingKeys = await utils_1.UserUtils.getUserED25519KeyPairBytes();
    if (!signingKeys) {
        window?.log?.error('getOurOpenGroupHeaders - Unable to get our signing keys');
        return;
    }
    const nonce = (await (0, crypto_1.getSodiumRenderer)()).randombytes_buf(16);
    const timestamp = Math.floor((0, SNodeAPI_1.getNowWithNetworkOffset)() / 1000);
    return sogsBlinding_1.SogsBlinding.getOpenGroupHeaders({
        signingKeys,
        serverPK: (0, String_1.fromHexToArray)(serverPublicKey),
        nonce,
        method,
        path: endpoint,
        timestamp,
        blinded,
        body,
    });
};
const getAllValidRoomInfos = (serverUrl, rooms) => {
    const allServerPubKeys = [];
    const validRoomInfos = (0, lodash_1.compact)([...rooms].map(roomId => {
        try {
            const fetchedInfo = opengroups_1.OpenGroupData.getV2OpenGroupRoomByRoomId({
                serverUrl,
                roomId,
            });
            if (!fetchedInfo) {
                window?.log?.warn('Could not find this room getMessages');
                return null;
            }
            allServerPubKeys.push(fetchedInfo.serverPublicKey);
            return fetchedInfo;
        }
        catch (e) {
            window?.log?.warn('failed to fetch roominfos for room', roomId);
            return null;
        }
    }));
    if (!validRoomInfos?.length) {
        return null;
    }
    let firstPubkey;
    if (allServerPubKeys?.length) {
        firstPubkey = allServerPubKeys[0];
        const allMatch = allServerPubKeys.every(p => p === firstPubkey);
        if (!allMatch) {
            window?.log?.warn('All pubkeys do not match:', allServerPubKeys);
            return null;
        }
    }
    else {
        window?.log?.warn('No pubkeys found:', allServerPubKeys);
        return null;
    }
    return validRoomInfos;
};
exports.OpenGroupPollingUtils = { getAllValidRoomInfos, getOurOpenGroupHeaders };
