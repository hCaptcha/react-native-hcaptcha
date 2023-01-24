import React, { PureComponent } from 'react';
import { SafeAreaView, StyleSheet, Dimensions, Platform } from 'react-native';
import Modal from 'react-native-modal';
import Hcaptcha from './Hcaptcha';
import PropTypes from 'prop-types';

const { width, height } = Dimensions.get('window');

class ConfirmHcaptcha extends PureComponent {
  state = {
    show: false,
  };
  show = () => {
    this.setState({ show: true });
  };
  hide = (source) => {
    const { onMessage } = this.props;
    this.setState({ show: false });
    if (source) { // if source === undefined => called by the user
      onMessage({ nativeEvent: { data: 'cancel' } });
    }
  };
  render() {
    let { show } = this.state;
    let {
      size,
      siteKey,
      passiveSiteKey,
      baseUrl,
      languageCode,
      onMessage,
      showLoading,
      backgroundColor,
      loadingIndicatorColor,
      theme,
      rqdata,
      sentry,
      jsSdkPath,
      endpoint,
      reportapi,
      assethost,
      imghost,
      host,
    } = this.props;

    return (
      <Modal
        useNativeDriver
        hideModalContentWhileAnimating
        deviceHeight={height}
        deviceWidth={width}
        style={[styles.modal, {display: passiveSiteKey ? 'none' : undefined}]}
        animationIn="fadeIn"
        animationOut="fadeOut"
        onBackdropPress={() => this.hide('backdrop')}
        onBackButtonPress={() => this.hide('back_button')}
        isVisible={show}
        hasBackdrop={!passiveSiteKey}
      >
        <SafeAreaView style={[styles.wrapper, { backgroundColor }]}>
          <Hcaptcha
            url={baseUrl}
            size={size}
            siteKey={siteKey}
            onMessage={onMessage}
            languageCode={languageCode}
            showLoading={showLoading}
            loadingIndicatorColor={loadingIndicatorColor}
            backgroundColor={backgroundColor}
            theme={theme}
            rqdata={rqdata}
            sentry={sentry}
            jsSdkPath={jsSdkPath}
            endpoint={endpoint}
            reportapi={reportapi}
            assethost={assethost}
            imghost={imghost}
            host={host}
          />
        </SafeAreaView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
  },
  modal: { margin: 0, display: 'none' },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

ConfirmHcaptcha.propTypes = {
  size: PropTypes.string,
  siteKey: PropTypes.string.isRequired,
  passiveSiteKey: PropTypes.bool,
  baseUrl: PropTypes.string,
  onMessage: PropTypes.func,
  languageCode: PropTypes.string,
  backgroundColor: PropTypes.string,
  showLoading: PropTypes.bool,
  loadingIndicatorColor: PropTypes.string,
  theme: PropTypes.string,
  rqdata: PropTypes.string,
  sentry: PropTypes.bool,
  jsSdkPath: PropTypes.string,
  endpoint: PropTypes.string,
  reportapi: PropTypes.string,
  assethost: PropTypes.string,
  imghost: PropTypes.string,
  host: PropTypes.string,
};

ConfirmHcaptcha.defaultProps = {
  size: 'invisible',
  passiveSiteKey: false,
  showLoading: false,
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  loadingIndicatorColor: null,
  theme: 'light',
  rqdata: null,
  sentry: false,
  jsSdkPath: 'https://js.hcaptcha.com/1/api.js',
  endpoint: undefined,
  reportapi: undefined,
  assethost: undefined,
  imghost: undefined,
  host: undefined,
};

export default ConfirmHcaptcha;
