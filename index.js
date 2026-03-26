import React, { PureComponent } from 'react';
import { Modal, SafeAreaView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import Hcaptcha from './Hcaptcha';
import PropTypes from 'prop-types';
import { disableJourneyConsumer, enableJourneyConsumer } from './journey';
export { initJourneyTracking, registerJourneyNavigationContainer } from './journey';
export { default as Hcaptcha } from './Hcaptcha';

class ConfirmHcaptcha extends PureComponent {
  state = {
    show: false,
  };
  hasJourneyConsumer = false;
  componentDidMount() {
    this.syncJourneyConsumer(false, this.props.userJourney);
  }
  componentDidUpdate(prevProps) {
    this.syncJourneyConsumer(prevProps.userJourney, this.props.userJourney);
  }
  componentWillUnmount() {
    this.syncJourneyConsumer(this.props.userJourney, false);
  }
  syncJourneyConsumer(previousValue, nextValue) {
    if (!previousValue && nextValue && !this.hasJourneyConsumer) {
      enableJourneyConsumer();
      this.hasJourneyConsumer = true;
    } else if (previousValue && !nextValue && this.hasJourneyConsumer) {
      disableJourneyConsumer();
      this.hasJourneyConsumer = false;
    }
  }
  stopEvents = () => {
    if (this.hasJourneyConsumer) {
      disableJourneyConsumer();
      this.hasJourneyConsumer = false;
    }
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
  renderCaptcha() {
    let {
      size,
      siteKey,
      baseUrl,
      languageCode,
      orientation,
      onMessage,
      showLoading,
      closableLoading,
      loadingIndicatorColor,
      backgroundColor,
      theme,
      rqdata,
      sentry,
      jsSrc,
      endpoint,
      reportapi,
      assethost,
      imghost,
      host,
      debug,
      useSafeAreaView,
      phonePrefix,
      phoneNumber,
      userJourney,
      verifyParams,
    } = this.props;

    const WrapperComponent = useSafeAreaView === false ? View : SafeAreaView;

    return (
      <WrapperComponent style={styles.wrapper}>
        <Hcaptcha
          url={baseUrl}
          size={size}
          siteKey={siteKey}
          onMessage={onMessage}
          languageCode={languageCode}
          showLoading={showLoading}
          closableLoading={closableLoading}
          loadingIndicatorColor={loadingIndicatorColor}
          backgroundColor={backgroundColor}
          theme={theme}
          rqdata={rqdata}
          sentry={sentry}
          jsSrc={jsSrc}
          endpoint={endpoint}
          reportapi={reportapi}
          assethost={assethost}
          imghost={imghost}
          host={host}
          orientation={orientation}
          debug={debug}
          phonePrefix={phonePrefix}
          phoneNumber={phoneNumber}
          userJourney={userJourney}
          verifyParams={verifyParams}
          _journeyManagedExternally={true}
        />
      </WrapperComponent>
    );
  }
  render() {
    let { show } = this.state;
    let {
      passiveSiteKey,
      backgroundColor,
      hasBackdrop,
    } = this.props;

    if (!show) {
      return null;
    }

    if (passiveSiteKey) {
      return (
        <View pointerEvents="none" style={styles.passiveContainer}>
          {this.renderCaptcha()}
        </View>
      );
    }

    return (
      <Modal
        animationType="fade"
        onRequestClose={() => this.hide('back_button')}
        transparent
        visible={show}
      >
        <View style={styles.modal}>
          {hasBackdrop ? (
            <TouchableWithoutFeedback
              onPress={() => this.hide('backdrop')}
              testID="confirm-hcaptcha-backdrop"
            >
              <View style={[styles.backdrop, { backgroundColor }]} />
            </TouchableWithoutFeedback>
          ) : null}
          <View style={styles.modalContent}>
            {this.renderCaptcha()}
          </View>
        </View>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    flex: 1,
    margin: 0,
  },
  modalContent: {
    flex: 1,
  },
  passiveContainer: {
    height: 1,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 1,
  },
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
  orientation: PropTypes.string,
  backgroundColor: PropTypes.string,
  showLoading: PropTypes.bool,
  closableLoading: PropTypes.bool,
  loadingIndicatorColor: PropTypes.string,
  theme: PropTypes.string,
  rqdata: PropTypes.string,
  sentry: PropTypes.bool,
  jsSrc: PropTypes.string,
  endpoint: PropTypes.string,
  reportapi: PropTypes.string,
  assethost: PropTypes.string,
  imghost: PropTypes.string,
  host: PropTypes.string,
  hasBackdrop: PropTypes.bool,
  debug: PropTypes.object,
  phonePrefix: PropTypes.string,
  phoneNumber: PropTypes.string,
  userJourney: PropTypes.bool,
  verifyParams: PropTypes.shape({
    phoneNumber: PropTypes.string,
    phonePrefix: PropTypes.string,
    rqdata: PropTypes.string,
  }),
};

ConfirmHcaptcha.defaultProps = {
  size: 'invisible',
  passiveSiteKey: false,
  showLoading: false,
  closableLoading: false,
  orientation: 'portrait',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  loadingIndicatorColor: null,
  theme: 'light',
  rqdata: null,
  sentry: false,
  jsSrc: 'https://js.hcaptcha.com/1/api.js',
  endpoint: undefined,
  reportapi: undefined,
  assethost: undefined,
  imghost: undefined,
  host: undefined,
  hasBackdrop: true,
  debug: {},
  phonePrefix: null,
  phoneNumber: null,
  userJourney: false,
  verifyParams: undefined,
};

export default ConfirmHcaptcha;
