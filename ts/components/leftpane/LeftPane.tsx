import React from 'react'

import { useSelector } from 'react-redux'
import styled from 'styled-components'
import { SectionType } from '../../state/ducks/section'
import { SessionTheme } from '../../themes/SessionTheme'
//import { getLeftPaneLists } from '../../state/selectors/conversations'
import { getSearchResults, isSearching } from '../../state/selectors/search'
import { View, Text } from 'react-native'
import {
  getFocusedSection,
  getOverlayMode,
} from '../../state/selectors/section'
import { getHideMessageRequestBanner } from '../../state/selectors/userConfig'
//TODO import { CallInFullScreenContainer } from '../calling/CallInFullScreenContainer'
//TODO import { DraggableCallContainer } from '../calling/DraggableCallContainer'
//TODO import { IncomingCallDialog } from '../calling/IncomingCallDialog'
//TODO import { ModalContainer } from '../dialog/ModalContainer'
//TODO import { SessionToastContainer } from '../SessionToastContainer'
//TODO import { ActionsPanel } from './ActionsPanel'
//import { LeftPaneMessageSection } from './LeftPaneMessageSection'
//TODO import { LeftPaneSettingSection } from './LeftPaneSettingSection'

export const leftPaneListWidth = 300
const StyledLeftPane = styled.div`
  width: ${leftPaneListWidth}px;
`

//TODO
const InnerLeftPaneMessageSection = () => {
  const showSearch = useSelector(isSearching)

  const searchResults = showSearch ? useSelector(getSearchResults) : undefined

  //TODO const lists = showSearch ? undefined : useSelector(getLeftPaneLists)
  const messageRequestsEnabled = useSelector(getHideMessageRequestBanner)
  const overlayMode = useSelector(getOverlayMode)

  return (
    // tslint:disable-next-line: use-simple-attributes
    <Text>InnerLeftPaneMessageSection placeholder</Text>
    //TODO
    // <LeftPaneMessageSection
    //   conversations={lists?.conversations || []}
    //   contacts={lists?.contacts || []}
    //   searchResults={searchResults}
    //   messageRequestsEnabled={messageRequestsEnabled}
    //   overlayMode={overlayMode}
    // />
  )
}

const LeftPaneSection = () => {
  const focusedSection = useSelector(getFocusedSection)

  if (focusedSection === SectionType.Message) {
    return <InnerLeftPaneMessageSection />
  }

  if (focusedSection === SectionType.Settings) {
    //TODO return <LeftPaneSettingSection />
    return <Text>LeftPaneSettingSection placeholder</Text>
  }
  return null
}

//TODO
// const CallContainer = () => {
//   return (
//     <>
//       <DraggableCallContainer />
//       <IncomingCallDialog />
//       <CallInFullScreenContainer />
//     </>
//   )
// }

export const LeftPane = () => {
  return (
    <SessionTheme>
      <View>
        {/* <ModalContainer />
        <CallContainer />
        <SessionToastContainer />
        <ActionsPanel />

        <StyledLeftPane className="module-left-pane">
          <LeftPaneSection />
        </StyledLeftPane> */}
        <Text>Left pane placeholder</Text>
      </View>
    </SessionTheme>
  )
}
