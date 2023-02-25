"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClosedGroupEncryptionPairRequestMessage = void 0;
const protobuf_1 = require("../../../../../protobuf");
const ClosedGroupMessage_1 = require("./ClosedGroupMessage");
class ClosedGroupEncryptionPairRequestMessage extends ClosedGroupMessage_1.ClosedGroupMessage {
    dataProto() {
        throw new Error('ClosedGroupEncryptionPairRequestMessage: This is unused for now ');
        const dataMessage = super.dataProto();
        dataMessage.closedGroupControlMessage.type =
            protobuf_1.SignalService.DataMessage.ClosedGroupControlMessage.Type.ENCRYPTION_KEY_PAIR_REQUEST;
        return dataMessage;
    }
}
exports.ClosedGroupEncryptionPairRequestMessage = ClosedGroupEncryptionPairRequestMessage;
