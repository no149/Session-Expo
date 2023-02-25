"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSogsReactionOnionV4 = exports.hasReactionSupport = void 0;
const emoji_mart_1 = require("emoji-mart");
const data_1 = require("../../../../data/data");
const Reaction_1 = require("../../../../types/Reaction");
const reactions_1 = require("../../../../util/reactions");
const onionSend_1 = require("../../../onions/onionSend");
const utils_1 = require("../../../utils");
const OpenGroupPollingUtils_1 = require("../opengroupV2/OpenGroupPollingUtils");
const knownBlindedkeys_1 = require("./knownBlindedkeys");
const sogsV3BatchPoll_1 = require("./sogsV3BatchPoll");
const sogsV3MutationCache_1 = require("./sogsV3MutationCache");
const hasReactionSupport = async (serverId) => {
    const found = await data_1.Data.getMessageByServerId(serverId);
    if (!found) {
        window.log.warn(`Open Group Message ${serverId} not found in db`);
        return { supported: false, conversation: null };
    }
    const conversationModel = found?.getConversation();
    if (!conversationModel) {
        window.log.warn(`Conversation for ${serverId} not found in db`);
        return { supported: false, conversation: null };
    }
    if (!conversationModel.hasReactions()) {
        window.log.warn("This open group doesn't have reaction support. Server Message ID", serverId);
        return { supported: false, conversation: null };
    }
    return { supported: true, conversation: conversationModel };
};
exports.hasReactionSupport = hasReactionSupport;
const sendSogsReactionOnionV4 = async (serverUrl, room, abortSignal, reaction, blinded) => {
    const allValidRoomInfos = OpenGroupPollingUtils_1.OpenGroupPollingUtils.getAllValidRoomInfos(serverUrl, new Set([room]));
    if (!allValidRoomInfos?.length) {
        window?.log?.info('getSendReactionRequest: no valid roominfos got.');
        throw new Error(`Could not find sogs pubkey of url:${serverUrl}`);
    }
    const { supported, conversation } = await (0, exports.hasReactionSupport)(reaction.id);
    if (!supported) {
        return false;
    }
    if (reactions_1.Reactions.hitRateLimit()) {
        utils_1.ToastUtils.pushRateLimitHitReactions();
        return false;
    }
    if (!conversation) {
        window.log.warn(`Conversation for ${reaction.id} not found in db`);
        return false;
    }
    const emoji = (0, emoji_mart_1.getEmojiDataFromNative)(reaction.emoji) ? reaction.emoji : '🖾';
    const endpoint = `/room/${room}/reaction/${reaction.id}/${emoji}`;
    const method = reaction.action === Reaction_1.Action.REACT ? 'PUT' : 'DELETE';
    const serverPubkey = allValidRoomInfos[0].serverPublicKey;
    const cacheEntry = {
        server: serverUrl,
        room: room,
        changeType: sogsV3MutationCache_1.ChangeType.REACTIONS,
        seqno: null,
        metadata: {
            messageId: reaction.id,
            emoji,
            action: reaction.action === Reaction_1.Action.REACT ? 'ADD' : 'REMOVE',
        },
    };
    (0, sogsV3MutationCache_1.addToMutationCache)(cacheEntry);
    const me = utils_1.UserUtils.getOurPubKeyStrFromCache();
    await reactions_1.Reactions.handleMessageReaction({
        reaction,
        sender: blinded ? (0, knownBlindedkeys_1.getUsBlindedInThatServer)(conversation) || me : me,
        you: true,
        isOpenGroup: true,
    });
    const stringifiedBody = null;
    const result = await onionSend_1.OnionSending.sendJsonViaOnionV4ToSogs({
        serverUrl,
        endpoint,
        serverPubkey,
        method,
        abortSignal,
        blinded,
        stringifiedBody,
        headers: null,
        throwErrors: true,
    });
    if (!(0, sogsV3BatchPoll_1.batchGlobalIsSuccess)(result)) {
        window?.log?.warn('sendSogsReactionWithOnionV4 Got unknown status code; res:', result);
        throw new Error(`sendSogsReactionOnionV4: invalid status code: ${(0, sogsV3BatchPoll_1.parseBatchGlobalStatusCode)(result)}`);
    }
    if (!result) {
        throw new Error('Could not putReaction, res is invalid');
    }
    const rawMessage = result.body;
    if (!rawMessage) {
        throw new Error('putReaction parsing failed');
    }
    const success = Boolean(reaction.action === Reaction_1.Action.REACT ? rawMessage.added : rawMessage.removed);
    if (success) {
        (0, sogsV3MutationCache_1.updateMutationCache)(cacheEntry, rawMessage.seqno);
    }
    return success;
};
exports.sendSogsReactionOnionV4 = sendSogsReactionOnionV4;
