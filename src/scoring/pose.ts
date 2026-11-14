export type HeadPose = { yawDeg: number; pitchDeg: number; rollDeg: number };

const RAD_TO_DEG = 180 / Math.PI;

// Head rotation from MediaPipe's facial transformation matrix: a 4x4 matrix
// in column-major order (element (row, col) is data[col * 4 + row]) that
// places the canonical, camera-facing face model onto the detected face.
//
// The rotation part is read as R = Ry(yaw) · Rx(pitch) · Rz(roll), which gives
//   R[0][2] = sin(yaw)·cos(pitch)    R[2][2] = cos(yaw)·cos(pitch)
//   R[1][2] = −sin(pitch)
//   R[1][0] = cos(pitch)·sin(roll)   R[1][1] = cos(pitch)·cos(roll)
// The matrix also carries a uniform scale; the atan2 ratios cancel it, and
// the pitch term divides by the length of the third column.
export function headPoseFromMatrix(data: ArrayLike<number>): HeadPose {
  const at = (row: number, col: number) => data[col * 4 + row] ?? 0;
  const scale = Math.hypot(at(0, 2), at(1, 2), at(2, 2));
  if (scale === 0) return { yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
  const sinPitch = Math.max(-1, Math.min(1, -at(1, 2) / scale));
  return {
    yawDeg: Math.atan2(at(0, 2), at(2, 2)) * RAD_TO_DEG,
    pitchDeg: Math.asin(sinPitch) * RAD_TO_DEG,
    rollDeg: Math.atan2(at(1, 0), at(1, 1)) * RAD_TO_DEG,
  };
}
