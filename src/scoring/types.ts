// What the worker measures for one detected face. All positions are in pixels
// of the original image. Everything here is a raw measurement; turning it
// into a score happens in score.ts so that changing a weight or threshold
// never requires analysing the photo again.
export type FaceMeasurements = {
  // Top of the forehead (face-mesh landmark 10) and bottom of the chin (152).
  foreheadTopY: number;
  chinY: number;
  // Horizontal middle of the face (between the two cheek edges).
  centerX: number;

  // Blendshape scores, 0 (not at all) to 1 (fully).
  eyeBlink: number; // the more closed of the two eyes
  jawOpen: number;
  smile: number; // mean of left and right mouth corners

  // Head rotation in degrees; 0 is facing the camera squarely.
  yawDeg: number; // turned left/right
  pitchDeg: number; // nodding up/down
  rollDeg: number; // tilted toward a shoulder

  // Pixel statistics of the face region (see pixels.ts).
  sharpness: number;
  meanLuma: number;
  overexposedFraction: number;
  underexposedFraction: number;
  sideImbalance: number;
};

export type Analysis = {
  faceCount: number;
  // Present only when exactly one face was found.
  face: FaceMeasurements | null;
};

export type Rect = { x: number; y: number; width: number; height: number };
