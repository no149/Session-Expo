import { createSlice } from '@reduxjs/toolkit'

class stateType {
  token: String = null
  userData: { name: String }
  didTryAutoLogin?: boolean = false
}

const authSlice = createSlice({
  name: 'auth',
  initialState: new stateType(),
  reducers: {
    authenticate: (state: stateType, action: { payload: stateType }) => {
      const { payload } = action
      return {
        ...state,
        token: payload.token,
        userData: payload.userData,
        didTryAutoLogin: true,
      }
    },
    setDidTryAutoLogin: (state: stateType, action) => {
      return { ...state, didTryAutoLogin: true }
    },
    logout: (state, action) => {
      state.token = null
      state.userData = null
      state.didTryAutoLogin = false
    },
    updateLoggedInUserData: (state, action) => {
      state.userData = { ...state.userData, ...action.payload.newData }
    },
  },
})
export const setDidTryAutoLogin = authSlice.actions.setDidTryAutoLogin
export const authenticate = authSlice.actions.authenticate
export const updateLoggedInUserData = authSlice.actions.updateLoggedInUserData
export const logout = authSlice.actions.logout
export default authSlice.reducer
