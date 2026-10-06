export type SeasonalThemeName = 'default' | 'halloween' | 'christmas' | 'new-year'

export type HalloweenIntensity = 'off' | 'light' | 'full'

export type SeasonalThemeState = {
  name: SeasonalThemeName
  intensity: HalloweenIntensity
}
