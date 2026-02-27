/** Options for the `operator_mathop` block's `OPERATOR` field. */
export const MathOp = {
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
} as const;
export type MathOp = (typeof MathOp)[keyof typeof MathOp];
