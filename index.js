import React, { Component } from 'react';
import {
    SafeAreaView, StyleSheet, Dimensions
} from 'react-native';
import Modal from 'react-native-modal';
import Hcaptcha from './Hcaptcha';
import PropTypes from 'prop-types';

const { width, height } = Dimensions.get('window');

class ConfirmHcaptcha extends Component {
    state = {
        show: false
    }
    show = () => {
        this.setState({ show: true });
    }
    hide = () => {
        this.setState({ show: false });
    }
    render() {
        let { show } = this.state;
        let { siteKey, baseUrl, languageCode, onMessage, cancelButtonText } = this.props;
        return (
            <Modal
                useNativeDriver
                hideModalContentWhileAnimating
                deviceHeight={height}
                deviceWidth={width}
                style={styles.modal}
                animationIn="fadeIn"
                animationOut='fadeOut'
                onBackdropPress={this.hide}
                onBackButtonPress={this.hide}
                isVisible={show}>
                <SafeAreaView style={styles.wrapper}>
                    <Hcaptcha
                        url={baseUrl}
                        siteKey={siteKey}
                        onMessage={onMessage}
                        languageCode={languageCode}
                        cancelButtonText={cancelButtonText}
                    />
                </SafeAreaView>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    text: { fontSize: 15, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginTop: 10 },
    modal: { margin: 0 },
    wrapper: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)', justifyContent: 'center', overflow: 'hidden' }
});
ConfirmHcaptcha.propTypes = {
    siteKey: PropTypes.string.isRequired,
    baseUrl: PropTypes.string,
    onMessage: PropTypes.func,
    languageCode: PropTypes.string,
    cancelButtonText: PropTypes.string
}
export default ConfirmHcaptcha;
