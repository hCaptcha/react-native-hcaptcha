import React from 'react';

const Modal = (props) => {
  // Filter out React Native-specific props that don't belong on DOM elements
  const {
    useNativeDriver,
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
    children,
    style,
    ...validDOMProps
  } = props;

  // Only render if visible
  if (!isVisible) {
    return null;
  }

  return (
    <div 
      {...validDOMProps}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        ...style
      }}
      onClick={onBackdropPress}
    >
      {children}
    </div>
  );
};

export default Modal;