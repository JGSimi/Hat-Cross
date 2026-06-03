type FlashPosition = { x: number; y: number };

const flashPositionPresets: FlashPosition[] = [
  { x: 40, y: 40 },
  { x: 50, y: 15 },
  { x: 85, y: 15 },
  { x: 85, y: 50 },
  { x: 85, y: 85 },
  { x: 15, y: 15 },
  { x: 50, y: 85 },
  { x: 15, y: 85 },
  { x: 15, y: 50 },
];

export function nextFlashPosition(current: FlashPosition): FlashPosition {
  const currentIndex = flashPositionPresets.findIndex((position) => (
    position.x === current.x && position.y === current.y
  ));
  if (currentIndex < 0) return { x: 15, y: 15 };
  return flashPositionPresets[(currentIndex + 1) % flashPositionPresets.length];
}
