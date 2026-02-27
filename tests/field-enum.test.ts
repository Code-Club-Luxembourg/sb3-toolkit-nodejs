import { describe, expect, it } from 'vitest';
import {
  CurrentMenu,
  DragMode,
  ForwardBackward,
  FrontBack,
  GraphicEffect,
  GreaterThanMenu,
  Key,
  MathOp,
  NumberName,
  RotationStyle,
  SoundEffect,
  StopOption
} from '../src/model';

/**
 * The string value of every Field enum case is the on-wire identifier Scratch's
 * runtime expects. Changing one is a silent breakage that would produce
 * projects the player won't accept, so the values are pinned by fixture here.
 */
const FIXTURES: Record<string, [Record<string, string>, Record<string, string>]> = {
  CurrentMenu: [
    CurrentMenu,
    {
      Year: 'YEAR',
      Month: 'MONTH',
      Date: 'DATE',
      DayOfWeek: 'DAYOFWEEK',
      Hour: 'HOUR',
      Minute: 'MINUTE',
      Second: 'SECOND'
    }
  ],
  DragMode: [DragMode, { Draggable: 'draggable', NotDraggable: 'not draggable' }],
  ForwardBackward: [ForwardBackward, { Forward: 'forward', Backward: 'backward' }],
  FrontBack: [FrontBack, { Front: 'front', Back: 'back' }],
  GraphicEffect: [
    GraphicEffect,
    {
      Color: 'COLOR',
      Fisheye: 'FISHEYE',
      Whirl: 'WHIRL',
      Pixelate: 'PIXELATE',
      Mosaic: 'MOSAIC',
      Brightness: 'BRIGHTNESS',
      Ghost: 'GHOST'
    }
  ],
  GreaterThanMenu: [GreaterThanMenu, { Loudness: 'LOUDNESS', Timer: 'TIMER' }],
  Key: [
    Key,
    {
      Any: 'any',
      Space: 'space',
      Enter: 'enter',
      LeftArrow: 'left arrow',
      RightArrow: 'right arrow',
      UpArrow: 'up arrow',
      DownArrow: 'down arrow',
      A: 'a', B: 'b', C: 'c', D: 'd', E: 'e',
      F: 'f', G: 'g', H: 'h', I: 'i', J: 'j',
      K: 'k', L: 'l', M: 'm', N: 'n', O: 'o',
      P: 'p', Q: 'q', R: 'r', S: 's', T: 't',
      U: 'u', V: 'v', W: 'w', X: 'x', Y: 'y', Z: 'z',
      Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3',
      Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7',
      Digit8: '8', Digit9: '9'
    }
  ],
  MathOp: [
    MathOp,
    {
      Abs: 'abs',
      Floor: 'floor',
      Ceiling: 'ceiling',
      Sqrt: 'sqrt',
      Sin: 'sin',
      Cos: 'cos',
      Tan: 'tan',
      Asin: 'asin',
      Acos: 'acos',
      Atan: 'atan',
      Ln: 'ln',
      Log: 'log',
      EExp: 'e ^',
      TenExp: '10 ^'
    }
  ],
  NumberName: [NumberName, { Number: 'number', Name: 'name' }],
  RotationStyle: [
    RotationStyle,
    { AllAround: 'all around', LeftRight: 'left-right', DontRotate: "don't rotate" }
  ],
  SoundEffect: [SoundEffect, { Pitch: 'PITCH', Pan: 'PAN' }],
  StopOption: [
    StopOption,
    { All: 'all', ThisScript: 'this script', OtherScriptsInSprite: 'other scripts in sprite' }
  ]
};

describe('Field enum wire values', () => {
  for (const [name, [actual, expected]] of Object.entries(FIXTURES)) {
    it(`${name} matches the frozen fixture`, () => {
      expect(actual).toEqual(expected);
    });
  }
});
