"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMessagesUsingCache = exports.updateMutationCache = exports.addToMutationCache = exports.getMutationCache = exports.ChangeType = void 0;
const lodash_1 = require("lodash");
const reactions_1 = require("../../../../util/reactions");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["REACTIONS"] = 0] = "REACTIONS";
})(ChangeType = exports.ChangeType || (exports.ChangeType = {}));
const sogsMutationCache = [];
function getMutationCache() {
    return sogsMutationCache;
}
exports.getMutationCache = getMutationCache;
function verifyEntry(entry) {
    return Boolean(entry.server &&
        entry.room &&
        entry.changeType === ChangeType.REACTIONS &&
        entry.metadata.messageId &&
        entry.metadata.emoji &&
        (entry.metadata.action === 'ADD' ||
            entry.metadata.action === 'REMOVE' ||
            entry.metadata.action === 'CLEAR'));
}
function addToMutationCache(entry) {
    if (!verifyEntry(entry)) {
        window.log.error('SOGS Mutation Cache: Entry verification on add failed!', entry);
    }
    else {
        sogsMutationCache.push(entry);
        window.log.info('SOGS Mutation Cache: Entry added!', entry);
    }
}
exports.addToMutationCache = addToMutationCache;
function updateMutationCache(entry, seqno) {
    if (!verifyEntry(entry)) {
        window.log.error('SOGS Mutation Cache: Entry verification on update failed!', entry);
    }
    else {
        const entryIndex = (0, lodash_1.findIndex)(sogsMutationCache, entry);
        if (entryIndex >= 0) {
            sogsMutationCache[entryIndex].seqno = seqno;
            window.log.info('SOGS Mutation Cache: Entry updated!', sogsMutationCache[entryIndex]);
        }
        else {
            window.log.error('SOGS Mutation Cache: Updated failed! Cannot find entry', entry);
        }
    }
}
exports.updateMutationCache = updateMutationCache;
async function processMessagesUsingCache(server, room, message) {
    const updatedReactions = message.reactions;
    const roomMatches = (0, lodash_1.filter)(sogsMutationCache, { server, room });
    for (let i = 0; i < roomMatches.length; i++) {
        const matchSeqno = roomMatches[i].seqno;
        if (message.seqno && matchSeqno && matchSeqno <= message.seqno) {
            const removedEntry = roomMatches.splice(i, 1)[0];
            window.log.info(`SOGS Mutation Cache: Entry ignored and removed in ${server}/${room} for message ${message.id}`, removedEntry);
            (0, lodash_1.remove)(sogsMutationCache, removedEntry);
        }
    }
    for (const reaction of Object.keys(message.reactions)) {
        const reactionMatches = (0, lodash_1.filter)(roomMatches, {
            server,
            room,
            changeType: ChangeType.REACTIONS,
            metadata: {
                messageId: message.id,
                emoji: reaction,
            },
        });
        for (const reactionMatch of reactionMatches) {
            switch (reactionMatch.metadata.action) {
                case 'ADD':
                    updatedReactions[reaction].you = true;
                    updatedReactions[reaction].count += 1;
                    window.log.info(`SOGS Mutation Cache: Added our reaction based on the cache in ${server}/${room} for message ${message.id}`, updatedReactions[reaction]);
                    break;
                case 'REMOVE':
                    updatedReactions[reaction].you = false;
                    updatedReactions[reaction].count -= 1;
                    window.log.info(`SOGS Mutation Cache: Removed our reaction based on the cache in ${server}/${room} for message ${message.id}`, updatedReactions[reaction]);
                    break;
                case 'CLEAR':
                    delete updatedReactions[reaction];
                    window.log.info(`SOGS Mutation Cache: Cleared all ${reaction} reactions based on the cache in ${server}/${room} for message ${message.id}`);
                    break;
                default:
                    window.log.warn(`SOGS Mutation Cache: Unsupported metadata action in OpenGroupMessageV4 in ${server}/${room} for message ${message.id}`, reactionMatch);
            }
            const removedEntry = (0, lodash_1.remove)(sogsMutationCache, reactionMatch);
            window.log.info(`SOGS Mutation Cache: Entry removed in ${server}/${room} for message ${message.id}`, removedEntry);
        }
    }
    message.reactions = updatedReactions;
    await reactions_1.Reactions.handleOpenGroupMessageReactions(message.reactions, message.id);
    return message;
}
exports.processMessagesUsingCache = processMessagesUsingCache;
