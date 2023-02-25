"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEncryptionKeyPairWrappers = exports.sendRemovedMembers = exports.leaveClosedGroup = exports.updateOrCreateClosedGroup = exports.addUpdateMessage = exports.initiateClosedGroupUpdate = void 0;
const types_1 = require("../types");
const lodash_1 = __importDefault(require("lodash"));
const String_1 = require("../utils/String");
const blockedNumberController_1 = require("../../util/blockedNumberController");
const conversations_1 = require("../conversations");
const data_1 = require("../../data/data");
const uuid_1 = require("uuid");
const protobuf_1 = require("../../protobuf");
const crypto_1 = require("../crypto");
const MessageEncrypter_1 = require("../crypto/MessageEncrypter");
const keypairs_1 = require("../../receiver/keypairs");
const utils_1 = require("../utils");
const ClosedGroupMemberLeftMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage");
const closedGroups_1 = require("../../receiver/closedGroups");
const __1 = require("..");
const ClosedGroupAddedMembersMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage");
const ClosedGroupEncryptionPairMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage");
const ClosedGroupNameChangeMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage");
const ClosedGroupNewMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupNewMessage");
const ClosedGroupRemovedMembersMessage_1 = require("../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage");
const snode_api_1 = require("../apis/snode_api");
const SNodeAPI_1 = require("../apis/snode_api/SNodeAPI");
const conversationAttributes_1 = require("../../models/conversationAttributes");
async function initiateClosedGroupUpdate(groupId, groupName, members) {
    const convo = await (0, conversations_1.getConversationController)().getOrCreateAndWait(groupId, conversationAttributes_1.ConversationTypeEnum.GROUP);
    if (!convo.isMediumGroup()) {
        throw new Error('Legacy group are not supported anymore.');
    }
    const groupDetails = {
        id: groupId,
        name: groupName,
        members,
        zombies: convo.get('zombies')?.filter(z => members.includes(z)),
        activeAt: Date.now(),
        expireTimer: convo.get('expireTimer'),
    };
    const diff = buildGroupDiff(convo, groupDetails);
    await updateOrCreateClosedGroup(groupDetails);
    const updateObj = {
        id: groupId,
        name: groupName,
        members,
        admins: convo.get('groupAdmins'),
        expireTimer: convo.get('expireTimer'),
    };
    if (diff.newName?.length) {
        const nameOnlyDiff = lodash_1.default.pick(diff, 'newName');
        const dbMessageName = await addUpdateMessage(convo, nameOnlyDiff, utils_1.UserUtils.getOurPubKeyStrFromCache(), Date.now());
        await sendNewName(convo, diff.newName, dbMessageName.id);
    }
    if (diff.joiningMembers?.length) {
        const joiningOnlyDiff = lodash_1.default.pick(diff, 'joiningMembers');
        const dbMessageAdded = await addUpdateMessage(convo, joiningOnlyDiff, utils_1.UserUtils.getOurPubKeyStrFromCache(), Date.now());
        await sendAddedMembers(convo, diff.joiningMembers, dbMessageAdded.id, updateObj);
    }
    if (diff.leavingMembers?.length) {
        const leavingOnlyDiff = { kickedMembers: diff.leavingMembers };
        const dbMessageLeaving = await addUpdateMessage(convo, leavingOnlyDiff, utils_1.UserUtils.getOurPubKeyStrFromCache(), Date.now());
        const stillMembers = members;
        await sendRemovedMembers(convo, diff.leavingMembers, stillMembers, dbMessageLeaving.id);
    }
    await convo.commit();
}
exports.initiateClosedGroupUpdate = initiateClosedGroupUpdate;
async function addUpdateMessage(convo, diff, sender, sentAt) {
    const groupUpdate = {};
    if (diff.newName) {
        groupUpdate.name = diff.newName;
    }
    if (diff.joiningMembers) {
        groupUpdate.joined = diff.joiningMembers;
    }
    if (diff.leavingMembers) {
        groupUpdate.left = diff.leavingMembers;
    }
    if (diff.kickedMembers) {
        groupUpdate.kicked = diff.kickedMembers;
    }
    if (utils_1.UserUtils.isUsFromCache(sender)) {
        const outgoingMessage = await convo.addSingleOutgoingMessage({
            sent_at: sentAt,
            group_update: groupUpdate,
            expireTimer: 0,
        });
        return outgoingMessage;
    }
    const incomingMessage = await convo.addSingleIncomingMessage({
        sent_at: sentAt,
        group_update: groupUpdate,
        expireTimer: 0,
        source: sender,
    });
    const unreadCount = await convo.getUnreadCount();
    convo.set({
        unreadCount,
    });
    await convo.commit();
    return incomingMessage;
}
exports.addUpdateMessage = addUpdateMessage;
function buildGroupDiff(convo, update) {
    const groupDiff = {};
    if (convo.get('displayNameInProfile') !== update.name) {
        groupDiff.newName = update.name;
    }
    const oldMembers = convo.get('members');
    const oldZombies = convo.get('zombies');
    const oldMembersWithZombies = lodash_1.default.uniq(oldMembers.concat(oldZombies));
    const newMembersWithZombiesLeft = lodash_1.default.uniq(update.members.concat(update.zombies || []));
    const addedMembers = lodash_1.default.difference(newMembersWithZombiesLeft, oldMembersWithZombies);
    if (addedMembers.length > 0) {
        groupDiff.joiningMembers = addedMembers;
    }
    const removedMembers = lodash_1.default.difference(oldMembersWithZombies, newMembersWithZombiesLeft);
    if (removedMembers.length > 0) {
        groupDiff.leavingMembers = removedMembers;
    }
    return groupDiff;
}
async function updateOrCreateClosedGroup(details) {
    const { id, weWereJustAdded } = details;
    const conversation = await (0, conversations_1.getConversationController)().getOrCreateAndWait(id, conversationAttributes_1.ConversationTypeEnum.GROUP);
    const updates = {
        displayNameInProfile: details.name,
        members: details.members,
        type: 'group',
        is_medium_group: true,
        zombies: details.zombies?.length ? details.zombies : [],
        active_at: details.activeAt ? details.activeAt : 0,
        left: details.activeAt ? false : true,
        lastJoinedTimestamp: details.activeAt && weWereJustAdded ? Date.now() : details.activeAt || 0,
    };
    conversation.set(updates);
    const isBlocked = details.blocked || false;
    if (conversation.isClosedGroup() || conversation.isMediumGroup()) {
        await blockedNumberController_1.BlockedNumberController.setGroupBlocked(conversation.id, isBlocked);
    }
    if (details.admins?.length) {
        await conversation.updateGroupAdmins(details.admins, false);
    }
    await conversation.commit();
    const { expireTimer } = details;
    if (expireTimer === undefined || typeof expireTimer !== 'number') {
        return;
    }
    await conversation.updateExpireTimer(expireTimer, utils_1.UserUtils.getOurPubKeyStrFromCache(), Date.now(), {
        fromSync: true,
    });
}
exports.updateOrCreateClosedGroup = updateOrCreateClosedGroup;
async function leaveClosedGroup(groupId) {
    const convo = (0, conversations_1.getConversationController)().get(groupId);
    if (!convo) {
        window?.log?.error('Cannot leave non-existing group');
        return;
    }
    const ourNumber = utils_1.UserUtils.getOurPubKeyFromCache();
    const isCurrentUserAdmin = convo.get('groupAdmins')?.includes(ourNumber.key);
    let members = [];
    let admins = [];
    if (isCurrentUserAdmin) {
        window?.log?.info('Admin left a closed group. We need to destroy it');
        convo.set({ left: true });
        members = [];
        admins = [];
    }
    else {
        convo.set({ left: true });
        members = (convo.get('members') || []).filter((m) => m !== ourNumber.key);
        admins = convo.get('groupAdmins') || [];
    }
    convo.set({ members });
    convo.set({ groupAdmins: admins });
    await convo.commit();
    const source = utils_1.UserUtils.getOurPubKeyStrFromCache();
    const networkTimestamp = (0, SNodeAPI_1.getNowWithNetworkOffset)();
    const dbMessage = await convo.addSingleOutgoingMessage({
        group_update: { left: [source] },
        sent_at: networkTimestamp,
        expireTimer: 0,
    });
    const ourLeavingMessage = new ClosedGroupMemberLeftMessage_1.ClosedGroupMemberLeftMessage({
        timestamp: networkTimestamp,
        groupId,
        identifier: dbMessage.id,
    });
    window?.log?.info(`We are leaving the group ${groupId}. Sending our leaving message.`);
    (0, snode_api_1.getSwarmPollingInstance)().removePubkey(groupId);
    await (0, __1.getMessageQueue)().sendToGroup(ourLeavingMessage, async () => {
        window?.log?.info(`Leaving message sent ${groupId}. Removing everything related to this group.`);
        await (0, closedGroups_1.markGroupAsLeftOrKicked)(groupId, convo, false);
    });
}
exports.leaveClosedGroup = leaveClosedGroup;
async function sendNewName(convo, name, messageId) {
    if (name.length === 0) {
        window?.log?.warn('No name given for group update. Skipping');
        return;
    }
    const groupId = convo.get('id');
    const nameChangeMessage = new ClosedGroupNameChangeMessage_1.ClosedGroupNameChangeMessage({
        timestamp: Date.now(),
        groupId,
        identifier: messageId,
        name,
    });
    await (0, __1.getMessageQueue)().sendToGroup(nameChangeMessage);
}
async function sendAddedMembers(convo, addedMembers, messageId, groupUpdate) {
    if (!addedMembers?.length) {
        window?.log?.warn('No addedMembers given for group update. Skipping');
        return;
    }
    const { id: groupId, members, name: groupName } = groupUpdate;
    const admins = groupUpdate.admins || [];
    const hexEncryptionKeyPair = await data_1.Data.getLatestClosedGroupEncryptionKeyPair(groupId);
    if (!hexEncryptionKeyPair) {
        throw new Error("Couldn't get key pair for closed group");
    }
    const encryptionKeyPair = keypairs_1.ECKeyPair.fromHexKeyPair(hexEncryptionKeyPair);
    const existingExpireTimer = convo.get('expireTimer') || 0;
    const closedGroupControlMessage = new ClosedGroupAddedMembersMessage_1.ClosedGroupAddedMembersMessage({
        timestamp: Date.now(),
        groupId,
        addedMembers,
        identifier: messageId,
    });
    await (0, __1.getMessageQueue)().sendToGroup(closedGroupControlMessage);
    const newClosedGroupUpdate = new ClosedGroupNewMessage_1.ClosedGroupNewMessage({
        timestamp: Date.now(),
        name: groupName,
        groupId,
        admins,
        members,
        keypair: encryptionKeyPair,
        identifier: messageId || (0, uuid_1.v4)(),
        expireTimer: existingExpireTimer,
    });
    const promises = addedMembers.map(async (m) => {
        await (0, conversations_1.getConversationController)().getOrCreateAndWait(m, conversationAttributes_1.ConversationTypeEnum.PRIVATE);
        const memberPubKey = types_1.PubKey.cast(m);
        await (0, __1.getMessageQueue)().sendToPubKey(memberPubKey, newClosedGroupUpdate);
    });
    await Promise.all(promises);
}
async function sendRemovedMembers(convo, removedMembers, stillMembers, messageId) {
    if (!removedMembers?.length) {
        window?.log?.warn('No removedMembers given for group update. Skipping');
        return;
    }
    const ourNumber = utils_1.UserUtils.getOurPubKeyFromCache();
    const admins = convo.get('groupAdmins') || [];
    const groupId = convo.get('id');
    const isCurrentUserAdmin = admins.includes(ourNumber.key);
    const isUserLeaving = removedMembers.includes(ourNumber.key);
    if (isUserLeaving) {
        throw new Error('Cannot remove members and leave the group at the same time');
    }
    if (removedMembers.includes(admins[0]) && stillMembers.length !== 0) {
        throw new Error("Can't remove admin from closed group without removing everyone.");
    }
    const mainClosedGroupControlMessage = new ClosedGroupRemovedMembersMessage_1.ClosedGroupRemovedMembersMessage({
        timestamp: Date.now(),
        groupId,
        removedMembers,
        identifier: messageId,
    });
    await (0, __1.getMessageQueue)().sendToGroup(mainClosedGroupControlMessage, async () => {
        if (isCurrentUserAdmin) {
            window?.log?.info(`Sending group update: A user was removed from ${groupId} and we are the admin. Generating and sending a new EncryptionKeyPair`);
            await generateAndSendNewEncryptionKeyPair(groupId, stillMembers);
        }
    });
}
exports.sendRemovedMembers = sendRemovedMembers;
async function generateAndSendNewEncryptionKeyPair(groupPublicKey, targetMembers) {
    const groupConvo = (0, conversations_1.getConversationController)().get(groupPublicKey);
    const groupId = (0, String_1.fromHexToArray)(groupPublicKey);
    if (!groupConvo) {
        window?.log?.warn('generateAndSendNewEncryptionKeyPair: conversation not found', groupPublicKey);
        return;
    }
    if (!groupConvo.isMediumGroup()) {
        window?.log?.warn('generateAndSendNewEncryptionKeyPair: conversation not a closed group', groupPublicKey);
        return;
    }
    const ourNumber = utils_1.UserUtils.getOurPubKeyFromCache();
    if (!groupConvo.get('groupAdmins')?.includes(ourNumber.key)) {
        window?.log?.warn('generateAndSendNewEncryptionKeyPair: cannot send it as a non admin');
        return;
    }
    const newKeyPair = await (0, crypto_1.generateCurve25519KeyPairWithoutPrefix)();
    if (!newKeyPair) {
        window?.log?.warn('generateAndSendNewEncryptionKeyPair: failed to generate new keypair');
        return;
    }
    const wrappers = await buildEncryptionKeyPairWrappers(targetMembers, newKeyPair);
    const keypairsMessage = new ClosedGroupEncryptionPairMessage_1.ClosedGroupEncryptionPairMessage({
        groupId: (0, String_1.toHex)(groupId),
        timestamp: Date.now(),
        encryptedKeyPairs: wrappers,
    });
    closedGroups_1.distributingClosedGroupEncryptionKeyPairs.set((0, String_1.toHex)(groupId), newKeyPair);
    const messageSentCallback = async () => {
        window?.log?.info(`KeyPairMessage for ClosedGroup ${groupPublicKey} is sent. Saving the new encryptionKeyPair.`);
        closedGroups_1.distributingClosedGroupEncryptionKeyPairs.delete((0, String_1.toHex)(groupId));
        await (0, closedGroups_1.addKeyPairToCacheAndDBIfNeeded)((0, String_1.toHex)(groupId), newKeyPair.toHexKeyPair());
    };
    await (0, __1.getMessageQueue)().sendToGroup(keypairsMessage, messageSentCallback);
}
async function buildEncryptionKeyPairWrappers(targetMembers, encryptionKeyPair) {
    if (!encryptionKeyPair ||
        !encryptionKeyPair.publicKeyData.length ||
        !encryptionKeyPair.privateKeyData.length) {
        throw new Error('buildEncryptionKeyPairWrappers() needs a valid encryptionKeyPair set');
    }
    const proto = new protobuf_1.SignalService.KeyPair({
        privateKey: encryptionKeyPair?.privateKeyData,
        publicKey: encryptionKeyPair?.publicKeyData,
    });
    const plaintext = protobuf_1.SignalService.KeyPair.encode(proto).finish();
    const wrappers = await Promise.all(targetMembers.map(async (pubkey) => {
        const ciphertext = await (0, MessageEncrypter_1.encryptUsingSessionProtocol)(types_1.PubKey.cast(pubkey), plaintext);
        return new protobuf_1.SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper({
            encryptedKeyPair: ciphertext,
            publicKey: (0, String_1.fromHexToArray)(pubkey),
        });
    }));
    return wrappers;
}
exports.buildEncryptionKeyPairWrappers = buildEncryptionKeyPairWrappers;
