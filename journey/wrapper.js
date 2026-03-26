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

const getGestureSnapshot = (nativeEvent, gesture) => {
  const point = getPoint(nativeEvent);
  const dx = point.x - gesture.point.x;
  const dy = point.y - gesture.point.y;

  return {
    direction: getDirection(dx, dy),
    distance: Math.sqrt((dx * dx) + (dy * dy)),
    dx,
    dy,
    point,
  };
};

const getGestureKind = (distance, dx, dy) => {
  if (distance < DRAG_THRESHOLD_PX) {
    return null;
  }

  const axisDominant = Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(Math.min(Math.abs(dx), Math.abs(dy)), 1);

  return distance >= SCROLL_THRESHOLD_PX && axisDominant >= SCROLL_DOMINANCE_RATIO ? 'scroll' : 'drag';
};

const createBaseMetadata = (identifier, point) => ({
  [JourneyField.id]: identifier,
  [JourneyField.x]: point.x,
  [JourneyField.y]: point.y,
});

const JourneyWrapper = ({ children }) => {
  const gestureRef = useRef(null);

  const handleTouchStart = (event) => {
    if (!isJourneyCapturing()) {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    gestureRef.current = {
      identifier: resolveJourneyIdentifier(nativeEvent),
      kind: null,
      point: getPoint(nativeEvent),
      startedAt: Date.now(),
    };
  };

  const handleTouchMove = (event) => {
    const gesture = gestureRef.current;

    if (!gesture || !isJourneyCapturing()) {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    const snapshot = getGestureSnapshot(nativeEvent, gesture);
    const kind = getGestureKind(snapshot.distance, snapshot.dx, snapshot.dy);

    gesture.identifier = resolveJourneyIdentifier(nativeEvent, gesture.identifier);

    if (!kind || gesture.kind) {
      return;
    }

    gesture.kind = kind;
    const metadata = {
      ...createBaseMetadata(gesture.identifier, snapshot.point),
      [JourneyField.action]: kind === 'scroll' ? 'scroll_start' : 'drag_start',
    };

    if (kind === 'scroll') {
      metadata[JourneyField.value] = snapshot.direction;
    }

    emitJourneyEvent(JourneyEventKind.drag, kind === 'scroll' ? 'ScrollView' : 'View', metadata);
  };

  const handleTouchEnd = (event) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (!gesture || !isJourneyCapturing()) {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    gesture.identifier = resolveJourneyIdentifier(nativeEvent, gesture.identifier);
    const snapshot = getGestureSnapshot(nativeEvent, gesture);
    const duration = Date.now() - gesture.startedAt;
    const baseMetadata = createBaseMetadata(gesture.identifier, snapshot.point);

    if (!gesture.kind && snapshot.distance < DRAG_THRESHOLD_PX && duration <= TAP_DURATION_MS) {
      emitJourneyEvent(JourneyEventKind.click, 'View', {
        ...baseMetadata,
        [JourneyField.action]: 'tap',
      });
      return;
    }

    const finalKind = gesture.kind || getGestureKind(snapshot.distance, snapshot.dx, snapshot.dy) || 'drag';

    if (finalKind === 'scroll') {
      if (!gesture.kind) {
        emitJourneyEvent(JourneyEventKind.drag, 'ScrollView', {
          ...baseMetadata,
          [JourneyField.action]: 'scroll_start',
          [JourneyField.value]: snapshot.direction,
        });
      }

      emitJourneyEvent(JourneyEventKind.drag, 'ScrollView', {
        ...baseMetadata,
        [JourneyField.action]: 'scroll_end',
        [JourneyField.value]: Number(snapshot.distance.toFixed(2)),
      });
      return;
    }

    if (!gesture.kind) {
      emitJourneyEvent(JourneyEventKind.drag, 'View', {
        ...baseMetadata,
        [JourneyField.action]: 'drag_start',
      });
    }

    emitJourneyEvent(JourneyEventKind.drag, 'View', {
      ...baseMetadata,
      [JourneyField.action]: 'drag_end',
      [JourneyField.value]: Number(snapshot.distance.toFixed(2)),
    });
  };

  const handleTouchCancel = () => {
    gestureRef.current = null;
  };

  return (
    <View
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      style={styles.container}
    >
      {children}
    </View>
  );
};

export default JourneyWrapper;
