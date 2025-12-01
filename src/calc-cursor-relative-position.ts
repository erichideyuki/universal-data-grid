import { DropEvent } from '@interactjs/actions/drop/DropEvent';

import { RelativePosition } from './relative-position.js';

export const calcCursorRelativePosition = (event: DropEvent) => {
  const clientX = event.dragEvent.clientX;

  const targetRect = event.target.getBoundingClientRect();
  const cursorXRelativeToTarget = clientX - targetRect.left;
  const relativePosition = cursorXRelativeToTarget / targetRect.width;

  return relativePosition > 0.5
    ? RelativePosition.After
    : RelativePosition.Before;
};
