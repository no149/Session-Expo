"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBatchPollResults = void 0;
const lodash_1 = require("lodash");
const opengroups_1 = require("../../../../data/opengroups");
const opengroup_1 = require("../../../../receiver/opengroup");
const OpenGroupServerPoller_1 = require("../opengroupV2/OpenGroupServerPoller");
const OpenGroupUtils_1 = require("../utils/OpenGroupUtils");
const sogsCapabilities_1 = require("./sogsCapabilities");
const conversations_1 = require("../../../conversations");
const SogsFilterDuplicate_1 = require("../opengroupV2/SogsFilterDuplicate");
const util_worker_interface_1 = require("../../../../webworker/workers/util_worker_interface");
const types_1 = require("../../../types");
const knownBlindedkeys_1 = require("./knownBlindedkeys");
const sogsBlinding_1 = require("./sogsBlinding");
const libsodium_wrappers_sumo_1 = require("libsodium-wrappers-sumo");
const utils_1 = require("../../../utils");
const contentMessage_1 = require("../../../../receiver/contentMessage");
const protobuf_1 = require("../../../../protobuf");
const uuid_1 = require("uuid");
const BufferPadding_1 = require("../../../crypto/BufferPadding");
const crypto_1 = require("../../../crypto");
const dataMessage_1 = require("../../../../receiver/dataMessage");
const conversationAttributes_1 = require("../../../../models/conversationAttributes");
const messageFactory_1 = require("../../../../models/messageFactory");
const data_1 = require("../../../../data/data");
const sogsV3MutationCache_1 = require("./sogsV3MutationCache");
const expiringMessages_1 = require("../../../../util/expiringMessages");
const sogsRollingDeletions_1 = require("./sogsRollingDeletions");
function getSogsConvoOrReturnEarly(serverUrl, roomId) {
    const convoId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomId);
    if (!convoId) {
        window.log.info(`getSogsConvoOrReturnEarly: convoId not built with ${serverUrl}: ${roomId}`);
        return null;
    }
    const foundConvo = (0, conversations_1.getConversationController)().get(convoId);
    if (!foundConvo) {
        window.log.info('getSogsConvoOrReturnEarly: convo not found: ', convoId);
        return null;
    }
    if (!foundConvo.isOpenGroupV2()) {
        window.log.info('getSogsConvoOrReturnEarly: convo not an opengroup: ', convoId);
        return null;
    }
    return foundConvo;
}
async function handlePollInfoResponse(statusCode, pollInfoResponseBody, serverUrl) {
    if (statusCode !== 200) {
        window.log.info('handlePollInfoResponse subRequest status code is not 200:', statusCode);
        return;
    }
    if (!(0, lodash_1.isObject)(pollInfoResponseBody)) {
        window.log.info('handlePollInfoResponse pollInfoResponseBody is not object');
        return;
    }
    const { active_users, read, upload, write, token, details } = pollInfoResponseBody;
    if (!token || !serverUrl) {
        window.log.info('handlePollInfoResponse token and serverUrl must be set');
        return;
    }
    const stillPolledRooms = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
    if (!stillPolledRooms?.some(r => r.roomId === token && r.serverUrl === serverUrl)) {
        window.log.info('handlePollInfoResponse room is no longer polled: ', token);
        return;
    }
    const foundConvo = getSogsConvoOrReturnEarly(serverUrl, token);
    if (!foundConvo) {
        return;
    }
    await foundConvo.setPollInfo({
        read,
        write,
        upload,
        subscriberCount: active_users,
        details: (0, lodash_1.pick)(details, 'admins', 'image_id', 'moderators', 'hidden_admins', 'hidden_moderators', 'name'),
    });
}
async function filterOutMessagesInvalidSignature(messagesFilteredBlindedIds) {
    const sentToWorker = messagesFilteredBlindedIds.map(m => {
        return {
            sender: types_1.PubKey.cast(m.session_id).key,
            base64EncodedSignature: m.signature,
            base64EncodedData: m.data,
        };
    });
    const startVerify = Date.now();
    const signatureValidEncodedData = (await (0, util_worker_interface_1.callUtilsWorker)('verifyAllSignatures', sentToWorker));
    const signaturesValidMessages = (0, lodash_1.compact)((signatureValidEncodedData || []).map(validData => messagesFilteredBlindedIds.find(m => m.data === validData)));
    window.log.info(`[perf] verifyAllSignatures took ${Date.now() - startVerify}ms.`);
    return signaturesValidMessages;
}
const handleSogsV3DeletedMessages = async (messages, serverUrl, roomId) => {
    const messagesDeleted = messages.filter(m => Boolean(m.deleted));
    const messagesWithoutDeleted = messages.filter(m => !m.deleted);
    if (!messagesDeleted.length) {
        return messagesWithoutDeleted;
    }
    const allIdsRemoved = messagesDeleted.map(m => m.id);
    try {
        const convoId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomId);
        const convo = (0, conversations_1.getConversationController)().get(convoId);
        const messageIds = await data_1.Data.getMessageIdsFromServerIds(allIdsRemoved, convo.id);
        allIdsRemoved.forEach(removedId => {
            sogsRollingDeletions_1.sogsRollingDeletions.addMessageDeletedId(convoId, removedId);
        });
        if (messageIds && messageIds.length) {
            await (0, expiringMessages_1.destroyMessagesAndUpdateRedux)(messageIds.map(messageId => ({
                conversationKey: convoId,
                messageId,
            })));
        }
    }
    catch (e) {
        window?.log?.warn('handleDeletions failed:', e);
    }
    return messagesWithoutDeleted;
};
const handleMessagesResponseV4 = async (messages, serverUrl, subrequestOption) => {
    if (!subrequestOption || !subrequestOption.messages) {
        window?.log?.error('handleBatchPollResults - missing fields required for message subresponse');
        return;
    }
    try {
        const { roomId } = subrequestOption.messages;
        const stillPolledRooms = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
        if (!stillPolledRooms?.some(r => r.roomId === roomId && r.serverUrl === serverUrl)) {
            window.log.info(`handleMessagesResponseV4: we are no longer polling for ${roomId}: skipping`);
            return;
        }
        const convoId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomId);
        const roomInfos = await (0, OpenGroupServerPoller_1.getRoomAndUpdateLastFetchTimestamp)(convoId, messages, subrequestOption.messages);
        if (!roomInfos || !roomInfos.conversationId) {
            return;
        }
        if (!(0, lodash_1.isArray)(messages)) {
            window.log.warn("handleMessagesResponseV4: didn't get an object from batch poll");
            return;
        }
        const messagesWithoutReactionOnlyUpdates = messages.filter(m => {
            const keys = Object.keys(m);
            if (keys.length === 3 &&
                keys.includes('id') &&
                keys.includes('seqno') &&
                keys.includes('reactions')) {
                return false;
            }
            return true;
        });
        const messagesWithMsTimestamp = messagesWithoutReactionOnlyUpdates
            .sort((a, b) => (a.seqno < b.seqno ? -1 : a.seqno > b.seqno ? 1 : 0))
            .map(m => ({
            ...m,
            posted: m.posted ? Math.floor(m.posted * 1000) : undefined,
        }));
        const messagesWithoutDeleted = await handleSogsV3DeletedMessages(messagesWithMsTimestamp, serverUrl, subrequestOption.messages.roomId);
        const messagesWithValidSignature = await filterOutMessagesInvalidSignature(messagesWithoutDeleted);
        const messagesFilteredBlindedIds = await (0, SogsFilterDuplicate_1.filterDuplicatesFromDbAndIncomingV4)(messagesWithValidSignature);
        const roomDetails = (0, lodash_1.pick)(roomInfos, 'serverUrl', 'roomId');
        const messagesWithResolvedBlindedIdsIfFound = [];
        for (let index = 0; index < messagesFilteredBlindedIds.length; index++) {
            const newMessage = messagesFilteredBlindedIds[index];
            if (newMessage.session_id) {
                const unblindedIdFound = (0, knownBlindedkeys_1.getCachedNakedKeyFromBlindedNoServerPubkey)(newMessage.session_id);
                if (unblindedIdFound && utils_1.UserUtils.isUsFromCache(unblindedIdFound)) {
                    newMessage.session_id = unblindedIdFound;
                }
                messagesWithResolvedBlindedIdsIfFound.push(newMessage);
            }
            else {
                throw Error('session_id is missing so we cannot resolve the blinded id');
            }
        }
        const incomingMessageSeqNo = (0, lodash_1.compact)(messages.map(n => n.seqno));
        const maxNewMessageSeqNo = Math.max(...incomingMessageSeqNo);
        for (let index = 0; index < messagesWithResolvedBlindedIdsIfFound.length; index++) {
            const msgToHandle = messagesWithResolvedBlindedIdsIfFound[index];
            try {
                await (0, opengroup_1.handleOpenGroupV4Message)(msgToHandle, roomDetails);
            }
            catch (e) {
                window?.log?.warn('handleOpenGroupV4Message', e);
            }
        }
        const roomInfosRefreshed = opengroups_1.OpenGroupData.getV2OpenGroupRoom(roomInfos.conversationId);
        if (!roomInfosRefreshed || !roomInfosRefreshed.serverUrl || !roomInfosRefreshed.roomId) {
            window.log.warn(`No room for convo ${roomInfos.conversationId}`);
            return;
        }
        if ((0, lodash_1.isNumber)(maxNewMessageSeqNo) && isFinite(maxNewMessageSeqNo)) {
            roomInfosRefreshed.maxMessageFetchedSeqNo = maxNewMessageSeqNo;
        }
        roomInfosRefreshed.lastFetchTimestamp = Date.now();
        await opengroups_1.OpenGroupData.saveV2OpenGroupRoom(roomInfosRefreshed);
        const messagesWithReactions = messages.filter(m => m.reactions !== undefined);
        if (messagesWithReactions.length > 0) {
            const conversationId = (0, OpenGroupUtils_1.getOpenGroupV2ConversationId)(serverUrl, roomId);
            const groupConvo = (0, conversations_1.getConversationController)().get(conversationId);
            if (groupConvo && groupConvo.isOpenGroupV2()) {
                for (const messageWithReaction of messagesWithReactions) {
                    if ((0, lodash_1.isEmpty)(messageWithReaction.reactions)) {
                        if (sogsRollingDeletions_1.sogsRollingDeletions.hasMessageDeletedId(conversationId, messageWithReaction.id)) {
                            continue;
                        }
                    }
                    void groupConvo.queueJob(async () => {
                        await (0, sogsV3MutationCache_1.processMessagesUsingCache)(serverUrl, roomId, messageWithReaction);
                    });
                }
            }
        }
    }
    catch (e) {
        window?.log?.warn('handleNewMessages failed:', e);
    }
};
async function handleInboxOutboxMessages(inboxOutboxResponse, serverUrl, isOutbox) {
    if (!inboxOutboxResponse || !(0, lodash_1.isArray)(inboxOutboxResponse) || inboxOutboxResponse.length === 0) {
        return;
    }
    const roomInfos = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
    if (!roomInfos || !roomInfos.length || !roomInfos[0].serverPublicKey) {
        return;
    }
    const ourKeypairBytes = await utils_1.UserUtils.getUserED25519KeyPairBytes();
    if (!ourKeypairBytes) {
        throw new Error('handleInboxOutboxMessages needs current user keypair');
    }
    const serverPubkey = roomInfos[0].serverPublicKey;
    const sodium = await (0, crypto_1.getSodiumRenderer)();
    await (0, knownBlindedkeys_1.findCachedOurBlindedPubkeyOrLookItUp)(serverPubkey, sodium);
    for (let index = 0; index < inboxOutboxResponse.length; index++) {
        const inboxOutboxItem = inboxOutboxResponse[index];
        const isOutgoing = isOutbox;
        try {
            const data = (0, libsodium_wrappers_sumo_1.from_base64)(inboxOutboxItem.message, libsodium_wrappers_sumo_1.base64_variants.ORIGINAL);
            const postedAtInMs = Math.floor(inboxOutboxItem.posted_at * 1000);
            const otherBlindedPubkey = isOutbox ? inboxOutboxItem.recipient : inboxOutboxItem.sender;
            const decrypted = await sogsBlinding_1.SogsBlinding.decryptWithSessionBlindingProtocol(data, isOutgoing, otherBlindedPubkey, serverPubkey, ourKeypairBytes);
            const content = new Uint8Array((0, BufferPadding_1.removeMessagePadding)(decrypted.plainText));
            const builtEnvelope = {
                content,
                source: decrypted.senderUnblinded,
                senderIdentity: decrypted.senderUnblinded,
                receivedAt: Date.now(),
                timestamp: postedAtInMs,
                id: (0, uuid_1.v4)(),
                type: protobuf_1.SignalService.Envelope.Type.SESSION_MESSAGE,
            };
            if (isOutbox) {
                const recipient = inboxOutboxItem.recipient;
                const contentDecoded = protobuf_1.SignalService.Content.decode(content);
                const unblindedIDOrBlinded = (await (0, knownBlindedkeys_1.findCachedBlindedMatchOrLookItUp)(recipient, serverPubkey, sodium)) || recipient;
                if (contentDecoded.dataMessage) {
                    const outboxConversationModel = await (0, conversations_1.getConversationController)().getOrCreateAndWait(unblindedIDOrBlinded, conversationAttributes_1.ConversationTypeEnum.PRIVATE);
                    const serverConversationId = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl)?.[0]
                        .conversationId;
                    if (!serverConversationId) {
                        throw new Error('serverConversationId needs to exist');
                    }
                    const msgModel = (0, messageFactory_1.createSwarmMessageSentFromUs)({
                        conversationId: unblindedIDOrBlinded,
                        messageHash: '',
                        sentAt: postedAtInMs,
                    });
                    await outboxConversationModel.setOriginConversationID(serverConversationId);
                    await (0, dataMessage_1.handleOutboxMessageModel)(msgModel, '', postedAtInMs, contentDecoded.dataMessage, outboxConversationModel);
                }
            }
            else {
                const sender = inboxOutboxItem.sender;
                try {
                    const match = (0, knownBlindedkeys_1.tryMatchBlindWithStandardKey)(decrypted.senderUnblinded, sender, serverPubkey, sodium);
                    if (!match) {
                        throw new Error(`tryMatchBlindWithStandardKey failed for blinded ${decrypted.senderUnblinded} and ${sender}`);
                    }
                    await (0, knownBlindedkeys_1.addCachedBlindedKey)({
                        blindedId: sender,
                        realSessionId: decrypted.senderUnblinded,
                        serverPublicKey: serverPubkey,
                    });
                    await (0, knownBlindedkeys_1.findCachedBlindedMatchOrLookItUp)(sender, serverPubkey, sodium);
                }
                catch (e) {
                    window.log.warn('tryMatchBlindWithStandardKey could not veriyfy');
                }
                await (0, contentMessage_1.innerHandleSwarmContentMessage)(builtEnvelope, postedAtInMs, builtEnvelope.content, '');
            }
        }
        catch (e) {
            window.log.warn('handleOutboxMessages failed with:', e.message);
        }
    }
    const rooms = opengroups_1.OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
    if (!rooms || !rooms.length) {
        window?.log?.error('handleInboxOutboxMessages - Found no rooms with matching server url');
        return;
    }
    const maxInboxOutboxId = inboxOutboxResponse.length
        ? Math.max(...inboxOutboxResponse.map(inboxOutboxItem => inboxOutboxItem.id))
        : undefined || undefined;
    if ((0, lodash_1.isNumber)(maxInboxOutboxId)) {
        const updatedRooms = isOutbox
            ? rooms.map(r => ({ ...r, lastOutboxIdFetched: maxInboxOutboxId }))
            : rooms.map(r => ({ ...r, lastInboxIdFetched: maxInboxOutboxId }));
        await opengroups_1.OpenGroupData.saveV2OpenGroupRooms(updatedRooms);
    }
}
const handleBatchPollResults = async (serverUrl, batchPollResults, subrequestOptionsLookup) => {
    await (0, sogsCapabilities_1.handleCapabilities)(subrequestOptionsLookup, batchPollResults, serverUrl);
    if (batchPollResults && (0, lodash_1.isArray)(batchPollResults.body)) {
        for (let index = 0; index < batchPollResults.body.length; index++) {
            const subResponse = batchPollResults.body[index];
            const subrequestOption = subrequestOptionsLookup[index];
            const responseType = subrequestOption.type;
            switch (responseType) {
                case 'capabilities':
                    break;
                case 'messages':
                    await handleMessagesResponseV4(subResponse.body, serverUrl, subrequestOption);
                    break;
                case 'pollInfo':
                    await handlePollInfoResponse(subResponse.code, subResponse.body, serverUrl);
                    break;
                case 'inbox':
                    await handleInboxOutboxMessages(subResponse.body, serverUrl, false);
                    break;
                case 'outbox':
                    await handleInboxOutboxMessages(subResponse.body, serverUrl, true);
                    break;
                default:
                    window.log.error('No matching subrequest response body for type: ', responseType);
            }
        }
    }
};
exports.handleBatchPollResults = handleBatchPollResults;
