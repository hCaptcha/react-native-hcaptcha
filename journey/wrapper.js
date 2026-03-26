import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { emitJourneyEvent, isJourneyCapturing, resolveJourneyIdentifier } from './runtime';
import { JourneyEventKind, JourneyField } from './schema';

const TAP_DURATION_MS = 300;
const DRAG_THRESHOLD_PX = 10;
const SCROLL_DOMINANCE_RATIO = 2;
const SCROLL_THRESHOLD_PX = 24;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const getPoint = (nativeEvent) => ({
  x: typeof nativeEvent.pageX === 'number' ? nativeEvent.pageX : nativeEvent.locationX,
  y: typeof nativeEvent.pageY === 'number' ? nativeEvent.pageY : nativeEvent.locationY,
});

const getDirection = (dx, dy) => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'horizontal:right' : 'horizontal:left';
  }

  return dy >= 0 ? 'vertical:down' : 'vertical:up';
};

const JourneyWrapper = ({ children }) => {
  const gestureRef = useRef(null);

  const handleTouchStart = (event) => {
    if (!isJourneyCapturing()) {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    gestureRef.current = {
      identifier: resolveJourneyIdentifier(nativeEvent),
      point: getPoint(nativeEvent),
      startedAt: Date.now(),
    };
  };

  const handleTouchEnd = (event) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (!gesture || !isJourneyCapturing()) {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    const endPoint = getPoint(nativeEvent);
    const dx = endPoint.x - gesture.point.x;
    const dy = endPoint.y - gesture.point.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy));
    const duration = Date.now() - gesture.startedAt;
    const baseMetadata = {
      [JourneyField.id]: gesture.identifier,
      [JourneyField.x]: endPoint.x,
      [JourneyField.y]: endPoint.y,
    };

    if (distance < DRAG_THRESHOLD_PX && duration <= TAP_DURATION_MS) {
      emitJourneyEvent(JourneyEventKind.click, 'View', {
        ...baseMetadata,
        [JourneyField.action]: 'tap',
      });
      return;
    }

    const axisDominant = Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(Math.min(Math.abs(dx), Math.abs(dy)), 1);
    if (distance >= SCROLL_THRESHOLD_PX && axisDominant >= SCROLL_DOMINANCE_RATIO) {
      emitJourneyEvent(JourneyEventKind.drag, 'ScrollView', {
        ...baseMetadata,
        [JourneyField.action]: 'scroll_start',
        [JourneyField.value]: getDirection(dx, dy),
      });
      emitJourneyEvent(JourneyEventKind.drag, 'ScrollView', {
        ...baseMetadata,
        [JourneyField.action]: 'scroll_end',
        [JourneyField.value]: Number(distance.toFixed(2)),
      });
      return;
    }

    emitJourneyEvent(JourneyEventKind.drag, 'View', {
      ...baseMetadata,
      [JourneyField.action]: 'drag_start',
    });
    emitJourneyEvent(JourneyEventKind.drag, 'View', {
      ...baseMetadata,
      [JourneyField.action]: 'drag_end',
      [JourneyField.value]: Number(distance.toFixed(2)),
    });
  };

  const handleTouchCancel = () => {
    gestureRef.current = null;
  };

  return (
    <View
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      style={styles.container}
    >
      {children}
    </View>
  );
};

export default JourneyWrapper;
