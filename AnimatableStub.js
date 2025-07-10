// Stub for react-native-animatable - just pass through children
import React from 'react';

// Create a stub component that filters out animation-specific props
const AnimatableStub = React.forwardRef((props, ref) => {
  try {
    // Safely handle props that might be undefined or null
    if (!props || typeof props !== 'object') {
      return React.createElement('div', { ref }, null);
    }

    const { 
      children, 
      style,
      // Filter out react-native-animatable specific props
      animation,
      duration,
      delay,
      direction,
      easing,
      iterationCount,
      transition,
      onAnimationBegin,
      onAnimationEnd,
      useNativeDriver,
      isInteraction,
      // Filter out react-native-modal props that get passed down
      hideModalContentWhileAnimating,
      deviceHeight,
      deviceWidth,
      animationIn,
      animationOut,
      onBackdropPress,
      onBackButtonPress,
      isVisible,
      hasBackdrop,
      coverScreen,
      backdropColor,
      backdropOpacity,
      backdropTransitionInTiming,
      backdropTransitionOutTiming,
      customBackdrop,
      onModalHide,
      onModalShow,
      onModalWillHide,
      onModalWillShow,
      propagateSwipe,
      swipeDirection,
      swipeThreshold,
      onSwipeCancel,
      onSwipeComplete,
      onSwipeMove,
      onSwipeStart,
      scrollHorizontal,
      scrollOffset,
      scrollOffsetMax,
      scrollTo,
      supportedOrientations,
      statusBarTranslucent,
      // Filter out PanResponder-related props
      panResponderThreshold,
      panHandlers,
      // Filter out React Native accessibility props
      accessibilityDisabled,
      accessibilityHint,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
      accessible,
      importantForAccessibility,
      // Filter out other React Native specific props
      testID,
      nativeID,
      pointerEvents,
      removeClippedSubviews,
      renderToHardwareTextureAndroid,
      shouldRasterizeIOS,
      collapsable,
      needsOffscreenAlphaCompositing,
      onLayout,
      onResponderGrant,
      onResponderMove,
      onResponderReject,
      onResponderRelease,
      onResponderTerminate,
      onResponderTerminationRequest,
      onStartShouldSetResponder,
      onStartShouldSetResponderCapture,
      onMoveShouldSetResponder,
      onMoveShouldSetResponderCapture,
      ...validDOMProps 
    } = props;
    
    // Filter out any remaining invalid props that might cause issues
    const safeProps = {};
    if (validDOMProps) {
      Object.keys(validDOMProps).forEach(key => {
        const value = validDOMProps[key];
        // Only include props that won't cause DOM issues
        if (key.startsWith('data-') || 
            key.startsWith('aria-') || 
            ['className', 'id', 'role', 'tabIndex', 'title'].includes(key) ||
            (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
          safeProps[key] = value;
        }
      });
    }
    
    return React.createElement('div', { 
      ref, 
      style: style || {}, 
      ...safeProps 
    }, children);
  } catch (error) {
    console.warn('AnimatableStub error:', error);
    // Fallback to minimal safe element
    return React.createElement('div', { ref }, props?.children || null);
  }
});

// Export all the animation types as the same stub component
export default AnimatableStub;
export const createAnimatableComponent = () => AnimatableStub;
export const View = AnimatableStub;
export const Text = AnimatableStub;
export const Image = AnimatableStub;

// Additional exports that react-native-modal expects
export const initializeRegistryWithDefinitions = () => {};
export const registerAnimation = () => {};
export const createAnimation = () => {};