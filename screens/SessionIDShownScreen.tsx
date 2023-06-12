import { View } from 'react-native'

export default (props: { continueSignUp: () => void }) => {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <GoBackMainMenuButton />

        <div className="session-registration__unique-session-id">
          {window.i18n('yourUniqueSessionID')}
        </div>
      </View>
      <SessionIdEditable
        editable={false}
        placeholder={undefined}
        dataTestId="session-id-signup"
      />
      <div className="session-description-long">
        {window.i18n('allUsersAreRandomly...')}
      </div>
      <ContinueSignUpButton continueSignUp={props.continueSignUp} />
      <TermsAndConditions />
    </View>
  )
}
