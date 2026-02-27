/** Options for the `sensing_setdragmode` block's `DRAG_MODE` field. */
export const DragMode = {
  Draggable: 'draggable',
  NotDraggable: 'not draggable'
} as const;
export type DragMode = (typeof DragMode)[keyof typeof DragMode];
