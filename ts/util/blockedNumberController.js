"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockedNumberController = void 0;
const data_1 = require("../data/data");
const conversations_1 = require("../session/conversations");
const types_1 = require("../session/types");
const utils_1 = require("../session/utils");
const BLOCKED_NUMBERS_ID = 'blocked';
const BLOCKED_GROUPS_ID = 'blocked-groups';
class BlockedNumberController {
    static loaded = false;
    static blockedNumbers = new Set();
    static blockedGroups = new Set();
    static async isBlockedAsync(user) {
        await this.load();
        const isOurDevice = utils_1.UserUtils.isUsFromCache(user);
        if (isOurDevice) {
            return false;
        }
        const pubkey = types_1.PubKey.cast(user);
        return this.blockedNumbers.has(pubkey.key);
    }
    static isBlocked(device) {
        const stringValue = device instanceof types_1.PubKey ? device.key : device.toLowerCase();
        return this.blockedNumbers.has(stringValue);
    }
    static isGroupBlocked(groupId) {
        const stringValue = groupId instanceof types_1.PubKey ? groupId.key : groupId.toLowerCase();
        return this.blockedGroups.has(stringValue);
    }
    static async block(user) {
        await this.load();
        const toBlock = types_1.PubKey.cast(user);
        if (!this.blockedNumbers.has(toBlock.key)) {
            this.blockedNumbers.add(toBlock.key);
            await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
        }
    }
    static async unblock(user) {
        await this.load();
        const toUnblock = types_1.PubKey.cast(user);
        if (this.blockedNumbers.has(toUnblock.key)) {
            this.blockedNumbers.delete(toUnblock.key);
            await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
        }
    }
    static async unblockAll(users) {
        await this.load();
        let changes = false;
        users.forEach(user => {
            const toUnblock = types_1.PubKey.cast(user);
            if (this.blockedNumbers.has(toUnblock.key)) {
                this.blockedNumbers.delete(toUnblock.key);
                changes = true;
            }
        });
        users.map(user => {
            const found = (0, conversations_1.getConversationController)().get(user);
            if (found) {
                found.triggerUIRefresh();
            }
        });
        if (changes) {
            await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
        }
    }
    static async setBlocked(user, blocked) {
        if (blocked) {
            return BlockedNumberController.block(user);
        }
        return BlockedNumberController.unblock(user);
    }
    static async setGroupBlocked(groupId, blocked) {
        if (blocked) {
            return BlockedNumberController.blockGroup(groupId);
        }
        return BlockedNumberController.unblockGroup(groupId);
    }
    static async blockGroup(groupId) {
        await this.load();
        const id = types_1.PubKey.cast(groupId);
        this.blockedGroups.add(id.key);
        await this.saveToDB(BLOCKED_GROUPS_ID, this.blockedGroups);
    }
    static async unblockGroup(groupId) {
        await this.load();
        const id = types_1.PubKey.cast(groupId);
        this.blockedGroups.delete(id.key);
        await this.saveToDB(BLOCKED_GROUPS_ID, this.blockedGroups);
    }
    static getBlockedNumbers() {
        return [...this.blockedNumbers];
    }
    static getBlockedGroups() {
        return [...this.blockedGroups];
    }
    static async load() {
        if (!this.loaded) {
            this.blockedNumbers = await this.getNumbersFromDB(BLOCKED_NUMBERS_ID);
            this.blockedGroups = await this.getNumbersFromDB(BLOCKED_GROUPS_ID);
            this.loaded = true;
        }
    }
    static reset() {
        this.loaded = false;
        this.blockedNumbers = new Set();
        this.blockedGroups = new Set();
    }
    static async getNumbersFromDB(id) {
        const data = await data_1.Data.getItemById(id);
        if (!data || !data.value) {
            return new Set();
        }
        return new Set(data.value);
    }
    static async saveToDB(id, numbers) {
        await data_1.Data.createOrUpdateItem({
            id,
            value: [...numbers],
        });
    }
}
exports.BlockedNumberController = BlockedNumberController;
