"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAttachmentPadding = exports.getUnpaddedAttachment = exports.addMessagePadding = exports.removeMessagePadding = void 0;
const PADDING_BYTE = 0x00;
function removeMessagePadding(paddedData) {
    const paddedPlaintext = new Uint8Array(paddedData);
    for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
        if (paddedPlaintext[i] === 0x80) {
            const plaintext = new Uint8Array(i);
            plaintext.set(paddedPlaintext.subarray(0, i));
            return plaintext.buffer;
        }
        else if (paddedPlaintext[i] !== PADDING_BYTE) {
            return paddedPlaintext;
        }
    }
    throw new Error('Invalid padding');
}
exports.removeMessagePadding = removeMessagePadding;
function addMessagePadding(messageBuffer) {
    const plaintext = new Uint8Array(getPaddedMessageLength(messageBuffer.byteLength + 1) - 1);
    plaintext.set(new Uint8Array(messageBuffer));
    plaintext[messageBuffer.byteLength] = 0x80;
    return plaintext;
}
exports.addMessagePadding = addMessagePadding;
function getPaddedMessageLength(originalLength) {
    const messageLengthWithTerminator = originalLength + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);
    if (messageLengthWithTerminator % 160 !== 0) {
        messagePartCount += 1;
    }
    return messagePartCount * 160;
}
function getUnpaddedAttachment(data, unpaddedExpectedSize) {
    if (data.byteLength <= unpaddedExpectedSize) {
        return null;
    }
    return data.slice(0, unpaddedExpectedSize);
}
exports.getUnpaddedAttachment = getUnpaddedAttachment;
function addAttachmentPadding(data) {
    const originalUInt = new Uint8Array(data);
    window?.log?.info('Adding attachment padding...');
    const paddedSize = Math.max(541, Math.floor(Math.pow(1.05, Math.ceil(Math.log(originalUInt.length) / Math.log(1.05)))));
    const paddedData = new ArrayBuffer(paddedSize);
    const paddedUInt = new Uint8Array(paddedData);
    paddedUInt.fill(PADDING_BYTE, originalUInt.length);
    paddedUInt.set(originalUInt);
    return paddedUInt.buffer;
}
exports.addAttachmentPadding = addAttachmentPadding;
