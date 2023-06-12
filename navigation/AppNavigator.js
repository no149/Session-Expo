import React from 'react'
import { NavigationContainer } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthScreen from '../screens/AuthScreen'
import { useSelector } from 'react-redux'
import StartUpScreen from '../screens/StartUpScreen'

const AppNavigator = (props) => {
  const isAuth = useSelector(
    (state) => state.auth.token !== null && state.auth.token !== '',
  )
  const didTryAutoLogin = useSelector((state) => state.auth.didTryAutoLogin)

  console.log('isAuth', isAuth)
  console.log('didTryAutoLogin', didTryAutoLogin)
  return (
    <NavigationContainer>
      {isAuth && <MainNavigator />}
      {!isAuth && didTryAutoLogin && <AuthScreen />}
      {!isAuth && !didTryAutoLogin && <StartUpScreen />}
    </NavigationContainer>
  )
}

export default AppNavigator
