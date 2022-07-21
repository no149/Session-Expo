import React from 'react';
import Input from '../components/Input';
import SubmitButton from '../components/SubmitButton';
import { Feather } from '@expo/vector-icons';

const SignInForm = props => {

    return (
            <>
                <Input
                    label="Email"
                    icon="mail"
                    iconPack={Feather}
                    autoCapitalize="none"
                    keyboardType="email-address" />

                <Input
                    label="Password"
                    icon="lock"
                    iconPack={Feather}
                    autoCapitalize="none"
                    secureTextEntry />
                
                <SubmitButton
                    title="Sign in"
                    onPress={() => console.log("Button pressed")}
                    style={{ marginTop: 20 }}/>
            </>
    )
};

export default SignInForm;