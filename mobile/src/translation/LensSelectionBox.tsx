import React, { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LensSelectionBoxProps {
  containerWidth: number;
  containerHeight: number;
  box: Rect;
  onBoxChange: (box: Rect) => void;
  onReset?: () => void;
  disabled?: boolean;
}

const MIN_SIZE = 70;
const HANDLE_TOUCH_SIZE = 44;

export function LensSelectionBox({
  containerWidth,
  containerHeight,
  box,
  onBoxChange,
  onReset,
  disabled = false,
}: LensSelectionBoxProps) {
  const boxRef = useRef(box);
  boxRef.current = box;
  const startRef = useRef(box);

  // Center Move PanResponder
  const centerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startRef.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, g) => {
        const s = startRef.current;
        const maxX = Math.max(0, containerWidth - s.width);
        const maxY = Math.max(0, containerHeight - s.height);
        const nextX = Math.max(0, Math.min(maxX, s.x + g.dx));
        const nextY = Math.max(0, Math.min(maxY, s.y + g.dy));
        onBoxChange({ ...s, x: nextX, y: nextY });
      },
    }),
  ).current;

  // Top-Left Handle PanResponder
  const tlPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startRef.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, g) => {
        const s = startRef.current;
        const maxX = s.x + s.width - MIN_SIZE;
        const maxY = s.y + s.height - MIN_SIZE;
        const nextX = Math.max(0, Math.min(maxX, s.x + g.dx));
        const nextY = Math.max(0, Math.min(maxY, s.y + g.dy));
        const nextW = s.width - (nextX - s.x);
        const nextH = s.height - (nextY - s.y);
        onBoxChange({ x: nextX, y: nextY, width: nextW, height: nextH });
      },
    }),
  ).current;

  // Top-Right Handle PanResponder
  const trPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startRef.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, g) => {
        const s = startRef.current;
        const maxY = s.y + s.height - MIN_SIZE;
        const nextY = Math.max(0, Math.min(maxY, s.y + g.dy));
        const maxW = containerWidth - s.x;
        const nextW = Math.max(MIN_SIZE, Math.min(maxW, s.width + g.dx));
        const nextH = s.height - (nextY - s.y);
        onBoxChange({ x: s.x, y: nextY, width: nextW, height: nextH });
      },
    }),
  ).current;

  // Bottom-Left Handle PanResponder
  const blPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startRef.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, g) => {
        const s = startRef.current;
        const maxX = s.x + s.width - MIN_SIZE;
        const nextX = Math.max(0, Math.min(maxX, s.x + g.dx));
        const nextW = s.width - (nextX - s.x);
        const maxH = containerHeight - s.y;
        const nextH = Math.max(MIN_SIZE, Math.min(maxH, s.height + g.dy));
        onBoxChange({ x: nextX, y: s.y, width: nextW, height: nextH });
      },
    }),
  ).current;

  // Bottom-Right Handle PanResponder
  const brPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startRef.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, g) => {
        const s = startRef.current;
        const maxW = containerWidth - s.x;
        const maxH = containerHeight - s.y;
        const nextW = Math.max(MIN_SIZE, Math.min(maxW, s.width + g.dx));
        const nextH = Math.max(MIN_SIZE, Math.min(maxH, s.height + g.dy));
        onBoxChange({ x: s.x, y: s.y, width: nextW, height: nextH });
      },
    }),
  ).current;

  if (containerWidth <= 0 || containerHeight <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── Dimmed Vignette Mask (Leaves Selection Box Bright) ── */}
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          { top: 0, left: 0, right: 0, height: Math.max(0, box.y) },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          {
            top: box.y + box.height,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          {
            top: box.y,
            left: 0,
            width: Math.max(0, box.x),
            height: box.height,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          {
            top: box.y,
            left: box.x + box.width,
            right: 0,
            height: box.height,
          },
        ]}
      />

      {/* ── Selection Box Frame & Center Dragger ── */}
      <View
        style={[
          styles.boxFrame,
          {
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          },
        ]}
        {...centerPan.panHandlers}
      >
        {/* Subtle grid lines for Google Lens feel */}
        <View style={styles.gridH} />
        <View style={styles.gridV} />

        {/* ── Corner L-Brackets ── */}
        <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />
      </View>

      {/* ── Interactive Corner Grab Handles (Generous Hit Targets) ── */}
      {/* Top-Left */}
      <View
        style={[
          styles.handleTouch,
          {
            left: box.x - HANDLE_TOUCH_SIZE / 2,
            top: box.y - HANDLE_TOUCH_SIZE / 2,
          },
        ]}
        {...tlPan.panHandlers}
      >
        <View style={styles.handleDot} />
      </View>

      {/* Top-Right */}
      <View
        style={[
          styles.handleTouch,
          {
            left: box.x + box.width - HANDLE_TOUCH_SIZE / 2,
            top: box.y - HANDLE_TOUCH_SIZE / 2,
          },
        ]}
        {...trPan.panHandlers}
      >
        <View style={styles.handleDot} />
      </View>

      {/* Bottom-Left */}
      <View
        style={[
          styles.handleTouch,
          {
            left: box.x - HANDLE_TOUCH_SIZE / 2,
            top: box.y + box.height - HANDLE_TOUCH_SIZE / 2,
          },
        ]}
        {...blPan.panHandlers}
      >
        <View style={styles.handleDot} />
      </View>

      {/* Bottom-Right */}
      <View
        style={[
          styles.handleTouch,
          {
            left: box.x + box.width - HANDLE_TOUCH_SIZE / 2,
            top: box.y + box.height - HANDLE_TOUCH_SIZE / 2,
          },
        ]}
        {...brPan.panHandlers}
      >
        <View style={styles.handleDot} />
      </View>

      {/* ── Bottom Lens Pill Controls: Instructions & Reset ── */}
      <View
        pointerEvents="box-none"
        style={[
          styles.controlsBar,
          {
            top: Math.min(containerHeight - 44, box.y + box.height + 12),
          },
        ]}
      >
        <View style={styles.hintPill}>
          <Text style={styles.hintText}>✋ Drag corners to fit text</Text>
          {onReset && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset selection frame"
              onPress={onReset}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>↺ Reset</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  boxFrame: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  handleTouch: {
    position: 'absolute',
    width: HANDLE_TOUCH_SIZE,
    height: HANDLE_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  handleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#0284C7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  controlsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hintText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  resetBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  resetBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
});
