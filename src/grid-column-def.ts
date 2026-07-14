export interface GridColumnDef {
  width?: number | null;
  groupIndex?: number | null;
  label?: string;
  path?: string;
  renderer?: ((item: any) => HTMLElement) | null;
  _index?: number | null;
  _groupIndex?: number | null;
}
