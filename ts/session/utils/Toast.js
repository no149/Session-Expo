"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRateLimitHitReactions = exports.pushMustBeApproved = exports.pushNoMediaUntilApproved = exports.pushNoAudioOutputFound = exports.pushNoAudioInputFound = exports.pushNoCameraFound = exports.pushInvalidPubKey = exports.pushUserRemovedFromModerators = exports.pushUserAddedToModerators = exports.pushFailedToRemoveFromModerator = exports.pushFailedToAddAsModerator = exports.pushOnlyAdminCanRemove = exports.pushCannotRemoveCreatorFromGroup = exports.pushDeleted = exports.someDeletionsFailed = exports.pushYouLeftTheGroup = exports.pushUnblockToSendGroup = exports.pushUnblockToSend = exports.pushMessageRequestPending = exports.pushTooManyMembers = exports.pushOriginalNotFound = exports.pushAudioPermissionNeeded = exports.pushVideoCallPermissionNeeded = exports.pushedMissedCallNotApproved = exports.pushedMissedCallCauseOfPermission = exports.pushedMissedCall = exports.pushUnableToCall = exports.pushMessageDeleteForbidden = exports.pushUserUnbanFailure = exports.pushUserUnbanSuccess = exports.pushUserBanFailure = exports.pushUserBanSuccess = exports.pushAlreadyMemberOpenGroup = exports.pushRestartNeeded = exports.pushCopiedToClipBoard = exports.pushMessageBodyMissing = exports.pushMaximumAttachmentsError = exports.pushCannotMixError = exports.pushMultipleNonImageError = exports.pushFileSizeErrorAsByte = exports.pushFileSizeError = exports.pushLoadAttachmentFailure = exports.pushToastSuccess = exports.pushToastInfo = exports.pushToastWarning = exports.pushToastError = void 0;
const react_1 = __importDefault(require("react"));
const react_toastify_1 = require("react-toastify");
const SessionToast_1 = require("../../components/basic/SessionToast");
const SessionSettings_1 = require("../../components/settings/SessionSettings");
const section_1 = require("../../state/ducks/section");
function pushToastError(id, title, description) {
    react_toastify_1.toast.error(react_1.default.createElement(SessionToast_1.SessionToast, { title: title, description: description, type: SessionToast_1.SessionToastType.Error }), { toastId: id, updateId: id });
}
exports.pushToastError = pushToastError;
function pushToastWarning(id, title, description) {
    react_toastify_1.toast.warning(react_1.default.createElement(SessionToast_1.SessionToast, { title: title, description: description, type: SessionToast_1.SessionToastType.Warning }), { toastId: id, updateId: id });
}
exports.pushToastWarning = pushToastWarning;
function pushToastInfo(id, title, description, onToastClick, delay) {
    react_toastify_1.toast.info(react_1.default.createElement(SessionToast_1.SessionToast, { title: title, description: description, type: SessionToast_1.SessionToastType.Info, onToastClick: onToastClick }), { toastId: id, updateId: id, delay });
}
exports.pushToastInfo = pushToastInfo;
function pushToastSuccess(id, title, description, icon) {
    react_toastify_1.toast.success(react_1.default.createElement(SessionToast_1.SessionToast, { title: title, description: description, type: SessionToast_1.SessionToastType.Success, icon: icon }), { toastId: id, updateId: id });
}
exports.pushToastSuccess = pushToastSuccess;
function pushLoadAttachmentFailure(message) {
    if (message) {
        pushToastError('unableToLoadAttachment', `${window.i18n('unableToLoadAttachment')} ${message}`);
    }
    else {
        pushToastError('unableToLoadAttachment', window.i18n('unableToLoadAttachment'));
    }
}
exports.pushLoadAttachmentFailure = pushLoadAttachmentFailure;
function pushFileSizeError(limit, units) {
    pushToastError('fileSizeWarning', window.i18n('fileSizeWarning'), `Max size: ${limit} ${units}`);
}
exports.pushFileSizeError = pushFileSizeError;
function pushFileSizeErrorAsByte(bytesCount) {
    const units = ['kB', 'MB', 'GB'];
    let u = -1;
    let limit = bytesCount;
    do {
        limit /= 1000;
        u += 1;
    } while (limit >= 1000 && u < units.length - 1);
    pushFileSizeError(limit, units[u]);
}
exports.pushFileSizeErrorAsByte = pushFileSizeErrorAsByte;
function pushMultipleNonImageError() {
    pushToastError('cannotMixImageAndNonImageAttachments', window.i18n('cannotMixImageAndNonImageAttachments'));
}
exports.pushMultipleNonImageError = pushMultipleNonImageError;
function pushCannotMixError() {
    pushToastError('oneNonImageAtATimeToast', window.i18n('oneNonImageAtATimeToast'));
}
exports.pushCannotMixError = pushCannotMixError;
function pushMaximumAttachmentsError() {
    pushToastError('maximumAttachments', window.i18n('maximumAttachments'));
}
exports.pushMaximumAttachmentsError = pushMaximumAttachmentsError;
function pushMessageBodyMissing() {
    pushToastError('messageBodyMissing', window.i18n('messageBodyMissing'));
}
exports.pushMessageBodyMissing = pushMessageBodyMissing;
function pushCopiedToClipBoard() {
    pushToastInfo('copiedToClipboard', window.i18n('copiedToClipboard'));
}
exports.pushCopiedToClipBoard = pushCopiedToClipBoard;
function pushRestartNeeded() {
    pushToastInfo('restartNeeded', window.i18n('spellCheckDirty'));
}
exports.pushRestartNeeded = pushRestartNeeded;
function pushAlreadyMemberOpenGroup() {
    pushToastInfo('publicChatExists', window.i18n('publicChatExists'));
}
exports.pushAlreadyMemberOpenGroup = pushAlreadyMemberOpenGroup;
function pushUserBanSuccess() {
    pushToastSuccess('userBanned', window.i18n('userBanned'));
}
exports.pushUserBanSuccess = pushUserBanSuccess;
function pushUserBanFailure() {
    pushToastError('userBanFailed', window.i18n('userBanFailed'));
}
exports.pushUserBanFailure = pushUserBanFailure;
function pushUserUnbanSuccess() {
    pushToastSuccess('userUnbanned', window.i18n('userUnbanned'));
}
exports.pushUserUnbanSuccess = pushUserUnbanSuccess;
function pushUserUnbanFailure() {
    pushToastError('userUnbanFailed', window.i18n('userUnbanFailed'));
}
exports.pushUserUnbanFailure = pushUserUnbanFailure;
function pushMessageDeleteForbidden() {
    pushToastError('messageDeletionForbidden', window.i18n('messageDeletionForbidden'));
}
exports.pushMessageDeleteForbidden = pushMessageDeleteForbidden;
function pushUnableToCall() {
    pushToastError('unableToCall', window.i18n('unableToCallTitle'), window.i18n('unableToCall'));
}
exports.pushUnableToCall = pushUnableToCall;
function pushedMissedCall(conversationName) {
    pushToastInfo('missedCall', window.i18n('callMissedTitle'), window.i18n('callMissed', [conversationName]));
}
exports.pushedMissedCall = pushedMissedCall;
const openPermissionsSettings = () => {
    window.inboxStore?.dispatch((0, section_1.showLeftPaneSection)(section_1.SectionType.Settings));
    window.inboxStore?.dispatch((0, section_1.showSettingsSection)(SessionSettings_1.SessionSettingCategory.Permissions));
};
function pushedMissedCallCauseOfPermission(conversationName) {
    const id = 'missedCallPermission';
    react_toastify_1.toast.info(react_1.default.createElement(SessionToast_1.SessionToast, { title: window.i18n('callMissedTitle'), description: window.i18n('callMissedCausePermission', [conversationName]), type: SessionToast_1.SessionToastType.Info, onToastClick: openPermissionsSettings }), { toastId: id, updateId: id, autoClose: 10000 });
}
exports.pushedMissedCallCauseOfPermission = pushedMissedCallCauseOfPermission;
function pushedMissedCallNotApproved(displayName) {
    pushToastInfo('missedCall', window.i18n('callMissedTitle'), window.i18n('callMissedNotApproved', [displayName]));
}
exports.pushedMissedCallNotApproved = pushedMissedCallNotApproved;
function pushVideoCallPermissionNeeded() {
    pushToastInfo('videoCallPermissionNeeded', window.i18n('cameraPermissionNeededTitle'), window.i18n('cameraPermissionNeeded'), openPermissionsSettings);
}
exports.pushVideoCallPermissionNeeded = pushVideoCallPermissionNeeded;
function pushAudioPermissionNeeded() {
    pushToastInfo('audioPermissionNeeded', window.i18n('audioPermissionNeededTitle'), window.i18n('audioPermissionNeeded'), openPermissionsSettings);
}
exports.pushAudioPermissionNeeded = pushAudioPermissionNeeded;
function pushOriginalNotFound() {
    pushToastError('originalMessageNotFound', window.i18n('originalMessageNotFound'));
}
exports.pushOriginalNotFound = pushOriginalNotFound;
function pushTooManyMembers() {
    pushToastError('tooManyMembers', window.i18n('closedGroupMaxSize'));
}
exports.pushTooManyMembers = pushTooManyMembers;
function pushMessageRequestPending() {
    pushToastInfo('messageRequestPending', window.i18n('messageRequestPending'));
}
exports.pushMessageRequestPending = pushMessageRequestPending;
function pushUnblockToSend() {
    pushToastInfo('unblockToSend', window.i18n('unblockToSend'));
}
exports.pushUnblockToSend = pushUnblockToSend;
function pushUnblockToSendGroup() {
    pushToastInfo('unblockGroupToSend', window.i18n('unblockGroupToSend'));
}
exports.pushUnblockToSendGroup = pushUnblockToSendGroup;
function pushYouLeftTheGroup() {
    pushToastError('youLeftTheGroup', window.i18n('youLeftTheGroup'));
}
exports.pushYouLeftTheGroup = pushYouLeftTheGroup;
function someDeletionsFailed() {
    pushToastWarning('deletionError', 'Deletion error');
}
exports.someDeletionsFailed = someDeletionsFailed;
function pushDeleted(messageCount) {
    pushToastSuccess('deleted', window.i18n('deleted', [messageCount.toString()]), undefined, 'check');
}
exports.pushDeleted = pushDeleted;
function pushCannotRemoveCreatorFromGroup() {
    pushToastWarning('cannotRemoveCreatorFromGroup', window.i18n('cannotRemoveCreatorFromGroup'), window.i18n('cannotRemoveCreatorFromGroupDesc'));
}
exports.pushCannotRemoveCreatorFromGroup = pushCannotRemoveCreatorFromGroup;
function pushOnlyAdminCanRemove() {
    pushToastInfo('onlyAdminCanRemoveMembers', window.i18n('onlyAdminCanRemoveMembers'), window.i18n('onlyAdminCanRemoveMembersDesc'));
}
exports.pushOnlyAdminCanRemove = pushOnlyAdminCanRemove;
function pushFailedToAddAsModerator() {
    pushToastWarning('failedToAddAsModerator', window.i18n('failedToAddAsModerator'));
}
exports.pushFailedToAddAsModerator = pushFailedToAddAsModerator;
function pushFailedToRemoveFromModerator() {
    pushToastWarning('failedToRemoveFromModerator', window.i18n('failedToRemoveFromModerator'));
}
exports.pushFailedToRemoveFromModerator = pushFailedToRemoveFromModerator;
function pushUserAddedToModerators() {
    pushToastSuccess('userAddedToModerators', window.i18n('userAddedToModerators'));
}
exports.pushUserAddedToModerators = pushUserAddedToModerators;
function pushUserRemovedFromModerators() {
    pushToastSuccess('userRemovedFromModerators', window.i18n('userRemovedFromModerators'));
}
exports.pushUserRemovedFromModerators = pushUserRemovedFromModerators;
function pushInvalidPubKey() {
    pushToastSuccess('invalidPubKey', window.i18n('invalidPubkeyFormat'));
}
exports.pushInvalidPubKey = pushInvalidPubKey;
function pushNoCameraFound() {
    pushToastWarning('noCameraFound', window.i18n('noCameraFound'));
}
exports.pushNoCameraFound = pushNoCameraFound;
function pushNoAudioInputFound() {
    pushToastWarning('noAudioInputFound', window.i18n('noAudioInputFound'));
}
exports.pushNoAudioInputFound = pushNoAudioInputFound;
function pushNoAudioOutputFound() {
    pushToastWarning('noAudioInputFound', window.i18n('noAudioOutputFound'));
}
exports.pushNoAudioOutputFound = pushNoAudioOutputFound;
function pushNoMediaUntilApproved() {
    pushToastError('noMediaUntilApproved', window.i18n('noMediaUntilApproved'));
}
exports.pushNoMediaUntilApproved = pushNoMediaUntilApproved;
function pushMustBeApproved() {
    pushToastError('mustBeApproved', window.i18n('mustBeApproved'));
}
exports.pushMustBeApproved = pushMustBeApproved;
function pushRateLimitHitReactions() {
    pushToastInfo('reactRateLimit', '', window?.i18n?.('rateLimitReactMessage'));
}
exports.pushRateLimitHitReactions = pushRateLimitHitReactions;
