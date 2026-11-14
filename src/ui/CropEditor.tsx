import { useRef } from "preact/hooks";
import { HEAD_HEIGHT_RATIO, TOP_MARGIN_RATIO } from "../crop/autoCrop";
import { maxFrameWidth, MIN_FRAME_WIDTH_PX, moveFrame, resizeFrame } from "../crop/frame";
import type { Rect } from "../scoring/types";
import { strings } from "./strings";

// One wheel notch or +/- key changes the frame width by this factor.
const ZOOM_STEP = 1.05;
// One arrow-key press moves the frame by this fraction of its width.
const KEY_MOVE_FRACTION = 0.02;

type Props = {
  imageWidth: number;
  imageHeight: number;
  frame: Rect;
  onChange: (frame: Rect) => void;
};

// The 3:4 frame drawn over the photo, in image-pixel coordinates. Drag it to
// move; wheel, slider or +/- to resize; arrow keys to nudge. Two dashed lines
// inside the frame mark where the top of the head and the chin should sit.
export function CropOverlay({ imageWidth, imageHeight, frame, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const stroke = Math.max(imageWidth, imageHeight) / 300;

  const move = (dx: number, dy: number) =>
    onChange(moveFrame(frame, dx, dy, imageWidth, imageHeight));
  const zoom = (factor: number) =>
    onChange(resizeFrame(frame, frame.width * factor, imageWidth, imageHeight));

  function onPointerMove(event: PointerEvent) {
    const last = lastPointer.current;
    const box = svg.current?.getBoundingClientRect();
    if (!last || !box || box.width === 0) return;
    // Screen pixels -> image pixels.
    const scale = imageWidth / box.width;
    move((event.clientX - last.x) * scale, (event.clientY - last.y) * scale);
    lastPointer.current = { x: event.clientX, y: event.clientY };
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = frame.width * KEY_MOVE_FRACTION;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      "+": () => zoom(1 / ZOOM_STEP),
      "-": () => zoom(ZOOM_STEP),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  const guide = (ratio: number) => {
    const y = frame.y + ratio * frame.height;
    return <line x1={frame.x} x2={frame.x + frame.width} y1={y} y2={y} class="crop-guide" />;
  };

  return (
    <svg
      ref={svg}
      class="crop-overlay"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      stroke-width={stroke}
      stroke-dasharray={`${stroke * 4}`}
      onWheel={(event) => {
        event.preventDefault();
        zoom(event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
      }}
    >
      {/* Everything outside the frame is dimmed (even-odd: outer minus frame). */}
      <path
        class="crop-outside"
        fill-rule="evenodd"
        d={`M0 0H${imageWidth}V${imageHeight}H0Z M${frame.x} ${frame.y}h${frame.width}v${frame.height}h${-frame.width}Z`}
      />
      {guide(TOP_MARGIN_RATIO)}
      {guide(TOP_MARGIN_RATIO + HEAD_HEIGHT_RATIO)}
      <rect
        class="crop-frame"
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        tabindex={0}
        role="slider"
        aria-label={strings.cropFrameLabel}
        aria-valuenow={Math.round(frame.width)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          lastPointer.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          lastPointer.current = null;
        }}
        onPointerCancel={() => {
          lastPointer.current = null;
        }}
        onKeyDown={onKeyDown}
      />
    </svg>
  );
}

type ControlsProps = Props & { onReset: () => void };

export function CropControls({ imageWidth, imageHeight, frame, onChange, onReset }: ControlsProps) {
  const widest = maxFrameWidth(imageWidth, imageHeight);
  return (
    <div class="crop-controls">
      <label>
        {strings.cropSizeSlider}
        <input
          type="range"
          min={Math.min(MIN_FRAME_WIDTH_PX, widest)}
          max={widest}
          step={1}
          value={frame.width}
          onInput={(event) =>
            onChange(resizeFrame(frame, Number(event.currentTarget.value), imageWidth, imageHeight))
          }
        />
      </label>
      <button type="button" onClick={onReset}>
        {strings.cropReset}
      </button>
    </div>
  );
}
