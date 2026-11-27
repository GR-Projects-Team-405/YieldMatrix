import { forwardRef } from 'react';

const DATA_CODEWORDS = [19, 34, 55, 80];
const ERROR_CODEWORDS = [7, 10, 15, 20];

function multiply(a: number, b: number) {
  let result = 0;
  for (let bit = 7; bit >= 0; bit -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> bit) & 1) * a;
  }
  return result & 0xff;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < result.length; i += 1) {
      result[i] ^= multiply(divisor[i], factor);
    }
  }
  return result;
}

export function createQrMatrix(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const versionIndex = DATA_CODEWORDS.findIndex((count) => bytes.length <= count - 2);
  if (versionIndex === -1) {
    throw new Error('This link is too long to encode as a QR code.');
  }

  const version = versionIndex + 1;
  const size = version * 4 + 17;
  const data: number[] = [];
  const appendBits = (number: number, length: number) => {
    for (let bit = length - 1; bit >= 0; bit -= 1) data.push((number >>> bit) & 1);
  };
  appendBits(0b0100, 4);
  appendBits(bytes.length, 8);
  bytes.forEach((byte) => appendBits(byte, 8));

  const capacity = DATA_CODEWORDS[versionIndex] * 8;
  for (let i = 0; i < Math.min(4, capacity - data.length); i += 1) data.push(0);
  while (data.length % 8 !== 0) data.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < data.length; i += 8) {
    codewords.push(data.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; codewords.length < DATA_CODEWORDS[versionIndex]; pad += 1) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11);
  }
  const divisor = reedSolomonDivisor(ERROR_CODEWORDS[versionIndex]);
  const allCodewords = [...codewords, ...reedSolomonRemainder(codewords, divisor)];
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(x, y, distance !== 2 && distance <= 3);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let i = 8; i < size - 8; i += 1) {
    if (!isFunction[6][i]) setFunction(i, 6, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(6, i, i % 2 === 0);
  }

  if (version > 1) {
    const alignment = version === 2 ? 18 : version === 3 ? 22 : 26;
    for (const centerY of [6, alignment]) {
      for (const centerX of [6, alignment]) {
        if (isFunction[centerY][centerX]) continue;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
  }

  const formatCoordinates: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    ...Array.from({ length: 8 }, (_, i) => [size - 1 - i, 8] as [number, number]),
    ...Array.from({ length: 7 }, (_, i) => [8, size - 7 + i] as [number, number]),
  ];
  formatCoordinates.forEach(([x, y]) => setFunction(x, y, false));
  setFunction(8, size - 8, true);

  const bits = allCodewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1),
  );
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (isFunction[y][x]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        modules[y][x] = Boolean(bit ^ ((x + y) % 2 === 0 ? 1 : 0));
        bitIndex += 1;
      }
    }
  }

  let remainder = 0b01000 << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) remainder ^= 0x537 << (bit - 10);
  }
  const format = ((0b01000 << 10) | remainder) ^ 0x5412;
  formatCoordinates.forEach(([x, y], i) => {
    modules[y][x] = ((format >>> i) & 1) !== 0;
  });

  return modules;
}

interface QRCodeGraphicProps {
  matrix: boolean[][];
  label: string;
}

const QRCodeGraphic = forwardRef<SVGSVGElement, QRCodeGraphicProps>(
  function QRCodeGraphic({ matrix, label }, ref) {
    const size = matrix.length;
    const path = matrix.flatMap((row, y) =>
      row.flatMap((dark, x) => dark ? [`M${x + 4} ${y + 4}h1v1h-1z`] : []),
    ).join('');

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${size + 8} ${size + 8}`}
        width={512}
        height={512}
        role="img"
        aria-label={label}
        className="block h-full w-full"
        shapeRendering="crispEdges"
      >
        <rect width={size + 8} height={size + 8} fill="#fff" />
        <path d={path} fill="#111" />
      </svg>
    );
  },
);

export default QRCodeGraphic;
