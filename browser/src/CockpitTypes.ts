interface IFakeCockpitTab {
    masterFile: string | null
}

export interface IFakeCockpitManagerState {
    tabs: { [id: number]: IFakeCockpitTab }
}
