import React from 'react'
import { toast } from 'toastify-react-native'
//TODO
// import {
//   SessionToast,
//   SessionToastType,
// } from '../../components/basic/SessionToast'
//TODO import { SessionIconType } from '../../components/icon'
//TODO import { SessionSettingCategory } from '../../components/settings/SessionSettings'
import {
  SectionType,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section'

// if you push a toast manually with toast...() be sure to set the type attribute of the SessionToast component
export function pushToastError(
  id: string,
  title: string,
  description?: string,
) {
  //TODO
  // toast.error(
  //   <SessionToast
  //     title={title}
  //     description={description}
  //     type={SessionToastType.Error}
  //   />,
  //   { toastId: id, updateId: id },
  // )
}

export function pushToastWarning(
  id: string,
  title: string,
  description?: string,
) {
  //TODO
  // toast.warning(
  //   <SessionToast
  //     title={title}
  //     description={description}
  //     type={SessionToastType.Warning}
  //   />,
  //   { toastId: id, updateId: id },
  // )
}

export function pushToastInfo(
  id: string,
  title: string,
  description?: string,
  onToastClick?: () => void,
  delay?: number,
) {
  //TODO
  // toast.info(
  //   <SessionToast
  //     title={title}
  //     description={description}
  //     type={SessionToastType.Info}
  //     onToastClick={onToastClick}
  //   />,
  //   { toastId: id, updateId: id, delay },
  // )
}

export function pushToastSuccess(
  id: string,
  title: string,
  description?: string,
  //TODO icon?: SessionIconType,
) {
  //TODO
  // toast.success(
  //   <SessionToast
  //     title={title}
  //     description={description}
  //     type={SessionToastType.Success}
  //     icon={icon}
  //   />,
  //   { toastId: id, updateId: id },
  // )
}

export function pushLoadAttachmentFailure(message?: string) {
  if (message) {
    //TODO
    // pushToastError(
    //   'unableToLoadAttachment',
    //   `${window.i18n('unableToLoadAttachment')} ${message}`,
    // )
  } else {
    //TODO pushToastError(
    //   'unableToLoadAttachment',
    //   window.i18n('unableToLoadAttachment'),
    // )
  }
}

export function pushFileSizeError(limit: number, units: string) {
  //TODO
  // pushToastError(
  //   'fileSizeWarning',
  //   window.i18n('fileSizeWarning'),
  //   `Max size: ${limit} ${units}`,
  // )
}

export function pushFileSizeErrorAsByte(bytesCount: number) {
  const units = ['kB', 'MB', 'GB']
  let u = -1
  let limit = bytesCount
  do {
    limit /= 1000
    u += 1
  } while (limit >= 1000 && u < units.length - 1)
  pushFileSizeError(limit, units[u])
}

export function pushMultipleNonImageError() {
  //TODO
  // pushToastError(
  //   'cannotMixImageAndNonImageAttachments',
  //   window.i18n('cannotMixImageAndNonImageAttachments'),
  // )
}

export function pushCannotMixError() {
  //TODO
  // pushToastError(
  //   'oneNonImageAtATimeToast',
  //   window.i18n('oneNonImageAtATimeToast'),
  // )
}

export function pushMaximumAttachmentsError() {
  //TODO pushToastError('maximumAttachments', window.i18n('maximumAttachments'))
}

export function pushMessageBodyMissing() {
  //TODO pushToastError('messageBodyMissing', window.i18n('messageBodyMissing'))
}

export function pushCopiedToClipBoard() {
  //TODO pushToastInfo('copiedToClipboard', window.i18n('copiedToClipboard'))
}

export function pushRestartNeeded() {
  //TODO pushToastInfo('restartNeeded', window.i18n('spellCheckDirty'))
}

export function pushAlreadyMemberOpenGroup() {
  //TODO pushToastInfo('publicChatExists', window.i18n('publicChatExists'))
}

export function pushUserBanSuccess() {
  //TODO pushToastSuccess('userBanned', window.i18n('userBanned'))
}

export function pushUserBanFailure() {
  //TODO pushToastError('userBanFailed', window.i18n('userBanFailed'))
}

export function pushUserUnbanSuccess() {
  //TODO pushToastSuccess('userUnbanned', window.i18n('userUnbanned'))
}

export function pushUserUnbanFailure() {
  //TODO pushToastError('userUnbanFailed', window.i18n('userUnbanFailed'))
}

export function pushMessageDeleteForbidden() {
  //TODO
  // pushToastError(
  //   'messageDeletionForbidden',
  //   window.i18n('messageDeletionForbidden'),
  // )
}

export function pushUnableToCall() {
  //TODO
  // pushToastError(
  //   'unableToCall',
  //   window.i18n('unableToCallTitle'),
  //   window.i18n('unableToCall'),
  // )
}

export function pushedMissedCall(conversationName: string) {
  //TODO
  // pushToastInfo(
  //   'missedCall',
  //   window.i18n('callMissedTitle'),
  //   window.i18n('callMissed', [conversationName]),
  // )
}

const openPermissionsSettings = () => {
  //TODO window.inboxStore?.dispatch(showLeftPaneSection(SectionType.Settings))
  // window.inboxStore?.dispatch(
  //   showSettingsSection(SessionSettingCategory.Permissions),
  // )
}

export function pushedMissedCallCauseOfPermission(conversationName: string) {
  const id = 'missedCallPermission'
  //TODO toast.info(
  //   <SessionToast
  //     title={window.i18n('callMissedTitle')}
  //     description={window.i18n('callMissedCausePermission', [conversationName])}
  //     type={SessionToastType.Info}
  //     onToastClick={openPermissionsSettings}
  //   />,
  //   { toastId: id, updateId: id, autoClose: 10000 },
  // )
}

export function pushedMissedCallNotApproved(displayName: string) {
  //TODO
  // pushToastInfo(
  //   'missedCall',
  //   window.i18n('callMissedTitle'),
  //   window.i18n('callMissedNotApproved', [displayName]),
  // )
}

export function pushVideoCallPermissionNeeded() {
  //TODO
  // pushToastInfo(
  //   'videoCallPermissionNeeded',
  //   window.i18n('cameraPermissionNeededTitle'),
  //   window.i18n('cameraPermissionNeeded'),
  //   openPermissionsSettings,
  // )
}

export function pushAudioPermissionNeeded() {
  //TODO
  // pushToastInfo(
  //   'audioPermissionNeeded',
  //   window.i18n('audioPermissionNeededTitle'),
  //   window.i18n('audioPermissionNeeded'),
  //   openPermissionsSettings,
  // )
}

export function pushOriginalNotFound() {
  //TODO
  // pushToastError(
  //   'originalMessageNotFound',
  //   window.i18n('originalMessageNotFound'),
  // )
}

export function pushTooManyMembers() {
  //TODO pushToastError('tooManyMembers', window.i18n('closedGroupMaxSize'))
}

export function pushMessageRequestPending() {
  //TODO pushToastInfo('messageRequestPending', window.i18n('messageRequestPending'))
}

export function pushUnblockToSend() {
  //TODO pushToastInfo('unblockToSend', window.i18n('unblockToSend'))
}

export function pushUnblockToSendGroup() {
  //TODO pushToastInfo('unblockGroupToSend', window.i18n('unblockGroupToSend'))
}

export function pushYouLeftTheGroup() {
  //TODO pushToastError('youLeftTheGroup', window.i18n('youLeftTheGroup'))
}

export function someDeletionsFailed() {
  pushToastWarning('deletionError', 'Deletion error')
}

export function pushDeleted(messageCount: number) {
  //TODO
  // pushToastSuccess(
  //   'deleted',
  //   window.i18n('deleted', [messageCount.toString()]),
  //   undefined,
  //   'check',
  // )
}

export function pushCannotRemoveCreatorFromGroup() {
  //TODO
  // pushToastWarning(
  //   'cannotRemoveCreatorFromGroup',
  //   window.i18n('cannotRemoveCreatorFromGroup'),
  //   window.i18n('cannotRemoveCreatorFromGroupDesc'),
  // )
}

export function pushOnlyAdminCanRemove() {
  //TODO
  // pushToastInfo(
  //   'onlyAdminCanRemoveMembers',
  //   window.i18n('onlyAdminCanRemoveMembers'),
  //   window.i18n('onlyAdminCanRemoveMembersDesc'),
  // )
}

export function pushFailedToAddAsModerator() {
  //TODO
  // pushToastWarning(
  //   'failedToAddAsModerator',
  //   window.i18n('failedToAddAsModerator'),
  // )
}

export function pushFailedToRemoveFromModerator() {
  //TODO
  // pushToastWarning(
  //   'failedToRemoveFromModerator',
  //   window.i18n('failedToRemoveFromModerator'),
  // )
}

export function pushUserAddedToModerators() {
  //TODO
  // pushToastSuccess(
  //   'userAddedToModerators',
  //   window.i18n('userAddedToModerators'),
  // )
}

export function pushUserRemovedFromModerators() {
  //TODO
  // pushToastSuccess(
  //   'userRemovedFromModerators',
  //   window.i18n('userRemovedFromModerators'),
  // )
}

export function pushInvalidPubKey() {
  //TODO  pushToastSuccess('invalidPubKey', window.i18n('invalidPubkeyFormat'))
}

export function pushNoCameraFound() {
  //TODO pushToastWarning('noCameraFound', window.i18n('noCameraFound'))
}

export function pushNoAudioInputFound() {
  //TODO pushToastWarning('noAudioInputFound', window.i18n('noAudioInputFound'))
}

export function pushNoAudioOutputFound() {
  //TODO pushToastWarning('noAudioInputFound', window.i18n('noAudioOutputFound'))
}

export function pushNoMediaUntilApproved() {
  //TODO pushToastError('noMediaUntilApproved', window.i18n('noMediaUntilApproved'))
}

export function pushMustBeApproved() {
  //TODO pushToastError('mustBeApproved', window.i18n('mustBeApproved'))
}

export function pushRateLimitHitReactions() {
  //TODO pushToastInfo('reactRateLimit', '', window?.i18n?.('rateLimitReactMessage')) // because otherwise test fails
}
