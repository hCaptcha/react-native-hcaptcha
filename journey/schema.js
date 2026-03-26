export const JOURNEY_MAX_EVENTS = 50;

export const JourneyEventKind = Object.freeze({
  screen: 'screen',
  click: 'click',
  drag: 'drag',
  gesture: 'gesture',
  edit: 'edit',
});

export const JourneyField = Object.freeze({
  kind: 'k',
  view: 'v',
  timestamp: 'ts',
  metadata: 'm',
  id: 'id',
  screen: 'sc',
  action: 'ac',
  value: 'val',
  x: 'x',
  y: 'y',
  index: 'idx',
  section: 'sct',
  item: 'it',
  target: 'tt',
  control: 'ct',
  gesture: 'gt',
  state: 'gs',
  taps: 'tap',
  containerView: 'cv',
  length: 'ln',
  compose: 'comp',
});

export const getJourneyTimestamp = () => Math.floor(Date.now() / 1000);

export const createJourneyEvent = (kind, view, metadata = {}) => ({
  [JourneyField.timestamp]: getJourneyTimestamp(),
  [JourneyField.kind]: kind,
  [JourneyField.view]: view,
  [JourneyField.metadata]: metadata,
});

export const cloneJourneyEvent = (event) => ({
  ...event,
  [JourneyField.metadata]: { ...event[JourneyField.metadata] },
});
