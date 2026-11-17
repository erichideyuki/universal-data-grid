export interface GridColumnDef {
  width?: number | null;
  /** Nível de agrupamento INICIAL; depois o usuário reagrupa por arrasto. */
  groupIndex?: number | null;
  label?: string;
  path?: string;
  renderer?: ((item: any) => HTMLElement) | null;
}
