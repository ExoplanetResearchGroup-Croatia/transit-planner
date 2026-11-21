/**
 * Builds public/templates/nina_template.json from NINA's own serializer output
 * (tests/fixtures/nina/nina-official_v3.2_all-sequence-entities.sequence.json,
 * NINA 3.2.0.9001). Every object is copied from that corpus; only Name,
 * ImageType/ExposureTime, Inherited and Parent links are set here.
 *
 * Structure:
 *   SequenceRootContainer
 *     Start (empty)
 *     Targets
 *       DeepSkyObjectContainer "TransitPlanner target"     [trigger: Meridian Flip]
 *         Wait for Time              (start, fixed clock)
 *         Slew and center            (inherits target coordinates)
 *         Sequential "Transit photometry"  [condition: Loop Until Time (end)]
 *           Take Exposure (LIGHT)
 *     End (empty)
 *
 * Run: npx tsx tools/nina/make-default-template.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renumberIds } from '../../src/lib/export/nina';

const root = fileURLToPath(new URL('../..', import.meta.url));
const corpus = JSON.parse(readFileSync(`${root}tests/fixtures/nina/nina-official_v3.2_all-sequence-entities.sequence.json`, 'utf8'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;
const all: J[] = [];
(function walk(o: J) {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') {
    if (o.$type) all.push(o);
    for (const [k, v] of Object.entries(o)) if (k !== 'Parent') walk(v);
  }
})(corpus);

const first = (type: string, pred: (o: J) => boolean = () => true): J => {
  const o = all.find((x) => x.$type.startsWith(`${type},`) && pred(x));
  if (!o) throw new Error(`corpus has no ${type}`);
  return JSON.parse(JSON.stringify(o));
};
const isDefault = (o: J) => (o.ErrorBehavior ?? 0) === 0 && (o.Attempts ?? 1) === 1;
const emptyContainer = (o: J) => {
  for (const k of ['Conditions', 'Items', 'Triggers']) if (o[k]) o[k].$values = [];
  return o;
};
let uid = 0;
const fresh = (o: J): J => {
  // give every object a unique temporary id so copies from the corpus don't collide
  const visit = (x: J): J => {
    if (Array.isArray(x)) return x.map(visit);
    if (!x || typeof x !== 'object') return x;
    const out: J = {};
    for (const [k, v] of Object.entries(x)) out[k] = k === '$id' ? `t${uid++}` : visit(v);
    return out;
  };
  return visit(o);
};

const rootC = fresh(emptyContainer(first('NINA.Sequencer.Container.SequenceRootContainer')));
const start = fresh(emptyContainer(first('NINA.Sequencer.Container.StartAreaContainer', isDefault)));
const targets = fresh(emptyContainer(first('NINA.Sequencer.Container.TargetAreaContainer', isDefault)));
const end = fresh(emptyContainer(first('NINA.Sequencer.Container.EndAreaContainer', isDefault)));
const dso = fresh(emptyContainer(first('NINA.Sequencer.Container.DeepSkyObjectContainer', isDefault)));
const wait = fresh(first('NINA.Sequencer.SequenceItem.Utility.WaitForTime', (o) => o.SelectedProvider?.$type?.includes('TimeProvider')));
const center = fresh(first('NINA.Sequencer.SequenceItem.Platesolving.Center', isDefault));
const loop = fresh(emptyContainer(first('NINA.Sequencer.Container.SequentialContainer', (o) => isDefault(o) && /SequentialContainer/.test(o.Name ?? ''))));
const timeCond = fresh(first('NINA.Sequencer.Conditions.TimeCondition'));
const exposure = fresh(first('NINA.Sequencer.SequenceItem.Imaging.TakeExposure', isDefault));
const flip = fresh(first('NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger'));

rootC.Name = 'TransitPlanner sequence';
rootC.Parent = null;
start.Name = 'Start';
targets.Name = 'Targets';
end.Name = 'End';
for (const a of [start, targets, end]) a.Parent = { $ref: rootC.$id };
rootC.Items.$values = [start, targets, end];

dso.Name = 'TransitPlanner target';
dso.Target.TargetName = 'Target';
dso.Parent = { $ref: targets.$id };
targets.Items.$values = [dso];

wait.Hours = 21;
wait.Minutes = 0;
wait.Seconds = 0;
wait.MinutesOffset = 0;
wait.SelectedProvider = { $id: `t${uid++}`, $type: 'NINA.Sequencer.Utility.DateTimeProvider.TimeProvider, NINA.Sequencer' };
wait.Parent = { $ref: dso.$id };
center.Inherited = true;
center.Parent = { $ref: dso.$id };

loop.Name = 'Transit photometry';
loop.Parent = { $ref: dso.$id };
timeCond.Hours = 23;
timeCond.Minutes = 0;
timeCond.Seconds = 0;
timeCond.MinutesOffset = 0;
timeCond.SelectedProvider = { $id: `t${uid++}`, $type: 'NINA.Sequencer.Utility.DateTimeProvider.TimeProvider, NINA.Sequencer' };
timeCond.Parent = { $ref: loop.$id };
loop.Conditions.$values = [timeCond];
exposure.ImageType = 'LIGHT';
exposure.ExposureTime = 60;
exposure.ExposureCount = 0;
exposure.Parent = { $ref: loop.$id };
loop.Items.$values = [exposure];

dso.Items.$values = [wait, center, loop];
flip.Parent = { $ref: dso.$id };
flip.TriggerRunner.Parent = null;
dso.Triggers.$values = [flip];

const out = renumberIds(rootC, new Map());
mkdirSync(`${root}public/templates`, { recursive: true });
writeFileSync(`${root}public/templates/nina_template.json`, JSON.stringify(out, null, 2));
console.log('wrote public/templates/nina_template.json');
