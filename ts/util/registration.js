"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registration = void 0;
const storage_1 = require("./storage");
async function markEverDone() {
    await storage_1.Storage.put('chromiumRegistrationDoneEver', '');
}
async function markDone() {
    await markEverDone();
    await storage_1.Storage.put('chromiumRegistrationDone', '');
}
function isDone() {
    return storage_1.Storage.get('chromiumRegistrationDone') === '';
}
function everDone() {
    return (storage_1.Storage.get('chromiumRegistrationDoneEver') === '' ||
        storage_1.Storage.get('chromiumRegistrationDone') === '');
}
async function remove() {
    await storage_1.Storage.remove('chromiumRegistrationDone');
}
exports.Registration = { markEverDone, markDone, isDone, everDone, remove };
