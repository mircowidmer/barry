import { HStack, Image, Link, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/** Times in milliseconds, because the props travel as JSON. Texts come translated, since the layout cannot import. */
type AdventureActivityProps = {
  destination: string;
  startedAt: number;
  deadline: number;
  checkInBy: string;
  checkIn: string;
  /** Opens Barry on the live Adventure, where the Adventurer presses and holds Check In. iOS asks to unlock first. */
  url: string;
};

// The layout runs in the widget extension's own runtime, so everything it uses is declared inside it.
const AdventureActivity = (props: AdventureActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const text = '#1C1A19';
  const secondary = '#6B645E';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#B5562A';
  const success = '#1F7A3D';
  const interval = { lower: new Date(props.startedAt), upper: new Date(props.deadline) };

  const countdown = (size: number) => (
    <Text timerInterval={interval} countsDown modifiers={[font({ size, weight: 'bold', design: 'monospaced' }), monospacedDigit()]} />
  );

  const icon = (size = 16) => <Image systemName="mountain.2.fill" color={accent} size={size} />;

  const checkIn = (width: number) => (
    <Link
      label={props.checkIn}
      destination={props.url}
      modifiers={[buttonStyle('borderedProminent'), buttonBorderShape('capsule'), controlSize('large'), tint(success), foregroundStyle('#FFFFFF'), frame({ maxWidth: width })]}
    />
  );

  return {
    banner: (
      // iOS clips a Lock Screen banner taller than 160 points, so the countdown shares its row with Check In.
      <VStack spacing={10} modifiers={[padding({ horizontal: 16, vertical: 14 }), activityBackgroundTint('#FAF8F5')]}>
        <HStack spacing={10}>
          {icon(18)}
          <Text modifiers={[font({ size: 15, weight: 'bold', design: 'monospaced' }), foregroundStyle(text), lineLimit(1)]}>{props.destination}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, design: 'monospaced' }), foregroundStyle(secondary), lineLimit(1)]}>{props.checkInBy}</Text>
        </HStack>
        <HStack modifiers={[foregroundStyle(text)]}>
          {countdown(28)}
          <Spacer />
          {checkIn(150)}
        </HStack>
        <ProgressView timerInterval={interval} countsDown={false} modifiers={[tint(accent), labelsHidden()]} />
      </VStack>
    ),
    compactLeading: icon(),
    compactTrailing: countdown(14),
    minimal: icon(),
    expandedLeading: (
      <Text modifiers={[font({ size: 15, weight: 'bold', design: 'monospaced' }), lineLimit(1), padding({ leading: 8 })]}>{props.destination}</Text>
    ),
    expandedTrailing: <HStack modifiers={[padding({ trailing: 8 })]}>{countdown(15)}</HStack>,
    expandedBottom: (
      <VStack spacing={8} modifiers={[padding({ horizontal: 8 })]}>
        <Text modifiers={[font({ size: 13, design: 'monospaced' }), foregroundStyle('#B3ACA5')]}>{props.checkInBy}</Text>
        {checkIn(Infinity)}
      </VStack>
    ),
  };
};

export default createLiveActivity('AdventureActivity', AdventureActivity);
