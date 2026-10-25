import React, { createRef, PureComponent } from 'react';
import { BackHandler, Modal, Platform, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import Hcaptcha from './Hcaptcha';
import PropTypes from 'prop-types';
import { clearJourneyEvents, disableJourneyConsumer, enableJourneyConsumer } from './journey';
export { initJourneyTracking, registerJourneyNavigationContainer } from './journey';
export { default as Hcaptcha } from './Hcaptcha';

class ConfirmHcaptcha extends PureComponent {
  state = {
    journeyStopped: false,
    show: false,
    destroyed: false,
    generation: 0,
  };
  hasJourneyConsumer = false;
  verificationPending = false;
  captchaRef = createRef();
  // Default-mode token timers can outlive hide() and must remain cancellable.
  tokenTimers = new Set();
  // The web widget has no deferred execution or imperative handle, so prewarm is
  // native-only: on web it is ignored and the default mount-on-show() path is used.
  isPrewarm(props = this.props) {
    return Platform.OS !== 'web' && Boolean(props.prewarm);
  }
  getJourneyEnabled(props = this.props, state = this.state) {
    return Boolean(props.userJourney && !state.journeyStopped && !state.destroyed);
  }
  componentDidMount() {
    this.syncJourneyConsumer(false, this.getJourneyEnabled());
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.show && (this.isPrewarm(prevProps) !== this.isPrewarm() || prevProps.passiveSiteKey !== this.props.passiveSiteKey)) {
      this.backSubscription?.remove();
      this.backSubscription = null;
      this.executePrewarmed(this.verificationPending);
    }
    if (prevProps.userJourney !== this.props.userJourney && prevState.journeyStopped) {
      this.setState({ journeyStopped: false });
      return;
    }

    this.syncJourneyConsumer(
      this.getJourneyEnabled(prevProps, prevState),
      this.getJourneyEnabled()
    );
  }
  componentWillUnmount() {
    this.syncJourneyConsumer(this.getJourneyEnabled(), false);
    this.backSubscription?.remove();
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

    clearJourneyEvents();
    this.setState({ journeyStopped: true });
  };
  show = () => {
    if (this.isPrewarm() || !this.state.show) {
      this.verificationPending = true;
    }
    this.setState({ show: true, destroyed: false }, this.executePrewarmed);
  };
  onRequestChange = (pending) => {
    this.verificationPending = pending;
    if (pending && this.isPrewarm() && !this.state.show && !this.state.destroyed) {
      this.setState({ show: true }, () => this.executePrewarmed(false));
    }
  };
  onTokenTimerChange = (timer, active) => {
    if (active) {
      this.tokenTimers.add(timer);
    } else {
      this.tokenTimers.delete(timer);
    }
  };
  executePrewarmed = (execute = true) => {
    if (!this.isPrewarm() || !this.state.show) {
      return;
    }
    if (!this.props.passiveSiteKey) {
      this.backSubscription?.remove();
      this.backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
        this.hide('back_button');
        return true;
      });
    }
    if (execute) {
      this.captchaRef.current?.execute();
    }
  };
  execute = () => this.show();
  destroy = () => {
    this.verificationPending = false;
    this.backSubscription?.remove();
    this.backSubscription = null;
    this.captchaRef.current?.destroy();
    for (const timer of this.tokenTimers) {
      clearTimeout(timer);
    }
    this.tokenTimers.clear();
    this.setState(({ generation }) => ({ show: false, destroyed: true, generation: generation + 1 }));
  };
  hide = (source) => {
    const { onMessage } = this.props;
    this.verificationPending = false;
    this.backSubscription?.remove();
    this.backSubscription = null;
    if (this.isPrewarm()) {
      this.captchaRef.current?.reset();
    }
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
      verifyParams,
    } = this.props;
    const prewarm = this.isPrewarm();

    const WrapperComponent = useSafeAreaView === false ? View : SafeAreaView;
    const journeyEnabled = this.getJourneyEnabled();

    return (
      <WrapperComponent style={styles.wrapper}>
        <Hcaptcha
          key={this.state.generation}
          ref={this.captchaRef}
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
          userJourney={journeyEnabled}
          verifyParams={verifyParams}
          prewarm={prewarm}
          _journeyManagedExternally={true}
          _onRequestChange={this.onRequestChange}
          _onTokenTimerChange={this.onTokenTimerChange}
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
    const prewarm = this.isPrewarm();

    if (this.state.destroyed || (!show && !prewarm)) {
      return null;
    }

    if (passiveSiteKey && !prewarm) {
      return (
        <View style={styles.passiveContainer} testID="confirm-hcaptcha-passive">
          {this.renderCaptcha()}
        </View>
      );
    }

    const content = (
      <View style={styles.modal}>
        {hasBackdrop ? (
          <Pressable
            onPress={() => this.hide('backdrop')}
            style={[styles.backdrop, { backgroundColor }]}
            testID="confirm-hcaptcha-backdrop"
          />
        ) : null}
        <View style={styles.modalContent}>
          {this.renderCaptcha()}
        </View>
      </View>
    );

    if (prewarm) {
      return (
        <View
          testID="confirm-hcaptcha-prewarm"
          pointerEvents={show && !passiveSiteKey ? 'auto' : 'none'}
          accessibilityElementsHidden={!show || passiveSiteKey}
          importantForAccessibility={show && !passiveSiteKey ? 'auto' : 'no-hide-descendants'}
          accessibilityViewIsModal={show && !passiveSiteKey}
          style={[styles.prewarmContainer, passiveSiteKey && styles.passiveContainer, (!show || passiveSiteKey) && styles.hidden]}
        >
          {content}
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
        {content}
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
    ...StyleSheet.absoluteFill,
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
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  prewarmContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  hidden: {
    opacity: 0,
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
  prewarm: PropTypes.bool,
  baseUrl: PropTypes.string,
  onMessage: PropTypes.func.isRequired,
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
  prewarm: false,
  showLoading: false,
  closableLoading: false,
  orientation: 'portrait',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  loadingIndicatorColor: null,
  theme: 'light',
  rqdata: null,
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
