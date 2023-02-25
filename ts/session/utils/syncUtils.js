"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSyncMessage = exports.getCurrentConfigurationMessage = exports.forceSyncConfigurationNowIfNeeded = exports.syncConfigurationIfNeeded = void 0;
const data_1 = require("../../../ts/data/data");
const __1 = require("..");
const conversations_1 = require("../conversations");
const uuid_1 = require("uuid");
const _1 = require(".");
const keypairs_1 = require("../../receiver/keypairs");
const ConfigurationMessage_1 = require("../messages/outgoing/controlMessage/ConfigurationMessage");
const String_1 = require("./String");
const protobuf_1 = require("../../protobuf");
const lodash_1 = __importDefault(require("lodash"));
const VisibleMessage_1 = require("../messages/outgoing/visibleMessage/VisibleMessage");
const ExpirationTimerUpdateMessage_1 = require("../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage");
const opengroups_1 = require("../../data/opengroups");
const OpenGroupUtils_1 = require("../apis/open_group_api/utils/OpenGroupUtils");
const constants_1 = require("../constants");
const types_1 = require("../types");
const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';
const getLastSyncTimestampFromDb = async () => (await data_1.Data.getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;
const writeLastSyncTimestampToDb = async (timestamp) => data_1.Data.createOrUpdateItem({ id: ITEM_ID_LAST_SYNC_TIMESTAMP, value: timestamp });
const syncConfigurationIfNeeded = async () => {
    const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
    const now = Date.now();
    if (Math.abs(now - lastSyncedTimestamp) < constants_1.DURATION.DAYS * 2) {
        return;
    }
    const allConvos = (0, conversations_1.getConversationController)().getConversations();
    const configMessage = await (0, exports.getCurrentConfigurationMessage)(allConvos);
    try {
        await (0, __1.getMessageQueue)().sendSyncMessage(configMessage);
    }
    catch (e) {
        window?.log?.warn('Caught an error while sending our ConfigurationMessage:', e);
        return;
    }
    await writeLastSyncTimestampToDb(now);
};
exports.syncConfigurationIfNeeded = syncConfigurationIfNeeded;
const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) => new Promise(resolve => {
    const allConvos = (0, conversations_1.getConversationController)().getConversations();
    setTimeout(() => {
        resolve(false);
    }, 10000);
    void (0, exports.getCurrentConfigurationMessage)(allConvos)
        .then(configMessage => {
        const callback = waitForMessageSent
            ? () => {
                resolve(true);
            }
            : undefined;
        void (0, __1.getMessageQueue)().sendSyncMessage(configMessage, callback);
        if (!waitForMessageSent) {
            resolve(true);
        }
    })
        .catch(e => {
        window?.log?.warn('Caught an error while building our ConfigurationMessage:', e);
        resolve(false);
    });
});
exports.forceSyncConfigurationNowIfNeeded = forceSyncConfigurationNowIfNeeded;
const getActiveOpenGroupV2CompleteUrls = async (convos) => {
    const openGroupsV2ConvoIds = convos
        .filter(c => !!c.get('active_at') && c.isOpenGroupV2() && !c.get('left'))
        .map(c => c.id);
    const urls = await Promise.all(openGroupsV2ConvoIds.map(async (opengroup) => {
        const roomInfos = opengroups_1.OpenGroupData.getV2OpenGroupRoom(opengroup);
        if (roomInfos) {
            return (0, OpenGroupUtils_1.getCompleteUrlFromRoom)(roomInfos);
        }
        return null;
    }));
    return lodash_1.default.compact(urls) || [];
};
const getValidClosedGroups = async (convos) => {
    const ourPubKey = _1.UserUtils.getOurPubKeyStrFromCache();
    const closedGroupModels = convos.filter(c => !!c.get('active_at') &&
        c.isMediumGroup() &&
        c.get('members')?.includes(ourPubKey) &&
        !c.get('left') &&
        !c.get('isKickedFromGroup') &&
        !c.isBlocked() &&
        c.get('displayNameInProfile'));
    const closedGroups = await Promise.all(closedGroupModels.map(async (c) => {
        const groupPubKey = c.get('id');
        const fetchEncryptionKeyPair = await data_1.Data.getLatestClosedGroupEncryptionKeyPair(groupPubKey);
        if (!fetchEncryptionKeyPair) {
            return null;
        }
        return new ConfigurationMessage_1.ConfigurationMessageClosedGroup({
            publicKey: groupPubKey,
            name: c.get('displayNameInProfile') || '',
            members: c.get('members') || [],
            admins: c.get('groupAdmins') || [],
            encryptionKeyPair: keypairs_1.ECKeyPair.fromHexKeyPair(fetchEncryptionKeyPair),
        });
    }));
    const onlyValidClosedGroup = closedGroups.filter(m => m !== null);
    return onlyValidClosedGroup;
};
const getValidContacts = (convos) => {
    const contactsModels = convos.filter(c => !!c.get('active_at') &&
        c.getRealSessionUsername() &&
        c.isPrivate() &&
        c.isApproved() &&
        !types_1.PubKey.hasBlindedPrefix(c.get('id')));
    const contacts = contactsModels.map(c => {
        try {
            const profileKey = c.get('profileKey');
            let profileKeyForContact = null;
            if (typeof profileKey === 'string') {
                try {
                    if (!/^[0-9a-fA-F]+$/.test(profileKey)) {
                        throw new Error('Not Hex');
                    }
                    profileKeyForContact = (0, String_1.fromHexToArray)(profileKey);
                }
                catch (e) {
                    profileKeyForContact = (0, String_1.fromBase64ToArray)(profileKey);
                    void c.setProfileKey(profileKeyForContact);
                }
            }
            else if (profileKey) {
                window.log.warn('Got a profileKey for a contact in another format than string. Contact: ', c.id);
                return null;
            }
            return new ConfigurationMessage_1.ConfigurationMessageContact({
                publicKey: c.id,
                displayName: c.getRealSessionUsername() || 'Anonymous',
                profilePictureURL: c.get('avatarPointer'),
                profileKey: !profileKeyForContact?.length ? undefined : profileKeyForContact,
                isApproved: c.isApproved(),
                isBlocked: c.isBlocked(),
                didApproveMe: c.didApproveMe(),
            });
        }
        catch (e) {
            window?.log.warn('getValidContacts', e);
            return null;
        }
    });
    return lodash_1.default.compact(contacts);
};
const getCurrentConfigurationMessage = async (convos) => {
    const ourPubKey = _1.UserUtils.getOurPubKeyStrFromCache();
    const ourConvo = convos.find(convo => convo.id === ourPubKey);
    const opengroupV2CompleteUrls = await getActiveOpenGroupV2CompleteUrls(convos);
    const onlyValidClosedGroup = await getValidClosedGroups(convos);
    const validContacts = getValidContacts(convos);
    if (!ourConvo) {
        window?.log?.error('Could not find our convo while building a configuration message.');
    }
    const ourProfileKeyHex = (0, conversations_1.getConversationController)()
        .get(_1.UserUtils.getOurPubKeyStrFromCache())
        ?.get('profileKey') || null;
    const profileKey = ourProfileKeyHex ? (0, String_1.fromHexToArray)(ourProfileKeyHex) : undefined;
    const profilePicture = ourConvo?.get('avatarPointer') || undefined;
    const displayName = ourConvo?.getRealSessionUsername() || 'Anonymous';
    const activeOpenGroups = [...opengroupV2CompleteUrls];
    return new ConfigurationMessage_1.ConfigurationMessage({
        identifier: (0, uuid_1.v4)(),
        timestamp: Date.now(),
        activeOpenGroups,
        activeClosedGroups: onlyValidClosedGroup,
        displayName,
        profilePicture,
        profileKey,
        contacts: validContacts,
    });
};
exports.getCurrentConfigurationMessage = getCurrentConfigurationMessage;
const buildSyncVisibleMessage = (identifier, dataMessage, timestamp, syncTarget) => {
    const body = dataMessage.body || undefined;
    const wrapToUInt8Array = (buffer) => {
        if (!buffer) {
            return undefined;
        }
        if (buffer instanceof Uint8Array) {
            return buffer;
        }
        return new Uint8Array(buffer.toArrayBuffer());
    };
    const attachments = (dataMessage.attachments || []).map(attachment => {
        const key = wrapToUInt8Array(attachment.key);
        const digest = wrapToUInt8Array(attachment.digest);
        return {
            ...attachment,
            key,
            digest,
        };
    });
    const quote = dataMessage.quote || undefined;
    const preview = dataMessage.preview || [];
    const expireTimer = dataMessage.expireTimer;
    return new VisibleMessage_1.VisibleMessage({
        identifier,
        timestamp,
        attachments,
        body,
        quote,
        preview,
        syncTarget,
        expireTimer,
    });
};
const buildSyncExpireTimerMessage = (identifier, dataMessage, timestamp, syncTarget) => {
    const expireTimer = dataMessage.expireTimer;
    return new ExpirationTimerUpdateMessage_1.ExpirationTimerUpdateMessage({
        identifier,
        timestamp,
        expireTimer,
        syncTarget,
    });
};
const buildSyncMessage = (identifier, dataMessage, syncTarget, sentTimestamp) => {
    if (dataMessage.constructor.name !== 'DataMessage' &&
        !(dataMessage instanceof protobuf_1.SignalService.DataMessage)) {
        window?.log?.warn('buildSyncMessage with something else than a DataMessage');
    }
    if (!sentTimestamp || !lodash_1.default.isNumber(sentTimestamp)) {
        throw new Error('Tried to build a sync message without a sentTimestamp');
    }
    const timestamp = lodash_1.default.toNumber(sentTimestamp);
    if (dataMessage.flags === protobuf_1.SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE) {
        return buildSyncExpireTimerMessage(identifier, dataMessage, timestamp, syncTarget);
    }
    return buildSyncVisibleMessage(identifier, dataMessage, timestamp, syncTarget);
};
exports.buildSyncMessage = buildSyncMessage;
