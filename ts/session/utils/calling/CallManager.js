"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentCallDuration = exports.onTurnedOnCallMediaPermissions = exports.handleOtherCallTypes = exports.handleCallTypeIceCandidates = exports.handleCallTypeAnswer = exports.handleMissedCall = exports.handleCallTypeOffer = exports.isCallRejected = exports.handleCallTypeEndCall = exports.USER_hangup = exports.USER_rejectIncomingCallRequest = exports.rejectCallAlreadyAnotherCall = exports.USER_acceptIncomingCallRequest = exports.USER_callRecipient = exports.selectAudioOutputByDeviceId = exports.selectAudioInputByDeviceId = exports.selectCameraByDeviceId = exports.DEVICE_DISABLED_DEVICE_ID = exports.removeVideoEventsListener = exports.addVideoEventsListener = exports.callTimeoutMs = void 0;
const lodash_1 = __importDefault(require("lodash"));
const __1 = require("../");
const protobuf_1 = require("../../../protobuf");
const conversations_1 = require("../../../state/ducks/conversations");
const call_1 = require("../../../state/ducks/call");
const conversations_2 = require("../../conversations");
const CallMessage_1 = require("../../messages/outgoing/controlMessage/CallMessage");
const onionPath_1 = require("../../onions/onionPath");
const types_1 = require("../../types");
const uuid_1 = require("uuid");
const RingingManager_1 = require("../RingingManager");
const Silence_1 = require("./Silence");
const __2 = require("../..");
const sending_1 = require("../../sending");
const constants_1 = require("../../constants");
const data_1 = require("../../../data/data");
const SessionSettings_1 = require("../../../components/settings/SessionSettings");
const push_notification_api_1 = require("../../apis/push_notification_api");
const SNodeAPI_1 = require("../../apis/snode_api/SNodeAPI");
const conversationInteractions_1 = require("../../../interactions/conversationInteractions");
exports.callTimeoutMs = 60000;
let currentCallUUID;
let currentCallStartTimestamp;
let weAreCallerOnCurrentCall;
const rejectedCallUUIDS = new Set();
const videoEventsListeners = [];
function callVideoListeners() {
    if (videoEventsListeners.length) {
        videoEventsListeners.forEach(item => {
            item.listener?.({
                localStream,
                remoteStream,
                camerasList,
                audioInputsList,
                audioOutputsList,
                isRemoteVideoStreamMuted: remoteVideoStreamIsMuted,
                isLocalVideoStreamMuted: selectedCameraId === exports.DEVICE_DISABLED_DEVICE_ID,
                isAudioMuted: selectedAudioInputId === exports.DEVICE_DISABLED_DEVICE_ID,
                currentSelectedAudioOutput: selectedAudioOutputId,
            });
        });
    }
}
function addVideoEventsListener(uniqueId, listener) {
    const indexFound = videoEventsListeners.findIndex(m => m.id === uniqueId);
    if (indexFound === -1) {
        videoEventsListeners.push({ id: uniqueId, listener });
    }
    else {
        videoEventsListeners[indexFound].listener = listener;
    }
    callVideoListeners();
}
exports.addVideoEventsListener = addVideoEventsListener;
function removeVideoEventsListener(uniqueId) {
    const indexFound = videoEventsListeners.findIndex(m => m.id === uniqueId);
    if (indexFound !== -1) {
        videoEventsListeners.splice(indexFound);
    }
    callVideoListeners();
}
exports.removeVideoEventsListener = removeVideoEventsListener;
const callCache = new Map();
let peerConnection;
let dataChannel;
let remoteStream;
let localStream;
let remoteVideoStreamIsMuted = true;
exports.DEVICE_DISABLED_DEVICE_ID = 'off';
let makingOffer = false;
let ignoreOffer = false;
let isSettingRemoteAnswerPending = false;
let lastOutgoingOfferTimestamp = -Infinity;
const iceServersFullArray = [
    {
        urls: 'turn:freyr.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:fenrir.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:frigg.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:angus.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:hereford.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:holstein.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
    {
        urls: 'turn:brahman.getsession.org',
        username: 'session202111',
        credential: '053c268164bc7bd7',
    },
];
const configuration = {
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
};
let selectedCameraId = exports.DEVICE_DISABLED_DEVICE_ID;
let selectedAudioInputId = exports.DEVICE_DISABLED_DEVICE_ID;
let selectedAudioOutputId = exports.DEVICE_DISABLED_DEVICE_ID;
let camerasList = [];
let audioInputsList = [];
let audioOutputsList = [];
async function getConnectedDevices(type) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === type);
}
if (typeof navigator !== 'undefined') {
    navigator?.mediaDevices?.addEventListener('devicechange', async () => {
        await updateConnectedDevices();
        callVideoListeners();
    });
}
async function updateConnectedDevices() {
    const videoCameras = await getConnectedDevices('videoinput');
    camerasList = videoCameras.map(m => ({
        deviceId: m.deviceId,
        label: m.label,
    }));
    const audiosInput = await getConnectedDevices('audioinput');
    audioInputsList = audiosInput.map(m => ({
        deviceId: m.deviceId,
        label: m.label,
    }));
    const audiosOutput = await getConnectedDevices('audiooutput');
    audioOutputsList = audiosOutput.map(m => ({
        deviceId: m.deviceId,
        label: m.label,
    }));
}
function sendVideoStatusViaDataChannel() {
    const videoEnabledLocally = selectedCameraId !== exports.DEVICE_DISABLED_DEVICE_ID;
    const stringToSend = JSON.stringify({
        video: videoEnabledLocally,
    });
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel?.send(stringToSend);
    }
}
function sendHangupViaDataChannel() {
    const stringToSend = JSON.stringify({
        hangup: true,
    });
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel?.send(stringToSend);
    }
}
async function selectCameraByDeviceId(cameraDeviceId) {
    if (cameraDeviceId === exports.DEVICE_DISABLED_DEVICE_ID) {
        selectedCameraId = exports.DEVICE_DISABLED_DEVICE_ID;
        const sender = peerConnection?.getSenders().find(s => {
            return s.track?.kind === 'video';
        });
        if (sender?.track) {
            sender.track.enabled = false;
        }
        localStream?.getVideoTracks().forEach(t => {
            t.stop();
            localStream?.removeTrack(t);
        });
        localStream?.addTrack((0, Silence_1.getBlackSilenceMediaStream)().getVideoTracks()[0]);
        sendVideoStatusViaDataChannel();
        callVideoListeners();
        return;
    }
    if (camerasList.some(m => m.deviceId === cameraDeviceId)) {
        selectedCameraId = cameraDeviceId;
        const devicesConfig = {
            video: {
                deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
            },
        };
        try {
            const newVideoStream = await navigator.mediaDevices.getUserMedia(devicesConfig);
            const videoTrack = newVideoStream.getVideoTracks()[0];
            if (!peerConnection) {
                throw new Error('cannot selectCameraByDeviceId without a peer connection');
            }
            window.log.info('replacing video track');
            const videoSender = peerConnection
                .getTransceivers()
                .find(t => t.sender.track?.kind === 'video')?.sender;
            videoTrack.enabled = true;
            if (videoSender) {
                await videoSender.replaceTrack(videoTrack);
            }
            else {
                throw new Error('We should always have a videoSender as we are using a black video when no camera are in use');
            }
            localStream?.getVideoTracks().forEach(t => {
                t.stop();
                localStream?.removeTrack(t);
            });
            localStream?.addTrack(videoTrack);
            sendVideoStatusViaDataChannel();
            callVideoListeners();
        }
        catch (e) {
            window.log.warn('selectCameraByDeviceId failed with', e.message);
            __1.ToastUtils.pushToastError('selectCamera', e.message);
            callVideoListeners();
        }
    }
}
exports.selectCameraByDeviceId = selectCameraByDeviceId;
async function selectAudioInputByDeviceId(audioInputDeviceId) {
    if (audioInputDeviceId === exports.DEVICE_DISABLED_DEVICE_ID) {
        selectedAudioInputId = audioInputDeviceId;
        const sender = peerConnection?.getSenders().find(s => {
            return s.track?.kind === 'audio';
        });
        if (sender?.track) {
            sender.track.enabled = false;
        }
        const silence = (0, Silence_1.getBlackSilenceMediaStream)().getAudioTracks()[0];
        sender?.replaceTrack(silence);
        localStream?.getAudioTracks().forEach(t => {
            t.stop();
            localStream?.removeTrack(t);
        });
        localStream?.addTrack((0, Silence_1.getBlackSilenceMediaStream)().getAudioTracks()[0]);
        callVideoListeners();
        return;
    }
    if (audioInputsList.some(m => m.deviceId === audioInputDeviceId)) {
        selectedAudioInputId = audioInputDeviceId;
        const devicesConfig = {
            audio: {
                deviceId: selectedAudioInputId ? { exact: selectedAudioInputId } : undefined,
            },
        };
        try {
            const newAudioStream = await navigator.mediaDevices.getUserMedia(devicesConfig);
            const audioTrack = newAudioStream.getAudioTracks()[0];
            if (!peerConnection) {
                throw new Error('cannot selectAudioInputByDeviceId without a peer connection');
            }
            const audioSender = peerConnection.getSenders().find(s => {
                return s.track?.kind === audioTrack.kind;
            });
            window.log.info('replacing audio track');
            localStream?.getAudioTracks().forEach(t => {
                t.stop();
                localStream?.removeTrack(t);
            });
            if (audioSender) {
                await audioSender.replaceTrack(audioTrack);
            }
            else {
                throw new Error('Failed to get sender for selectAudioInputByDeviceId ');
            }
        }
        catch (e) {
            window.log.warn('selectAudioInputByDeviceId failed with', e.message);
        }
        callVideoListeners();
    }
}
exports.selectAudioInputByDeviceId = selectAudioInputByDeviceId;
async function selectAudioOutputByDeviceId(audioOutputDeviceId) {
    if (audioOutputDeviceId === exports.DEVICE_DISABLED_DEVICE_ID) {
        selectedAudioOutputId = audioOutputDeviceId;
        callVideoListeners();
        return;
    }
    if (audioOutputsList.some(m => m.deviceId === audioOutputDeviceId)) {
        selectedAudioOutputId = audioOutputDeviceId;
        callVideoListeners();
    }
}
exports.selectAudioOutputByDeviceId = selectAudioOutputByDeviceId;
async function createOfferAndSendIt(recipient) {
    try {
        makingOffer = true;
        window.log.info('got createOfferAndSendIt event. creating offer');
        await peerConnection?.setLocalDescription();
        const offer = peerConnection?.localDescription;
        if (!offer) {
            throw new Error('Could not create an offer');
        }
        if (!currentCallUUID) {
            window.log.warn('cannot send offer without a currentCallUUID');
            throw new Error('cannot send offer without a currentCallUUID');
        }
        if (offer && offer.sdp) {
            const lines = offer.sdp.split(/\r?\n/);
            const lineWithFtmpIndex = lines.findIndex(f => f.startsWith('a=fmtp:111'));
            const partBeforeComma = lines[lineWithFtmpIndex].split(';');
            lines[lineWithFtmpIndex] = `${partBeforeComma[0]};cbr=1`;
            let overridenSdps = lines.join('\n');
            overridenSdps = overridenSdps.replace(new RegExp('.+urn:ietf:params:rtp-hdrext:ssrc-audio-level.*\\r?\\n'), '');
            const offerMessage = new CallMessage_1.CallMessage({
                timestamp: Date.now(),
                type: protobuf_1.SignalService.CallMessage.Type.OFFER,
                sdps: [overridenSdps],
                uuid: currentCallUUID,
            });
            window.log.info(`sending '${offer.type}'' with callUUID: ${currentCallUUID}`);
            const negotiationOfferSendResult = await (0, __2.getMessageQueue)().sendToPubKeyNonDurably(types_1.PubKey.cast(recipient), offerMessage);
            if (typeof negotiationOfferSendResult === 'number') {
                lastOutgoingOfferTimestamp = negotiationOfferSendResult;
            }
        }
    }
    catch (err) {
        window.log?.error(`Error createOfferAndSendIt ${err}`);
    }
    finally {
        makingOffer = false;
    }
}
function handleIceCandidates(event, pubkey) {
    if (event.candidate) {
        iceCandidates.push(event.candidate);
        void iceSenderDebouncer(pubkey);
    }
}
async function openMediaDevicesAndAddTracks() {
    try {
        await updateConnectedDevices();
        if (!audioInputsList.length) {
            __1.ToastUtils.pushNoAudioInputFound();
            return;
        }
        selectedAudioInputId = exports.DEVICE_DISABLED_DEVICE_ID;
        selectedCameraId = exports.DEVICE_DISABLED_DEVICE_ID;
        window.log.info(`openMediaDevices videoDevice:${selectedCameraId} audioDevice:${selectedAudioInputId}`);
        localStream = (0, Silence_1.getBlackSilenceMediaStream)();
        localStream.getTracks().map(track => {
            if (localStream) {
                peerConnection?.addTrack(track, localStream);
            }
        });
    }
    catch (err) {
        window.log.warn('openMediaDevices: ', err);
        __1.ToastUtils.pushVideoCallPermissionNeeded();
        closeVideoCall();
    }
    callVideoListeners();
}
async function USER_callRecipient(recipient) {
    if (!(0, SessionSettings_1.getCallMediaPermissionsSettings)()) {
        __1.ToastUtils.pushVideoCallPermissionNeeded();
        return;
    }
    if (currentCallUUID) {
        window.log.warn('Looks like we are already in a call as in USER_callRecipient is not undefined');
        return;
    }
    await updateConnectedDevices();
    const now = Date.now();
    window?.log?.info(`starting call with ${(0, onionPath_1.ed25519Str)(recipient)}..`);
    window.inboxStore?.dispatch((0, call_1.startingCallWith)({
        pubkey: recipient,
    }));
    if (peerConnection) {
        throw new Error('USER_callRecipient peerConnection is already initialized ');
    }
    currentCallUUID = (0, uuid_1.v4)();
    const justCreatedCallUUID = currentCallUUID;
    peerConnection = createOrGetPeerConnection(recipient);
    const preOfferMsg = new CallMessage_1.CallMessage({
        timestamp: now,
        type: protobuf_1.SignalService.CallMessage.Type.PRE_OFFER,
        uuid: currentCallUUID,
    });
    window.log.info('Sending preOffer message to ', (0, onionPath_1.ed25519Str)(recipient));
    const calledConvo = (0, conversations_2.getConversationController)().get(recipient);
    calledConvo.set('active_at', Date.now());
    weAreCallerOnCurrentCall = true;
    await calledConvo?.addSingleOutgoingMessage({
        sent_at: now,
        expireTimer: 0,
        callNotificationType: 'started-call',
    });
    await (0, conversationInteractions_1.approveConvoAndSendResponse)(recipient, true);
    const rawMessage = await __1.MessageUtils.toRawMessage(types_1.PubKey.cast(recipient), preOfferMsg);
    const { wrappedEnvelope } = await sending_1.MessageSender.send(rawMessage);
    void push_notification_api_1.PnServer.notifyPnServer(wrappedEnvelope, recipient);
    await openMediaDevicesAndAddTracks();
    await createOfferAndSendIt(recipient);
    global.setTimeout(async () => {
        if (justCreatedCallUUID === currentCallUUID && (0, RingingManager_1.getIsRinging)()) {
            window.log.info('calling timeout reached. hanging up the call we started:', justCreatedCallUUID);
            await USER_hangup(recipient);
        }
    }, exports.callTimeoutMs);
}
exports.USER_callRecipient = USER_callRecipient;
const iceCandidates = new Array();
const iceSenderDebouncer = lodash_1.default.debounce(async (recipient) => {
    if (!iceCandidates) {
        return;
    }
    const validCandidates = lodash_1.default.compact(iceCandidates.map(c => {
        if (c.sdpMLineIndex !== null &&
            c.sdpMLineIndex !== undefined &&
            c.sdpMid !== null &&
            c.candidate) {
            return {
                sdpMLineIndex: c.sdpMLineIndex,
                sdpMid: c.sdpMid,
                candidate: c.candidate,
            };
        }
        return null;
    }));
    if (!currentCallUUID) {
        window.log.warn('Cannot send ice candidates without a currentCallUUID');
        return;
    }
    const callIceCandicates = new CallMessage_1.CallMessage({
        timestamp: Date.now(),
        type: protobuf_1.SignalService.CallMessage.Type.ICE_CANDIDATES,
        sdpMLineIndexes: validCandidates.map(c => c.sdpMLineIndex),
        sdpMids: validCandidates.map(c => c.sdpMid),
        sdps: validCandidates.map(c => c.candidate),
        uuid: currentCallUUID,
    });
    window.log.info(`sending ICE CANDIDATES MESSAGE to ${(0, onionPath_1.ed25519Str)(recipient)} about call ${currentCallUUID}`);
    await (0, __2.getMessageQueue)().sendToPubKeyNonDurably(types_1.PubKey.cast(recipient), callIceCandicates);
}, 2000);
const findLastMessageTypeFromSender = (sender, msgType) => {
    const msgCacheFromSenderWithDevices = callCache.get(sender);
    if (!msgCacheFromSenderWithDevices) {
        return undefined;
    }
    const allMsg = lodash_1.default.flattenDeep([...msgCacheFromSenderWithDevices.values()]);
    const allMsgFromType = allMsg.filter(m => m.type === msgType);
    const lastMessageOfType = lodash_1.default.last(allMsgFromType);
    if (!lastMessageOfType) {
        return undefined;
    }
    return lastMessageOfType;
};
function handleSignalingStateChangeEvent() {
    if (peerConnection?.signalingState === 'closed') {
        closeVideoCall();
    }
}
function handleConnectionStateChanged(pubkey) {
    window.log.info('handleConnectionStateChanged :', peerConnection?.connectionState);
    if (peerConnection?.signalingState === 'closed' || peerConnection?.connectionState === 'failed') {
        window.inboxStore?.dispatch((0, call_1.callReconnecting)({ pubkey }));
    }
    else if (peerConnection?.connectionState === 'connected') {
        const firstAudioInput = audioInputsList?.[0].deviceId || undefined;
        if (firstAudioInput) {
            void selectAudioInputByDeviceId(firstAudioInput);
        }
        const firstAudioOutput = audioOutputsList?.[0].deviceId || undefined;
        if (firstAudioOutput) {
            void selectAudioOutputByDeviceId(firstAudioOutput);
        }
        currentCallStartTimestamp = Date.now();
        window.inboxStore?.dispatch((0, call_1.callConnected)({ pubkey }));
    }
}
function closeVideoCall() {
    window.log.info('closingVideoCall ');
    currentCallStartTimestamp = undefined;
    weAreCallerOnCurrentCall = undefined;
    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.onicegatheringstatechange = null;
        peerConnection.onnegotiationneeded = null;
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                localStream?.removeTrack(track);
            });
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => {
                track.stop();
                remoteStream?.removeTrack(track);
            });
        }
        peerConnection.close();
        peerConnection = null;
    }
    localStream = null;
    remoteStream = null;
    selectedCameraId = exports.DEVICE_DISABLED_DEVICE_ID;
    selectedAudioInputId = exports.DEVICE_DISABLED_DEVICE_ID;
    currentCallUUID = undefined;
    window.inboxStore?.dispatch((0, call_1.setFullScreenCall)(false));
    window.inboxStore?.dispatch((0, call_1.endCall)());
    remoteVideoStreamIsMuted = true;
    makingOffer = false;
    ignoreOffer = false;
    isSettingRemoteAnswerPending = false;
    lastOutgoingOfferTimestamp = -Infinity;
    callVideoListeners();
}
function getCallingStateOutsideOfRedux() {
    const ongoingCallWith = window.inboxStore?.getState().call.ongoingWith;
    const ongoingCallStatus = window.inboxStore?.getState().call.ongoingCallStatus;
    return { ongoingCallWith, ongoingCallStatus };
}
function onDataChannelReceivedMessage(ev) {
    try {
        const parsed = JSON.parse(ev.data);
        if (parsed.hangup !== undefined) {
            const { ongoingCallStatus, ongoingCallWith } = getCallingStateOutsideOfRedux();
            if ((ongoingCallStatus === 'connecting' ||
                ongoingCallStatus === 'offering' ||
                ongoingCallStatus === 'ongoing') &&
                ongoingCallWith) {
                void handleCallTypeEndCall(ongoingCallWith, currentCallUUID);
            }
            return;
        }
        if (parsed.video !== undefined) {
            remoteVideoStreamIsMuted = !Boolean(parsed.video);
        }
    }
    catch (e) {
        window.log.warn('onDataChannelReceivedMessage Could not parse data in event', ev);
    }
    callVideoListeners();
}
function onDataChannelOnOpen() {
    window.log.info('onDataChannelOnOpen: sending video status');
    sendVideoStatusViaDataChannel();
}
function createOrGetPeerConnection(withPubkey) {
    if (peerConnection) {
        return peerConnection;
    }
    remoteStream = new MediaStream();
    const sampleOfICeServers = lodash_1.default.sampleSize(iceServersFullArray, 2);
    peerConnection = new RTCPeerConnection({ ...configuration, iceServers: sampleOfICeServers });
    dataChannel = peerConnection.createDataChannel('session-datachannel', {
        ordered: true,
        negotiated: true,
        id: 548,
    });
    dataChannel.onmessage = onDataChannelReceivedMessage;
    dataChannel.onopen = onDataChannelOnOpen;
    peerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
    peerConnection.ontrack = event => {
        event.track.onunmute = () => {
            remoteStream?.addTrack(event.track);
            callVideoListeners();
        };
        event.track.onmute = () => {
            remoteStream?.removeTrack(event.track);
            callVideoListeners();
        };
    };
    peerConnection.onconnectionstatechange = () => {
        handleConnectionStateChanged(withPubkey);
    };
    peerConnection.onicecandidate = event => {
        handleIceCandidates(event, withPubkey);
    };
    peerConnection.oniceconnectionstatechange = () => {
        window.log.info('oniceconnectionstatechange peerConnection.iceConnectionState: ', peerConnection?.iceConnectionState);
        if (peerConnection && peerConnection?.iceConnectionState === 'disconnected') {
            global.setTimeout(async () => {
                window.log.info('onconnectionstatechange disconnected: restartIce()');
                if (peerConnection?.iceConnectionState === 'disconnected' &&
                    withPubkey?.length &&
                    weAreCallerOnCurrentCall === true) {
                    peerConnection.restartIce();
                    await createOfferAndSendIt(withPubkey);
                }
            }, 2000);
        }
    };
    return peerConnection;
}
async function USER_acceptIncomingCallRequest(fromSender) {
    window.log.info('USER_acceptIncomingCallRequest');
    if (currentCallUUID) {
        window.log.warn('Looks like we are already in a call as in USER_acceptIncomingCallRequest is not undefined');
        return;
    }
    await updateConnectedDevices();
    const lastOfferMessage = findLastMessageTypeFromSender(fromSender, protobuf_1.SignalService.CallMessage.Type.OFFER);
    if (!lastOfferMessage) {
        window?.log?.info('incoming call request cannot be accepted as the corresponding message is not found');
        return;
    }
    if (!lastOfferMessage.uuid) {
        window?.log?.info('incoming call request cannot be accepted as uuid is invalid');
        return;
    }
    window.inboxStore?.dispatch((0, call_1.answerCall)({ pubkey: fromSender }));
    await (0, conversations_1.openConversationWithMessages)({ conversationKey: fromSender, messageId: null });
    if (peerConnection) {
        throw new Error('USER_acceptIncomingCallRequest: peerConnection is already set.');
    }
    currentCallUUID = lastOfferMessage.uuid;
    peerConnection = createOrGetPeerConnection(fromSender);
    await openMediaDevicesAndAddTracks();
    const { sdps } = lastOfferMessage;
    if (!sdps || sdps.length === 0) {
        window?.log?.info('incoming call request cannot be accepted as the corresponding sdps is empty');
        return;
    }
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: sdps[0], type: 'offer' }));
    }
    catch (e) {
        window.log?.error(`Error setting RTC Session Description ${e}`);
    }
    const lastCandidatesFromSender = findLastMessageTypeFromSender(fromSender, protobuf_1.SignalService.CallMessage.Type.ICE_CANDIDATES);
    if (lastCandidatesFromSender) {
        window.log.info('found sender ice candicate message already sent. Using it');
        for (let index = 0; index < lastCandidatesFromSender.sdps.length; index++) {
            const sdp = lastCandidatesFromSender.sdps[index];
            const sdpMLineIndex = lastCandidatesFromSender.sdpMLineIndexes[index];
            const sdpMid = lastCandidatesFromSender.sdpMids[index];
            const candicate = new RTCIceCandidate({ sdpMid, sdpMLineIndex, candidate: sdp });
            await peerConnection.addIceCandidate(candicate);
        }
    }
    const networkTimestamp = (0, SNodeAPI_1.getNowWithNetworkOffset)();
    const callerConvo = (0, conversations_2.getConversationController)().get(fromSender);
    callerConvo.set('active_at', networkTimestamp);
    await callerConvo?.addSingleIncomingMessage({
        source: __1.UserUtils.getOurPubKeyStrFromCache(),
        sent_at: networkTimestamp,
        received_at: networkTimestamp,
        expireTimer: 0,
        callNotificationType: 'answered-a-call',
        unread: 0,
    });
    await buildAnswerAndSendIt(fromSender);
    await callerConvo.setDidApproveMe(true);
    await (0, conversationInteractions_1.approveConvoAndSendResponse)(fromSender, true);
}
exports.USER_acceptIncomingCallRequest = USER_acceptIncomingCallRequest;
async function rejectCallAlreadyAnotherCall(fromSender, forcedUUID) {
    window.log.info(`rejectCallAlreadyAnotherCall ${(0, onionPath_1.ed25519Str)(fromSender)}: ${forcedUUID}`);
    rejectedCallUUIDS.add(forcedUUID);
    const rejectCallMessage = new CallMessage_1.CallMessage({
        type: protobuf_1.SignalService.CallMessage.Type.END_CALL,
        timestamp: Date.now(),
        uuid: forcedUUID,
    });
    await sendCallMessageAndSync(rejectCallMessage, fromSender);
    clearCallCacheFromPubkeyAndUUID(fromSender, forcedUUID);
}
exports.rejectCallAlreadyAnotherCall = rejectCallAlreadyAnotherCall;
async function USER_rejectIncomingCallRequest(fromSender) {
    window.inboxStore?.dispatch((0, call_1.endCall)());
    const lastOfferMessage = findLastMessageTypeFromSender(fromSender, protobuf_1.SignalService.CallMessage.Type.OFFER);
    const aboutCallUUID = lastOfferMessage?.uuid;
    window.log.info(`USER_rejectIncomingCallRequest ${(0, onionPath_1.ed25519Str)(fromSender)}: ${aboutCallUUID}`);
    if (aboutCallUUID) {
        rejectedCallUUIDS.add(aboutCallUUID);
        const endCallMessage = new CallMessage_1.CallMessage({
            type: protobuf_1.SignalService.CallMessage.Type.END_CALL,
            timestamp: Date.now(),
            uuid: aboutCallUUID,
        });
        await sendCallMessageAndSync(endCallMessage, fromSender);
        clearCallCacheFromPubkeyAndUUID(fromSender, aboutCallUUID);
    }
    const { ongoingCallStatus, ongoingCallWith } = getCallingStateOutsideOfRedux();
    if (ongoingCallWith && ongoingCallStatus && ongoingCallWith === fromSender) {
        closeVideoCall();
    }
    await addMissedCallMessage(fromSender, Date.now());
}
exports.USER_rejectIncomingCallRequest = USER_rejectIncomingCallRequest;
async function sendCallMessageAndSync(callmessage, user) {
    await Promise.all([
        (0, __2.getMessageQueue)().sendToPubKeyNonDurably(types_1.PubKey.cast(user), callmessage),
        (0, __2.getMessageQueue)().sendToPubKeyNonDurably(__1.UserUtils.getOurPubKeyFromCache(), callmessage),
    ]);
}
async function USER_hangup(fromSender) {
    window.log.info('USER_hangup');
    if (!currentCallUUID) {
        window.log.warn('should not be able to hangup without a currentCallUUID');
        return;
    }
    else {
        rejectedCallUUIDS.add(currentCallUUID);
        const endCallMessage = new CallMessage_1.CallMessage({
            type: protobuf_1.SignalService.CallMessage.Type.END_CALL,
            timestamp: Date.now(),
            uuid: currentCallUUID,
        });
        void (0, __2.getMessageQueue)().sendToPubKeyNonDurably(types_1.PubKey.cast(fromSender), endCallMessage);
    }
    window.inboxStore?.dispatch((0, call_1.endCall)());
    window.log.info('sending hangup with an END_CALL MESSAGE');
    sendHangupViaDataChannel();
    clearCallCacheFromPubkeyAndUUID(fromSender, currentCallUUID);
    closeVideoCall();
}
exports.USER_hangup = USER_hangup;
async function handleCallTypeEndCall(sender, aboutCallUUID) {
    window.log.info('handling callMessage END_CALL:', aboutCallUUID);
    if (aboutCallUUID) {
        rejectedCallUUIDS.add(aboutCallUUID);
        const { ongoingCallStatus, ongoingCallWith } = getCallingStateOutsideOfRedux();
        clearCallCacheFromPubkeyAndUUID(sender, aboutCallUUID);
        if (sender === __1.UserUtils.getOurPubKeyStrFromCache()) {
            const ownerOfCall = getOwnerOfCallUUID(aboutCallUUID);
            if ((ongoingCallStatus === 'incoming' || ongoingCallStatus === 'connecting') &&
                ongoingCallWith === ownerOfCall) {
                closeVideoCall();
                window.inboxStore?.dispatch((0, call_1.endCall)());
            }
            return;
        }
        if (aboutCallUUID === currentCallUUID) {
            closeVideoCall();
            window.inboxStore?.dispatch((0, call_1.endCall)());
        }
        else if (ongoingCallWith === sender &&
            (ongoingCallStatus === 'incoming' || ongoingCallStatus === 'connecting')) {
            window.inboxStore?.dispatch((0, call_1.endCall)());
        }
    }
}
exports.handleCallTypeEndCall = handleCallTypeEndCall;
async function buildAnswerAndSendIt(sender) {
    if (peerConnection) {
        if (!currentCallUUID) {
            window.log.warn('cannot send answer without a currentCallUUID');
            return;
        }
        await peerConnection.setLocalDescription();
        const answer = peerConnection.localDescription;
        if (!answer?.sdp || answer.sdp.length === 0) {
            window.log.warn('failed to create answer');
            return;
        }
        const answerSdp = answer.sdp;
        const callAnswerMessage = new CallMessage_1.CallMessage({
            timestamp: Date.now(),
            type: protobuf_1.SignalService.CallMessage.Type.ANSWER,
            sdps: [answerSdp],
            uuid: currentCallUUID,
        });
        window.log.info('sending ANSWER MESSAGE and sync');
        await sendCallMessageAndSync(callAnswerMessage, sender);
    }
}
function isCallRejected(uuid) {
    return rejectedCallUUIDS.has(uuid);
}
exports.isCallRejected = isCallRejected;
function getCachedMessageFromCallMessage(callMessage, envelopeTimestamp) {
    return {
        type: callMessage.type,
        sdps: callMessage.sdps,
        sdpMLineIndexes: callMessage.sdpMLineIndexes,
        sdpMids: callMessage.sdpMids,
        uuid: callMessage.uuid,
        timestamp: envelopeTimestamp,
    };
}
async function isUserApprovedOrWeSentAMessage(user) {
    const isApproved = (0, conversations_2.getConversationController)()
        .get(user)
        ?.isApproved();
    if (isApproved) {
        return true;
    }
    return data_1.Data.hasConversationOutgoingMessage(user);
}
async function handleCallTypeOffer(sender, callMessage, incomingOfferTimestamp) {
    try {
        const remoteCallUUID = callMessage.uuid;
        if (!remoteCallUUID || remoteCallUUID.length === 0) {
            throw new Error('incoming offer call has no valid uuid');
        }
        window.log.info('handling callMessage OFFER with uuid: ', remoteCallUUID);
        if (!(0, SessionSettings_1.getCallMediaPermissionsSettings)()) {
            const cachedMsg = getCachedMessageFromCallMessage(callMessage, incomingOfferTimestamp);
            pushCallMessageToCallCache(sender, remoteCallUUID, cachedMsg);
            await handleMissedCall(sender, incomingOfferTimestamp, 'permissions');
            return;
        }
        const shouldDisplayOffer = await isUserApprovedOrWeSentAMessage(sender);
        if (!shouldDisplayOffer) {
            const cachedMsg = getCachedMessageFromCallMessage(callMessage, incomingOfferTimestamp);
            pushCallMessageToCallCache(sender, remoteCallUUID, cachedMsg);
            await handleMissedCall(sender, incomingOfferTimestamp, 'not-approved');
            return;
        }
        if (incomingOfferTimestamp <= Date.now() - exports.callTimeoutMs) {
            await handleMissedCall(sender, incomingOfferTimestamp, 'too-old-timestamp');
            return;
        }
        if (currentCallUUID && currentCallUUID !== remoteCallUUID) {
            if (callCache.get(sender)?.has(currentCallUUID)) {
                await rejectCallAlreadyAnotherCall(sender, remoteCallUUID);
                return;
            }
            await handleMissedCall(sender, incomingOfferTimestamp, 'another-call-ongoing');
            await rejectCallAlreadyAnotherCall(sender, remoteCallUUID);
            return;
        }
        const readyForOffer = !makingOffer && (peerConnection?.signalingState === 'stable' || isSettingRemoteAnswerPending);
        const polite = lastOutgoingOfferTimestamp < incomingOfferTimestamp;
        const offerCollision = !readyForOffer;
        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) {
            window.log?.warn('Received offer when unready for offer; Ignoring offer.');
            return;
        }
        if (peerConnection && remoteCallUUID === currentCallUUID && currentCallUUID) {
            window.log.info('Got a new offer message from our ongoing call');
            const remoteOfferDesc = new RTCSessionDescription({
                type: 'offer',
                sdp: callMessage.sdps[0],
            });
            isSettingRemoteAnswerPending = false;
            await peerConnection.setRemoteDescription(remoteOfferDesc);
            isSettingRemoteAnswerPending = false;
            await buildAnswerAndSendIt(sender);
        }
        else {
            window.inboxStore?.dispatch((0, call_1.incomingCall)({ pubkey: sender }));
            const callerConvo = (0, conversations_2.getConversationController)().get(sender);
            const convNotif = callerConvo?.get('triggerNotificationsFor') || 'disabled';
            if (convNotif === 'disabled') {
                window?.log?.info('notifications disabled for convo', (0, onionPath_1.ed25519Str)(sender));
            }
            else if (callerConvo) {
                await callerConvo.notifyIncomingCall();
            }
        }
        const cachedMessage = getCachedMessageFromCallMessage(callMessage, incomingOfferTimestamp);
        pushCallMessageToCallCache(sender, remoteCallUUID, cachedMessage);
    }
    catch (err) {
        window.log?.error(`Error handling offer message ${err}`);
    }
}
exports.handleCallTypeOffer = handleCallTypeOffer;
async function handleMissedCall(sender, incomingOfferTimestamp, reason) {
    const incomingCallConversation = (0, conversations_2.getConversationController)().get(sender);
    const displayname = incomingCallConversation?.getNickname() ||
        incomingCallConversation?.getRealSessionUsername() ||
        'Unknown';
    switch (reason) {
        case 'permissions':
            __1.ToastUtils.pushedMissedCallCauseOfPermission(displayname);
            break;
        case 'another-call-ongoing':
            __1.ToastUtils.pushedMissedCall(displayname);
            break;
        case 'not-approved':
            __1.ToastUtils.pushedMissedCallNotApproved(displayname);
            break;
        case 'too-old-timestamp':
            break;
        default:
    }
    await addMissedCallMessage(sender, incomingOfferTimestamp);
    return;
}
exports.handleMissedCall = handleMissedCall;
async function addMissedCallMessage(callerPubkey, sentAt) {
    const incomingCallConversation = (0, conversations_2.getConversationController)().get(callerPubkey);
    if (incomingCallConversation.isActive()) {
        incomingCallConversation.set('active_at', (0, SNodeAPI_1.getNowWithNetworkOffset)());
    }
    await incomingCallConversation?.addSingleIncomingMessage({
        source: callerPubkey,
        sent_at: sentAt,
        received_at: (0, SNodeAPI_1.getNowWithNetworkOffset)(),
        expireTimer: 0,
        callNotificationType: 'missed-call',
        unread: 1,
    });
}
function getOwnerOfCallUUID(callUUID) {
    for (const deviceKey of callCache.keys()) {
        for (const callUUIDEntry of callCache.get(deviceKey)) {
            if (callUUIDEntry[0] === callUUID) {
                return deviceKey;
            }
        }
    }
    return null;
}
async function handleCallTypeAnswer(sender, callMessage, envelopeTimestamp) {
    if (!callMessage.sdps || callMessage.sdps.length === 0) {
        window.log.warn('cannot handle answered message without signal description proto sdps');
        return;
    }
    const callMessageUUID = callMessage.uuid;
    if (!callMessageUUID || callMessageUUID.length === 0) {
        window.log.warn('handleCallTypeAnswer has no valid uuid');
        return;
    }
    if (sender === __1.UserUtils.getOurPubKeyStrFromCache()) {
        const isDeviceWhichJustAcceptedCall = currentCallUUID === callMessageUUID;
        if (isDeviceWhichJustAcceptedCall) {
            window.log.info(`isDeviceWhichJustAcceptedCall: skipping message back ANSWER from ourself about call ${callMessageUUID}`);
            return;
        }
        window.log.info(`handling callMessage ANSWER from ourself about call ${callMessageUUID}`);
        const { ongoingCallStatus, ongoingCallWith } = getCallingStateOutsideOfRedux();
        const foundOwnerOfCallUUID = getOwnerOfCallUUID(callMessageUUID);
        if (callMessageUUID !== currentCallUUID) {
            if (foundOwnerOfCallUUID) {
                rejectedCallUUIDS.add(callMessageUUID);
                if (ongoingCallStatus && ongoingCallWith === foundOwnerOfCallUUID) {
                    closeVideoCall();
                }
                window.inboxStore?.dispatch((0, call_1.endCall)());
            }
        }
        return;
    }
    else {
        window.log.info(`handling callMessage ANSWER from ${callMessageUUID}`);
    }
    const cachedMessage = getCachedMessageFromCallMessage(callMessage, envelopeTimestamp);
    pushCallMessageToCallCache(sender, callMessageUUID, cachedMessage);
    if (!peerConnection) {
        window.log.info('handleCallTypeAnswer without peer connection. Dropping');
        return;
    }
    window.inboxStore?.dispatch((0, call_1.answerCall)({
        pubkey: sender,
    }));
    try {
        isSettingRemoteAnswerPending = true;
        const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: callMessage.sdps[0],
        });
        await peerConnection?.setRemoteDescription(remoteDesc);
    }
    catch (e) {
        window.log.warn('setRemoteDescriptio failed:', e);
    }
    finally {
        isSettingRemoteAnswerPending = false;
    }
}
exports.handleCallTypeAnswer = handleCallTypeAnswer;
async function handleCallTypeIceCandidates(sender, callMessage, envelopeTimestamp) {
    if (!callMessage.sdps || callMessage.sdps.length === 0) {
        window.log.warn('cannot handle iceCandicates message without candidates');
        return;
    }
    const remoteCallUUID = callMessage.uuid;
    if (!remoteCallUUID || remoteCallUUID.length === 0) {
        window.log.warn('handleCallTypeIceCandidates has no valid uuid');
        return;
    }
    window.log.info('handling callMessage ICE_CANDIDATES');
    const cachedMessage = getCachedMessageFromCallMessage(callMessage, envelopeTimestamp);
    pushCallMessageToCallCache(sender, remoteCallUUID, cachedMessage);
    if (currentCallUUID && callMessage.uuid === currentCallUUID) {
        await addIceCandidateToExistingPeerConnection(callMessage);
    }
}
exports.handleCallTypeIceCandidates = handleCallTypeIceCandidates;
async function addIceCandidateToExistingPeerConnection(callMessage) {
    if (peerConnection) {
        for (let index = 0; index < callMessage.sdps.length; index++) {
            const sdp = callMessage.sdps[index];
            const sdpMLineIndex = callMessage.sdpMLineIndexes[index];
            const sdpMid = callMessage.sdpMids[index];
            const candicate = new RTCIceCandidate({ sdpMid, sdpMLineIndex, candidate: sdp });
            try {
                await peerConnection.addIceCandidate(candicate);
            }
            catch (err) {
                if (!ignoreOffer) {
                    window.log?.warn('Error handling ICE candidates message', err);
                }
            }
        }
    }
    else {
        window.log.info('handleIceCandidatesMessage but we do not have a peerconnection set');
    }
}
async function handleOtherCallTypes(sender, callMessage, envelopeTimestamp) {
    const remoteCallUUID = callMessage.uuid;
    if (!remoteCallUUID || remoteCallUUID.length === 0) {
        window.log.warn('handleOtherCallTypes has no valid uuid');
        return;
    }
    const cachedMessage = getCachedMessageFromCallMessage(callMessage, envelopeTimestamp);
    pushCallMessageToCallCache(sender, remoteCallUUID, cachedMessage);
}
exports.handleOtherCallTypes = handleOtherCallTypes;
function clearCallCacheFromPubkeyAndUUID(sender, callUUID) {
    callCache.get(sender)?.delete(callUUID);
}
function createCallCacheForPubkeyAndUUID(sender, uuid) {
    if (!callCache.has(sender)) {
        callCache.set(sender, new Map());
    }
    if (!callCache.get(sender)?.has(uuid)) {
        callCache.get(sender)?.set(uuid, new Array());
    }
}
function pushCallMessageToCallCache(sender, uuid, callMessage) {
    createCallCacheForPubkeyAndUUID(sender, uuid);
    callCache
        .get(sender)
        ?.get(uuid)
        ?.push(callMessage);
}
function onTurnedOnCallMediaPermissions() {
    callCache.forEach((sender, key) => {
        sender.forEach(msgs => {
            for (const msg of msgs.reverse()) {
                if (msg.type === protobuf_1.SignalService.CallMessage.Type.OFFER &&
                    Date.now() - msg.timestamp < constants_1.DURATION.MINUTES * 1) {
                    window.inboxStore?.dispatch((0, call_1.incomingCall)({ pubkey: key }));
                    break;
                }
            }
        });
    });
}
exports.onTurnedOnCallMediaPermissions = onTurnedOnCallMediaPermissions;
function getCurrentCallDuration() {
    return currentCallStartTimestamp
        ? Math.floor((Date.now() - currentCallStartTimestamp) / 1000)
        : undefined;
}
exports.getCurrentCallDuration = getCurrentCallDuration;
