import React, { useCallback, useReducer } from 'react';
import Input from '../components/Input';
import SubmitButton from '../components/SubmitButton';
import { Feather, FontAwesome } from '@expo/vector-icons';

import { validateInput } from '../utils/actions/formActions';
import { reducer } from '../utils/reducers/formReducer';
import { signUp } from '../utils/actions/authActions';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCf9cdIb7nMkyxUY3Aa36tvkxp_E7WhSfw",
  authDomain: "whatsapp-d89da.firebaseapp.com",
  projectId: "whatsapp-d89da",
  storageBucket: "whatsapp-d89da.appspot.com",
  messagingSenderId: "173084586629",
  appId: "1:173084586629:web:bc57e99fffc4b3af506fec",
  measurementId: "G-EWD53TCBD5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log(app);

const initialState = {
    inputValues: {
        firstName: "",
        lastName: "",
        email: "",
        password: "",
    },
    inputValidities: {
        firstName: false,
        lastName: false,
        email: false,
        password: false,
    },
    formIsValid: false
}

const SignUpForm = props => {

    const [formState, dispatchFormState] = useReducer(reducer, initialState);

    const inputChangedHandler = useCallback((inputId, inputValue) => {
        const result = validateInput(inputId, inputValue);
        dispatchFormState({ inputId, validationResult: result, inputValue })
    }, [dispatchFormState]);

    const authHandler = () => {
        signUp(
            formState.inputValues.firstName,
            formState.inputValues.lastName,
            formState.inputValues.email,
            formState.inputValues.password,
        );
    }

    return (
            <>
                <Input
                    id="firstName"
                    label="First name"
                    icon="user-o"
                    iconPack={FontAwesome}
                    onInputChanged={inputChangedHandler}
                    autoCapitalize="none"
                    errorText={formState.inputValidities["firstName"]} />

                <Input
                    id="lastName"
                    label="Last name"
                    icon="user-o"
                    iconPack={FontAwesome}
                    onInputChanged={inputChangedHandler}
                    autoCapitalize="none"
                    errorText={formState.inputValidities["lastName"]} />

                <Input
                    id="email"
                    label="Email"
                    icon="mail"
                    iconPack={Feather}
                    onInputChanged={inputChangedHandler}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    errorText={formState.inputValidities["email"]} />

                <Input
                    id="password"
                    label="Password"
                    icon="lock"
                    autoCapitalize="none"
                    secureTextEntry
                    iconPack={Feather}
                    onInputChanged={inputChangedHandler}
                    errorText={formState.inputValidities["password"]} />
                
                <SubmitButton
                    title="Sign up"
                    onPress={authHandler}
                    style={{ marginTop: 20 }}
                    disabled={!formState.formIsValid}/>
            </>
    )
};

export default SignUpForm;