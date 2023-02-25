"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reactions = void 0;
const lodash_1 = require("lodash");
const data_1 = require("../data/data");
const knownBlindedkeys_1 = require("../session/apis/open_group_api/sogsv3/knownBlindedkeys");
const utils_1 = require("../session/utils");
const Reaction_1 = require("../types/Reaction");
const storage_1 = require("../util/storage");
const SOGSReactorsFetchCount = 5;
const rateCountLimit = 20;
const rateTimeLimit = 60 * 1000;
const latestReactionTimestamps = [];
function hitRateLimit() {
    const now = Date.now();
    latestReactionTimestamps.push(now);
    if (latestReactionTimestamps.length > rateCountLimit) {
        const firstTimestamp = latestReactionTimestamps[0];
        if (now - firstTimestamp < rateTimeLimit) {
            latestReactionTimestamps.pop();
            window.log.warn(`Only ${rateCountLimit} reactions are allowed per minute`);
            return true;
        }
        else {
            latestReactionTimestamps.shift();
        }
    }
    return false;
}
const getMessageByReaction = async (reaction, isOpenGroup) => {
    let originalMessage = null;
    const originalMessageId = Number(reaction.id);
    const originalMessageAuthor = reaction.author;
    if (isOpenGroup) {
        originalMessage = await data_1.Data.getMessageByServerId(originalMessageId);
    }
    else {
        const collection = await data_1.Data.getMessagesBySentAt(originalMessageId);
        originalMessage = collection.find((item) => {
            const messageTimestamp = item.get('sent_at');
            const author = item.get('source');
            return Boolean(messageTimestamp &&
                messageTimestamp === originalMessageId &&
                author &&
                author === originalMessageAuthor);
        });
    }
    if (!originalMessage) {
        window?.log?.warn(`Cannot find the original reacted message ${originalMessageId}.`);
        return null;
    }
    return originalMessage;
};
const sendMessageReaction = async (messageId, emoji) => {
    const found = await data_1.Data.getMessageById(messageId);
    if (found) {
        const conversationModel = found?.getConversation();
        if (!conversationModel) {
            window.log.warn(`Conversation for ${messageId} not found in db`);
            return;
        }
        if (!conversationModel.hasReactions()) {
            window.log.warn("This conversation doesn't have reaction support");
            return;
        }
        if (hitRateLimit()) {
            utils_1.ToastUtils.pushRateLimitHitReactions();
            return;
        }
        let me = utils_1.UserUtils.getOurPubKeyStrFromCache();
        let id = Number(found.get('sent_at'));
        if (found.get('isPublic')) {
            if (found.get('serverId')) {
                id = found.get('serverId') || id;
                me = (0, knownBlindedkeys_1.getUsBlindedInThatServer)(conversationModel) || me;
            }
            else {
                window.log.warn(`Server Id was not found in message ${messageId} for opengroup reaction`);
                return;
            }
        }
        const author = found.get('source');
        let action = Reaction_1.Action.REACT;
        const reacts = found.get('reacts');
        if (reacts?.[emoji]?.senders?.includes(me)) {
            window.log.info('Found matching reaction removing it');
            action = Reaction_1.Action.REMOVE;
        }
        else {
            const reactions = (0, storage_1.getRecentReactions)();
            if (reactions) {
                await updateRecentReactions(reactions, emoji);
            }
        }
        const reaction = {
            id,
            author,
            emoji,
            action,
        };
        await conversationModel.sendReaction(messageId, reaction);
        window.log.info(`You ${action === Reaction_1.Action.REACT ? 'added' : 'removed'} a`, emoji, 'reaction for message', id, found.get('isPublic')
            ? `on ${conversationModel.toOpenGroupV2().serverUrl}/${conversationModel.toOpenGroupV2().roomId}`
            : '');
        return reaction;
    }
    else {
        window.log.warn(`Message ${messageId} not found in db`);
        return;
    }
};
const handleMessageReaction = async ({ reaction, sender, you, isOpenGroup, }) => {
    if (!reaction.emoji) {
        window?.log?.warn(`There is no emoji for the reaction ${reaction}.`);
        return;
    }
    const originalMessage = await getMessageByReaction(reaction, isOpenGroup);
    if (!originalMessage) {
        return;
    }
    const reacts = originalMessage.get('reacts') ?? {};
    reacts[reaction.emoji] = reacts[reaction.emoji] || { count: null, senders: [] };
    const details = reacts[reaction.emoji] ?? {};
    const senders = details.senders;
    let count = details.count || 0;
    if (details.you && senders.includes(sender)) {
        if (reaction.action === Reaction_1.Action.REACT) {
            window.log.warn('Received duplicate message for your reaction. Ignoring it');
            return;
        }
        else {
            details.you = false;
        }
    }
    else {
        details.you = you;
    }
    switch (reaction.action) {
        case Reaction_1.Action.REACT:
            if (senders.includes(sender)) {
                window.log.warn('Received duplicate reaction message. Ignoring it', reaction, sender);
                return;
            }
            details.senders.push(sender);
            count += 1;
            break;
        case Reaction_1.Action.REMOVE:
        default:
            if (senders?.length > 0) {
                const sendersIndex = senders.indexOf(sender);
                if (sendersIndex >= 0) {
                    details.senders.splice(sendersIndex, 1);
                    count -= 1;
                }
            }
    }
    if (count > 0) {
        reacts[reaction.emoji].count = count;
        reacts[reaction.emoji].senders = details.senders;
        reacts[reaction.emoji].you = details.you;
        if (details && details.index === undefined) {
            reacts[reaction.emoji].index = originalMessage.get('reactsIndex') ?? 0;
            originalMessage.set('reactsIndex', (originalMessage.get('reactsIndex') ?? 0) + 1);
        }
    }
    else {
        delete reacts[reaction.emoji];
    }
    originalMessage.set({
        reacts: !(0, lodash_1.isEmpty)(reacts) ? reacts : undefined,
    });
    await originalMessage.commit();
    if (!you) {
        window.log.info(`${sender} ${reaction.action === Reaction_1.Action.REACT ? 'added' : 'removed'} a ${reaction.emoji} reaction`);
    }
    return originalMessage;
};
const handleClearReaction = async (serverId, emoji) => {
    const originalMessage = await data_1.Data.getMessageByServerId(serverId);
    if (!originalMessage) {
        window?.log?.warn(`Cannot find the original reacted message ${serverId}.`);
        return;
    }
    const reacts = originalMessage.get('reacts');
    if (reacts) {
        delete reacts[emoji];
    }
    originalMessage.set({
        reacts: !(0, lodash_1.isEmpty)(reacts) ? reacts : undefined,
    });
    await originalMessage.commit();
    window.log.info(`You cleared all ${emoji} reactions on message ${serverId}`);
    return originalMessage;
};
const handleOpenGroupMessageReactions = async (reactions, serverId) => {
    const originalMessage = await data_1.Data.getMessageByServerId(serverId);
    if (!originalMessage) {
        window?.log?.warn(`Cannot find the original reacted message ${serverId}.`);
        return;
    }
    if (!originalMessage.get('isPublic')) {
        window.log.warn('handleOpenGroupMessageReactions() should only be used in opengroups');
        return;
    }
    if ((0, lodash_1.isEmpty)(reactions)) {
        if (originalMessage.get('reacts')) {
            originalMessage.set({
                reacts: undefined,
            });
        }
    }
    else {
        const reacts = {};
        Object.keys(reactions).forEach(key => {
            const emoji = decodeURI(key);
            const you = reactions[key].you || false;
            if (you) {
                if (reactions[key]?.reactors.length > 0) {
                    const reactorsWithoutMe = reactions[key].reactors.filter(reactor => !(0, knownBlindedkeys_1.isUsAnySogsFromCache)(reactor));
                    if (reactorsWithoutMe.length === SOGSReactorsFetchCount) {
                        reactorsWithoutMe.pop();
                    }
                    const conversationModel = originalMessage?.getConversation();
                    if (conversationModel) {
                        const me = (0, knownBlindedkeys_1.getUsBlindedInThatServer)(conversationModel) || utils_1.UserUtils.getOurPubKeyStrFromCache();
                        reactions[key].reactors = [me, ...reactorsWithoutMe];
                    }
                }
            }
            const senders = [];
            reactions[key].reactors.forEach(reactor => {
                senders.push(reactor);
            });
            if (reactions[key].count > 0) {
                reacts[emoji] = {
                    count: reactions[key].count,
                    index: reactions[key].index,
                    senders,
                    you,
                };
            }
            else {
                delete reacts[key];
            }
        });
        originalMessage.set({
            reacts,
        });
    }
    await originalMessage.commit();
    return originalMessage;
};
const updateRecentReactions = async (reactions, newReaction) => {
    window?.log?.info('updating recent reactions with', newReaction);
    const recentReactions = new Reaction_1.RecentReactions(reactions);
    const foundIndex = recentReactions.items.indexOf(newReaction);
    if (foundIndex === 0) {
        return;
    }
    if (foundIndex > 0) {
        recentReactions.swap(foundIndex);
    }
    else {
        recentReactions.push(newReaction);
    }
    await (0, storage_1.saveRecentReations)(recentReactions.items);
};
exports.Reactions = {
    SOGSReactorsFetchCount,
    hitRateLimit,
    sendMessageReaction,
    handleMessageReaction,
    handleClearReaction,
    handleOpenGroupMessageReactions,
    updateRecentReactions,
};
