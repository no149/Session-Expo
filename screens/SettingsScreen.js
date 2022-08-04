import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PageTitle from '../components/PageTitle';

const SettingsScreen = props => {
    
    return <View style={styles.container}>
        <PageTitle text="Settings" />
    </View>
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
})

export default SettingsScreen;