import React, { useEffect } from 'react'
import { ActivityIndicator, View, Text } from 'react-native'
import colors from '../constants/colors'
import commonStyles from '../constants/commonStyles'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useDispatch } from 'react-redux'
import { authenticate, setDidTryAutoLogin } from '../store/authSlice'
import { getUserData } from '../utils/actions/userActions'

const StartUpScreen = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    const tryLogin = async () => {
      const storedAuthInfo = await AsyncStorage.getItem('userData')
      console.log('storedAuthInfo', storedAuthInfo)
      if (!storedAuthInfo) {
        dispatch(setDidTryAutoLogin(null))
        return
      }

      const parsedData = JSON.parse(storedAuthInfo)
      const { userId } = parsedData

      if (!userId) {
        dispatch(setDidTryAutoLogin(null))
        return
      }

      const userData = await getUserData(userId)
      dispatch(authenticate({ token: userId, userData }))
    }

    tryLogin()
  }, [dispatch])

  return (
    <View style={commonStyles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}

export default StartUpScreen
