import { combineReducers } from '@reduxjs/toolkit'

import { reducer as search, SearchStateType } from './ducks/search'
import {
  ConversationsStateType,
  reducer as conversations,
} from './ducks/conversations'
import { reducer as user, UserStateType } from './ducks/user'
//TODO import { reducer as theme } from './ducks/theme';
//TODO import { reducer as primaryColor } from './ducks/primaryColor';
//TODO import { reducer as section, SectionStateType } from './ducks/section';
//TODO import { defaultRoomReducer as defaultRooms, DefaultRoomsState } from './ducks/defaultRooms';
//TODO import { callReducer as call, CallStateType } from './ducks/call';

//TODO import { defaultOnionReducer as onionPaths, OnionState } from './ducks/onion';
//TODO import { modalReducer as modals, ModalState } from './ducks/modalDialog';
//TODO import { userConfigReducer as userConfig, UserConfigState } from './ducks/userConfig';
//TODO import { timerOptionReducer as timerOptions, TimerOptionsState } from './ducks/timerOptions';
import {
  reducer as stagedAttachments,
  StagedAttachmentsStateType,
} from './ducks/stagedAttachments'
import {
  PrimaryColorStateType,
  ThemeStateType,
} from '../themes/constants/colors'

export type StateType = {
  search: SearchStateType
  user: UserStateType
  conversations: ConversationsStateType
  theme: ThemeStateType
  primaryColor: PrimaryColorStateType
  section: SectionStateType
  defaultRooms: DefaultRoomsState
  onionPaths: OnionState
  modals: ModalState
  userConfig: UserConfigState
  timerOptions: TimerOptionsState
  stagedAttachments: StagedAttachmentsStateType
  call: CallStateType
}

export const reducers = {
  search,
  conversations,
  user,
  theme,
  primaryColor,
  section,
  defaultRooms,
  onionPaths,
  modals,
  userConfig,
  timerOptions,
  stagedAttachments,
  call,
}

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
// @ts-ignore
export const rootReducer = combineReducers(reducers)
